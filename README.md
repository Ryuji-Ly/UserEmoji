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

## CI/CD

The repository includes [release.yml](.github/workflows/release.yml), which runs on pushes to `main` and on manual `workflow_dispatch`.

It does two things:

- installs dependencies and builds the bot
- builds the Docker image and pushes it to `ghcr.io/ryuji-ly/useremoji`

The Docker image does not include your `.env` file. That stays on the VPS.

This means Discord secrets do not need to exist in GitHub at all.

## VPS Deployment

Yes. If you want Discord secrets to live strictly on the VPS, the correct model is:

- GitHub Actions builds and pushes the container image only
- the VPS stores `.env`
- the VPS starts the bot with that `.env`
- command deployment is run from the VPS, not from GitHub Actions

Recommended setup:

1. Install Docker and Docker Compose on the VPS.
2. Create `/opt/useremoji` on the VPS.
3. Copy [compose.yml](compose.yml), [deploy/update.sh](deploy/update.sh), [deploy/deploy-commands.sh](deploy/deploy-commands.sh), [deploy/useremoji-update.service](deploy/useremoji-update.service), and [deploy/useremoji-update.timer](deploy/useremoji-update.timer) into `/opt/useremoji` while preserving the `deploy/` folder.
4. Create `/opt/useremoji/.env` with the same variables as [.env.example](.env.example).
5. If the GHCR package is private, create a fine-grained GitHub token or classic token with `read:packages` and store it on the VPS as `GHCR_TOKEN`. Set `GHCR_USERNAME` to your GitHub username.
6. Run the updater once to pull the image and start the container.
7. Whenever you change slash commands or context menus, run the command deploy script from the VPS.

Manual first run:

```sh
cd /opt/useremoji
chmod +x deploy/update.sh
GHCR_USERNAME=your-github-user GHCR_TOKEN=your-package-token APP_DIR=/opt/useremoji ./deploy/update.sh
```

If you make the GHCR package public, you can skip the login variables and just run:

```sh
cd /opt/useremoji
chmod +x deploy/update.sh
APP_DIR=/opt/useremoji ./deploy/update.sh
```

To deploy Discord commands from the VPS using the same `.env` file:

```sh
cd /opt/useremoji
chmod +x deploy/deploy-commands.sh
APP_DIR=/opt/useremoji ./deploy/deploy-commands.sh
```

That runs `node dist/deploy.js` inside the container, so Discord credentials are read only from the VPS-side `.env`.

## Keeping The VPS Updated

You can use cron, but `systemd` is the cleaner option on most VPS distributions because it gives you logs, restart control, and timer status.

To enable the included timer:

```sh
sudo cp deploy/useremoji-update.service /etc/systemd/system/
sudo cp deploy/useremoji-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now useremoji-update.timer
```

That timer runs every 5 minutes and calls `docker compose pull` followed by `docker compose up -d`.

Do not put command deployment on the 5-minute timer. Only run [deploy/deploy-commands.sh](deploy/deploy-commands.sh) when command definitions actually change.

If you prefer cron, this is the equivalent:

```cron
*/5 * * * * cd /opt/useremoji && APP_DIR=/opt/useremoji ./deploy/update.sh >> /var/log/useremoji-update.log 2>&1
```

## Discord App Configuration

- Enable the `MESSAGE CONTENT INTENT` in the Discord developer portal if you want reliable message fetching for slash-command targets.
- Install the app with `applications.commands` and `bot` scopes.
- For user installs, keep both guild and user installation types enabled in the developer portal.
- Global command registration can take a few minutes to propagate.

## Slash Command Usage

- `/scan-emojis message-link:<discord message link>`
- `/scan-emojis message-id:<target id> channel:<optional channel>`

When `channel` is omitted, the command uses the current channel.
