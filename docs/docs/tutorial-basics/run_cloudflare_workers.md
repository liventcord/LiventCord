# Cloudflare Workers

This directory contains all Cloudflare Worker services used by the application.

## Services

### media-api

Responsible for serving media files used by the application.

### hitlog

Logs hits made to the landing page.

---

## How to run

### media-api

1. Edit the configuration inside `wrangler.toml`.
   - `LIVENTCORD_SERVER_URL` — URL of liventcord netcore server.
   - `ADMIN_PASSWORD` — token used for authenticating with media API servers.
   - `MEDIA_API_SERVERS` — comma-separated list of media API server URLs.
     - See [How to set up media api server](run_media_api_server.md) for full setup.
   - `TENOR_API_KEY` — api key to use for fetching gifs from tenor.
   - `GIPHY_API_KEY` — api key to use for fetching gifs from giphy.

Example `wrangler.toml`:

```toml
name = "media-api"
main = "src/index.ts"
compatibility_date = "2025-02-04"
compatibility_flags = ["nodejs_compat"]

[vars]
ADMIN_PASSWORD = "YOUR_ADMIN_PASSWORD"
MEDIA_API_SERVERS = "https://proxyserver1.com,https://proxyserver2.com"
LIVENTCORD_SERVER_URL = "https://your-liventcord-url.com"
```

To deploy:

```bash
pnpm run deploy
```

### hitlog

1. Create a new Hyperdrive configuration in Cloudflare and add your PostgreSQL or MySQL connection.
2. Copy the returned `HYPERDRIVE_ID` into `wrangler.toml` under the Hyperdrive section.

Example `wrangler.toml` for hitlog:

```toml
name = "hitlog"
compatibility_date = "2025-02-04"
compatibility_flags = ["nodejs_compat"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "YOUR_HYPERDRIVE_ID"
```

To deploy:

```bash
pnpm run deploy
```
