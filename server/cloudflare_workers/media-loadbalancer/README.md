# CF Worker Load Balancer

Redirects requests to multiple Cloudflare Workers, tracking daily quotas using Redis. Assumes each cloudflare worker would have 100K request limits per day.

## Setup

1. Install dependencies:
```bash
pnpm install
````

2. Set environment variables:

```env
WORKERS=https://worker-a.example.com,https://worker-b.example.com
REDIS_URL=redis://:password@host:port
```

3. Run locally:

```bash
npx vercel dev
```

4. Deploy:

```bash
vercel deploy --prod
```

## Usage

Send requests like:

```
/attachments/123
/profiles/456
/guilds/789
/emojis/123
```

Requests are redirected to available workers without exceeding daily quotas.

