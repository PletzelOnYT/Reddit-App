import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';

const app = new Hono();
const TARGET_ID = 'Character_MeowKnaw';
const SHOP_URL = 'https://fortnite-api.com/v2/shop?language=en';
const STATUS_KEY = 'spice-watch:status:v1';
const PREVIOUS_KEY = 'spice-watch:previous-in-stock:v1';
const POST_KEY = 'spice-watch:tracker-post-id:v1';

type ShopStatus = {
  inStock: boolean;
  name: string;
  price: number | null;
  shopDate: string | null;
  lastCheckedAt: string;
};

function findCosmetic(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCosmetic(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (item.id === TARGET_ID) return item;
  for (const child of Object.values(item)) {
    const found = findCosmetic(child);
    if (found) return found;
  }
  return null;
}

async function fetchShopStatus(): Promise<ShopStatus> {
  const response = await fetch(SHOP_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Fortnite-API returned HTTP ' + response.status);

  const payload = await response.json() as {
    data?: { date?: string; entries?: unknown[]; shop?: unknown[] };
  };
  const data = payload.data;
  if (!data) throw new Error('Fortnite-API returned an unexpected shop response.');

  const entries = Array.isArray(data.entries) ? data.entries : Array.isArray(data.shop) ? data.shop : [];
  const matchingEntry = entries.find((entry) => findCosmetic(entry) !== null);
  const cosmetic = matchingEntry ? findCosmetic(matchingEntry) : findCosmetic(data);
  const entry = matchingEntry && typeof matchingEntry === 'object' ? matchingEntry as Record<string, unknown> : null;
  const priceValue = entry?.finalPrice ?? entry?.regularPrice;
  const price = typeof priceValue === 'number' ? priceValue : null;

  return {
    inStock: Boolean(cosmetic),
    name: typeof cosmetic?.name === 'string' ? cosmetic.name : 'Spice',
    price: cosmetic ? price : null,
    shopDate: typeof data.date === 'string' ? data.date : null,
    lastCheckedAt: new Date().toISOString(),
  };
}

async function saveStatus(status: ShopStatus): Promise<void> {
  await redis.set(STATUS_KEY, JSON.stringify(status));
}

app.get('/api/status', async (c) => {
  try {
    const cached = await redis.get(STATUS_KEY);
    if (cached) return c.json(JSON.parse(cached) as ShopStatus);
    const status = await fetchShopStatus();
    await saveStatus(status);
    return c.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown shop lookup error';
    console.error('Spice shop status failed:', message);
    return c.json({ error: message }, 503);
  }
});

app.post('/internal/menu/create-tracker', async (c) => {
  try {
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitCustomPost({
      subredditName: subreddit.name,
      title: '🎃 Spice the Pumpkin Cat — Live Item Shop Tracker',
      entry: 'default',
      textFallback: 'This interactive Reddit post checks the Fortnite Item Shop for Spice (Character_MeowKnaw).',
    });
    await redis.set(POST_KEY, post.id);
    return c.json({ showToast: { text: 'Spice tracker post created. Open it and pin it for your community.', appearance: 'success' } });
  } catch (error) {
    console.error('Could not create tracker post:', error);
    return c.json({ showToast: { text: 'Could not create the tracker post. Check the app logs and try again.', appearance: 'neutral' } });
  }
});

app.post('/internal/scheduler/check-shop', async (c) => {
  try {
    const status = await fetchShopStatus();
    await saveStatus(status);

    const previous = await redis.get(PREVIOUS_KEY);
    const justArrived = status.inStock && previous !== 'true';

    if (justArrived) {
      const usernameValue = await settings.get('alertUsername');
      const rawUsername = typeof usernameValue === 'string' ? usernameValue.trim() : '';
      const username = rawUsername.toLowerCase().startsWith('u/') ? rawUsername.slice(2) : rawUsername;
      const message = '🎃 Spice is in the Fortnite Item Shop right now!\n\nThe Spice outfit (Character_MeowKnaw) was detected in the live shop feed. Confirm the offer in-game before purchasing.';

      if (username) {
        try {
          await reddit.sendPrivateMessage({
            to: username,
            subject: '🎃 Spice is back in the Fortnite Item Shop!',
            text: message,
          });
        } catch (error) {
          console.error('Spice inbox alert could not be sent:', error);
        }
      }

      const postId = await redis.get(POST_KEY);
      if (postId) {
        try {
          await reddit.submitComment({
            id: postId,
            text: '🎃 **Spice is in the Fortnite Item Shop!** The live shop feed detected the Spice outfit. Confirm the offer in-game before purchasing.',
            runAs: 'APP',
          });
        } catch (error) {
          console.error('Spice stock alert comment could not be added:', error);
        }
      }
    }

    await redis.set(PREVIOUS_KEY, status.inStock ? 'true' : 'false');
    return c.json({ status: 'ok', inStock: status.inStock, alertTriggered: justArrived });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduled shop check error';
    console.error('Scheduled Spice shop check failed:', message);
    return c.json({ status: 'error', error: message }, 500);
  }
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
