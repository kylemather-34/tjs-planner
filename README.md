# tjs-planner

A Trader Joe's weekly meal planner: priced plans, shopping lists, calendar
export, and now a mobile app + hosted backend so friends can use it too.

## Structure

```
backend/   Node/Express API (also still works as a standalone CLI)
mobile/    Expo/React Native app (iOS, buildable for TestFlight)
```

`backend/` is the same planner logic from the original CLI project
(`tjClient.js`, `mealPlanner.js`, `shoppingList.js`, `calendar.js`,
the vendored/patched MCP server) — unchanged — with an Express server
(`src/server.js`) added on top so `mobile/` (or anything else) can call it
over HTTP instead of requiring Node locally. The CLI itself (`npm run plan`,
`npm run list`, `npm run ics`) still works exactly as before from inside
`backend/`.

## Quick start

```bash
# Backend
cd backend
npm install
npm start          # http://localhost:3000

# Mobile app (separate terminal)
cd mobile
npm install
npx expo start      # scan the QR code with Expo Go on your phone
```

Then open the app's Settings screen and point it at your backend (see
`mobile/README.md` for the localhost-vs-LAN-IP-vs-phone gotcha).

See `backend/README.md` for the API reference and deployment options
(Render/Railway/Fly.io), and `mobile/README.md` for the path from "running
in Expo Go" to "a real TestFlight build your friends can install."

