# Spice Shop Watch — Reddit Devvit app

This project runs inside Reddit as an interactive custom post. GitHub stores the source code; Reddit hosts the app. It does not use GitHub Pages.

## Features

- Checks the free Fortnite-API endpoint https://fortnite-api.com/v2/shop?language=en.
- Matches Spice by its exact cosmetic ID: Character_MeowKnaw.
- Displays live shop status and V-Bucks price inside a Reddit post.
- Reddit's server checks the shop every five minutes; the open post refreshes its display every minute.
- When Spice enters the shop, the app attempts to send an inbox message to the configured Reddit username and adds a comment to the tracker post.

## Fetch Domains

This app requests the exact hostname `fortnite-api.com`. It is used only by the server to read the publicly accessible current Fortnite Item Shop JSON feed at `https://fortnite-api.com/v2/shop?language=en`, identify the Spice outfit by its cosmetic ID, and display whether it is present in the current rotation. The app does not send personal Reddit data to this service.

Reddit must approve this hostname for the app before requests can succeed. Check the status at https://developers.reddit.com/apps/spice-shop-watch/developer-settings. Domain approval is separate from successful code builds and playtests.

## Important notes

- A Reddit sidebar cannot run an interactive JavaScript app. Pin/highlight the interactive tracker post, then optionally add a sidebar button linking to that Reddit post. Members stay on Reddit.
- Devvit push notifications are not generally available to all apps. This version uses an opt-in Reddit inbox message.
- In the app's subreddit installation settings, enter the Reddit username for Spice alerts (without u/). Leave it blank to disable direct messages.
- Reddit must approve the app and its request to fortnite-api.com before production installation.
- Always confirm the item in Fortnite before purchasing.

## Run from this repository

This project is in PletzelOnYT/Reddit-App. Open https://github.com/PletzelOnYT/Reddit-App and create a Codespace on the main branch. In the Codespaces terminal run:

    npm install
    npx devvit login

You must moderate the test subreddit. Test the app with:

    npx devvit playtest YOUR_TEST_SUBREDDIT

When the playtest works, submit the app for Reddit review:

    npm run deploy
    npx devvit publish

Reddit must approve the app before it is live. After approval, install it in a subreddit you moderate:

    npx devvit install YOUR_SUBREDDIT

Set the Reddit username for Spice alerts in the installation settings. Open the subreddit moderator menu and choose Create Spice Shop Tracker. Pin/highlight the new interactive post. Optionally add a sidebar Button linking to that post's Reddit URL.

## Updating later

Edit the source in this repository, then run npm run deploy and npx devvit publish from a Codespace. Follow Reddit's approval/update process. GitHub stores the code; Reddit hosts the embedded experience.
