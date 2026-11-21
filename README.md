# Spice Shop Watch — Reddit Devvit app

This project runs natively in Reddit. GitHub stores the source code; Reddit hosts the interactive post and sidebar widget.

## What the community sees

- A small pinned post reading **Is Spice Skin in stock? YES/NO**.
- When Spice is in stock, the YES badge pulses and sparkles in the interactive post for every viewer.
- A native Reddit Text Area sidebar widget shows the same short YES/NO status.
- The sidebar widget is text-only and cannot run the post's CSS animation; the animation plays in the pinned interactive post.
- The app checks Fortnite's public shop feed every five minutes. The open post refreshes its displayed status every minute.
- If the feed cannot be reached, the app shows `?` rather than falsely reporting NO.

## Fortnite API and permissions

The app reads the current Fortnite Item Shop JSON feed from:

`https://fortnite-api.com/v2/shop?language=en`

It matches Spice by exact cosmetic ID `Character_MeowKnaw`. The app does not send personal Reddit data to this service.

Reddit must approve the hostname `fortnite-api.com` for this app. Check the status at https://developers.reddit.com/apps/spice-shop-watch/developer-settings. Domain approval is separate from successful code builds and playtests.

The app uses moderator-scope Reddit API access only to create or pin its tracker post and create/update its own sidebar text widget.

## Notifications

When the skin enters the shop, the app attempts to send an inbox message to the configured Reddit username and adds a comment to the tracker post. Set the username in the app's subreddit settings (without `u/`). Leave it blank to disable direct messages.

## Test from Codespaces

Open https://github.com/PletzelOnYT/Reddit-App and create or reopen a Codespace on `main`. In its terminal run:

    git pull origin main
    npm install
    npm run build
    npm run dev

Open the test subreddit URL printed by Devvit and refresh the subreddit. In the subreddit moderator menu, click **Create Spice Shop Tracker**. The command reuses and pins the existing tracker post, then creates or updates one sidebar widget named **Spice Stock**.

After setting up the sidebar widget, go to Mod Tools → Community Appearance → Sidebar and drag **Spice Stock** where you want it. The widget is created automatically; you only need to position it.

## Publish after testing

When the live API status is verified and the playtest looks correct:

    npm run deploy
    npx devvit publish

Reddit must approve the app before it can be installed in a production community. After approval, update/install it in a subreddit you moderate.

## Updating later

Pull the latest source, edit the files, and use the Devvit playtest/deploy/publish workflow. GitHub stores the code; Reddit hosts the experience.
