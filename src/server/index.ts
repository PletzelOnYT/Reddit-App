import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';

const app = new Hono();
const TARGET_ID = 'Character_MeowKnaw';
const SHOP_URL = 'https://fortnite-api.com/v2/shop?language=en';
const STATUS_KEY = 'spice-watch:status:v1';
const PREVIOUS_KEY = 'spice-watch:previous-in-stock:v1';
const POST_KEY = 'spice-watch:tracker-post-id:v1';
const SUBREDDIT_KEY = 'spice-watch:subreddit-name:v1';
const SIDEBAR_WIDGET_NAME = 'Spice Stock';

type ShopStatus = {
  inStock: boolean;
  name: string;
  price: number | null;
  shopDate: string | null;
  lastCheckedAt: string;
};

type WidgetRecord = { id: string; name?: string; shortName?: string };

const widgetReddit = reddit as unknown as {
  getWidgets: (subredditName: string) => Promise<WidgetRecord[]>;
  addWidget: (data: Record<string, unknown>) => Promise<WidgetRecord>;
  updateWidget: (data: Record<string, unknown>) => Promise<WidgetRecord>;
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

function answerFor(status: ShopStatus | null): string {
  if (!status) return '?';
  return status.inStock ? 'YES' : 'NO';
}

function statusLine(status: ShopStatus | null): string {
  return `**Is Spice Skin in stock?:** ${answerFor(status)}`;
}

async function syncSidebarWidget(subredditName: string, status: ShopStatus | null): Promise<void> {
  const widgets = await widgetReddit.getWidgets(subredditName);
  const existing = widgets.find(
    (widget) => widget.name === SIDEBAR_WIDGET_NAME || widget.shortName === SIDEBAR_WIDGET_NAME,
  );

  const widgetData: Record<string, unknown> = {
    type: 'textarea',
    subreddit: subredditName,
    shortName: SIDEBAR_WIDGET_NAME,
    text: statusLine(status),
    styles: {
      backgroundColor: '#2b1b13',
      headerColor: '#a85419',
    },
  };

  if (existing?.id) {
    await widgetReddit.updateWidget({ ...widgetData, id: existing.id });
  } else {
    await widgetReddit.addWidget(widgetData);
  }
}

function asPostId(id: string): `t3_${string}` {
  if (!id.startsWith('t3_')) {
    throw new Error('Stored Spice tracker post ID is not a Reddit post ID.');
  }
  return id as `t3_${string}`;
}

async function updateTrackerFallback(status: ShopStatus | null): Promise<void> {
  const postId = await redis.get(POST_KEY);
  if (!postId) return;
  try {
    const post = await reddit.getPostById(asPostId(postId));
    await post.setTextFallback({ text: statusLine(status) });
  } catch (error) {
    console.error('Could not update tracker fallback:', error);
  }
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
    await redis.set(SUBREDDIT_KEY, subreddit.name);

    const existingPostId = await redis.get(POST_KEY);
    let post = existingPostId ? await reddit.getPostById(asPostId(existingPostId)) : null;

    if (!post) {
      post = await reddit.submitCustomPost({
        subredditName: subreddit.name,
        title: '🎃 Is Spice Skin in stock?',
        entry: 'default',
        textFallback: { text: statusLine(null) },
      });
      await redis.set(POST_KEY, post.id);
    }

    await post.sticky(1);

    let sidebarReady = false;
    try {
      const cached = await redis.get(STATUS_KEY);
      const status = cached ? JSON.parse(cached) as ShopStatus : null;
      await syncSidebarWidget(subreddit.name, status);
      await post.setTextFallback({ text: statusLine(status) });
      sidebarReady = true;
    } catch (error) {
      console.error('Could not set up Spice sidebar widget:', error);
    }

    return c.json({
      showToast: {
        text: sidebarReady
          ? 'Spice tracker pinned and sidebar widget added or updated.'
          : 'Tracker pinned. Sidebar widget could not be set up; check app logs.',
        appearance: sidebarReady ? 'success' : 'neutral',
      },
    });
  } catch (error) {
    console.error('Could not create or pin tracker:', error);
    return c.json({ showToast: { text: 'Could not create or pin the tracker. Check app logs and try again.', appearance: 'neutral' } });
  }
});

app.post('/internal/scheduler/check-shop', async (c) => {
  try {
    const status = await fetchShopStatus();
    await saveStatus(status);

    const subredditName = await redis.get(SUBREDDIT_KEY);
    if (subredditName) {
      try {
        await syncSidebarWidget(subredditName, status);
      } catch (error) {
        console.error('Could not update Spice sidebar widget:', error);
      }
    }
    await updateTrackerFallback(status);

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
            id: asPostId(postId),
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

    const subredditName = await redis.get(SUBREDDIT_KEY);
    if (subredditName) {
      try {
        await syncSidebarWidget(subredditName, null);
        await updateTrackerFallback(null);
      } catch (widgetError) {
        console.error('Could not show unavailable Spice status:', widgetError);
      }
    }

    return c.json({ status: 'error', error: message }, 500);
  }
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
