# User Emoji Bot

Discord.js bot that can be installed by a user, exposes both a message context menu and a slash command, scans a target message plus its custom reactions, and replies ephemerally with a paged emoji viewer.

## Features

- `Extract Emojis` message context menu for any message in servers or DMs where the app can run.
- `/scan-emojis` slash command for message links or message IDs.
- Ignores standard Unicode emoji and only keeps custom Discord emoji.
- Shows one emoji at a time with previous and next buttons.
- Includes a direct download button for the current emoji asset.

## Setup

1. Copy `.env.example` to `.env` and fill in your values.
2. Install dependencies with `npm install`.
3. Register commands with `npm run deploy`.
4. Start the bot with `npm run dev` or `npm run build && npm start`.

## Docker

- Build the image with `docker build -t user-emoji-bot .`
- Run it with `docker run --env-file .env user-emoji-bot`

## Discord App Configuration

- Enable the `MESSAGE CONTENT INTENT` in the Discord developer portal if you want reliable message fetching for slash-command targets.
- Install the app with `applications.commands` and `bot` scopes.
- For user installs, keep both guild and user installation types enabled in the developer portal.
- Global command registration can take a few minutes to propagate.

## Slash Command Usage

- `/scan-emojis message-link:<discord message link>`
- `/scan-emojis message-id:<target id> channel:<optional channel>`

When `channel` is omitted, the command uses the current channel.
