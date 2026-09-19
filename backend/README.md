# hagplanid-tj backend

REST API wrapping the Trader Joe's meal planner (unchanged planner/matching
logic from the original CLI) so the mobile app — or anyone's friends — can
use it over HTTP instead of running Node locally.

## Local setup

```bash
cd backend
npm install
npm start
```

Server listens on `http://localhost:3000` by default (`PORT` env var to
change it). CLI commands (`npm run plan`, `npm run list`, `npm run ics`)
still work exactly as before, unchanged.

## API

| Method | Path                  | Body / Query                                             | Returns |
|--------|-----------------------|-----------------------------------------------------------|---------|
| GET    | `/api/health`         | —                                                          | `{ ok: true }` |
| GET    | `/api/recipes`        | —                                                          | recipe array |
| POST   | `/api/recipes`        | `{ name, servings?, ingredients: [{search, qty}] }`        | the created recipe |
| POST   | `/api/plan`           | `{ recipeIds: [...] }` or `{ auto: true, budget, days? }`, plus optional `budget`, `strategy`, `debug` | priced weekly plan |
| POST   | `/api/shopping-list`  | `{ plan }` (pass through a `/api/plan` response)           | deduplicated shopping list |
| POST   | `/api/calendar`       | `{ plan, startDate? }`                                     | raw `.ics` text |
| GET    | `/api/stores`         | `?zip=xxxxx&radius=25`                                     | nearby TJ's stores |
| POST   | `/api/share`          | `{ plan, shoppingList? }`                                  | `{ code }` |
| GET    | `/api/share/:code`    | —                                                           | `{ plan, shoppingList, createdAt }` |

All of this was tested end-to-end locally (health, recipes CRUD, validation
errors, share/retrieve round-trip). The TJ-dependent routes (`/api/plan`,
`/api/shopping-list` via plan, `/api/stores`) need real internet access to
`traderjoes.com` to return real data — same requirement as the CLI always had.

## Protecting a public deployment

This server proxies Trader Joe's own internal API. If you deploy it
somewhere public, anyone who finds the URL can hit it — which could get your
hosting's IP rate-limited or blocked by TJ's if someone hammers it. Set an
`API_KEY` environment variable on your host, and the server will require
every request to include a matching `x-api-key` header. Leave it unset for
local development. The mobile app's Settings screen has a field for this key.

## Deploying

Because the MCP server is spawned as a real subprocess (not a serverless
function), you need a host that runs a persistent Node process — not a
static/edge/serverless platform. Reasonable free-tier options as of writing:

- **Render** (Web Service, Node environment) — straightforward, has a free
  tier that sleeps when idle.
- **Railway** — similarly simple, usage-based free credits.
- **Fly.io** — a bit more setup (a `fly.toml`), but keeps the process
  running without sleeping on low usage.

General steps for any of them:
1. Push this repo to GitHub (already done).
2. Create a new service pointed at the `backend/` folder as the root
   directory.
3. Build command: `npm install`. Start command: `npm start`.
4. Set the `API_KEY` environment variable (pick any random string) — you'll
   need this same value in the mobile app's settings.
5. Note the public URL your host gives you (e.g.
   `https://hagplanid-tj.onrender.com`) — that's the `Backend URL` you'll
   enter in the mobile app.

### Persistence note

`data/recipes.json` and `data/shared-plans.json` are plain files on disk.
Most free hosting tiers wipe local disk on redeploy/restart. That means:
recipes added via the app and shared-plan codes may disappear after a
redeploy. Fine for testing with friends; if you want this to survive
indefinitely, either attach a persistent volume (Fly.io and Railway both
support this) or swap `src/shareStore.js` and the recipes read/write calls
in `src/server.js` for a real database — the function signatures are small
on purpose so that's a contained change.
