# hagplanid-tj mobile

An Expo/React Native app for the Trader Joe's meal planner. Talks to the
`backend/` API — it doesn't run the MCP server itself (React Native can't
spawn Node subprocesses), which is exactly why the backend exists.

Screens: Recipes (browse/select/add) → Plan (priced week, export to
calendar, share with friends) → Shopping List. Plus Settings (backend URL/
API key) and Join a shared plan (enter a friend's code).

All source files were syntax-verified with esbuild, but this hasn't been
run through actual Expo/Metro bundling or on a simulator/device — I don't
have that available in this environment. Your first `npx expo start` is the
real first run; work through any dependency-version hiccups there (Expo SDK
versions move fast, so double check the versions in `package.json` against
whatever `npx create-expo-app` scaffolds if something doesn't resolve).

## Setup

```bash
cd mobile
npm install
```

## Running in development (Expo Go — fastest way to test)

```bash
npx expo start
```

Scan the QR code with the Expo Go app (App Store) on your iPhone. This runs
your JS on your actual phone hardware without a full native build — great
for iterating on the UI.

**Before this works end-to-end**, open the app's Settings screen and set
the Backend URL:
- If your backend is running locally on your Mac and your phone is on the
  same Wi-Fi network, use your Mac's LAN IP, e.g. `http://192.168.1.23:3000`
  (find it with `ipconfig getifaddr en0` on macOS). `localhost` from the
  phone's perspective means the phone itself, not your Mac.
- Once the backend is deployed (see `backend/README.md`), use that public
  URL instead — this is what you'll want before sharing the app with friends.

## Getting to a real, installable app (TestFlight)

Expo Go is for development only — to get something you or friends can
install as an actual app icon on their phone, you build with **EAS Build**
and distribute via **TestFlight**. Overview (each step needs your own Apple
account/credentials, so I can't run this for you):

1. **Apple Developer Program membership** ($99/year) — required for
   TestFlight distribution, at developer.apple.com.
2. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Configure the project for builds:
   ```bash
   eas build:configure
   ```
   This creates an `eas.json` and will prompt for your Apple Team ID (from
   your developer account) and confirm the bundle identifier in `app.json`
   (`com.kylemather.hagplanidtj` — change this to your own reverse-DNS
   identifier if you want).
4. Build:
   ```bash
   eas build --platform ios
   ```
   This runs on Expo's build servers (no local Xcode needed) and produces
   an `.ipa`. First build will also walk you through creating/uploading
   signing certificates — EAS can generate these for you interactively.
5. Submit to TestFlight:
   ```bash
   eas submit --platform ios
   ```
6. In App Store Connect, add your friends' Apple IDs as TestFlight
   internal/external testers. They install the **TestFlight** app from the
   App Store, accept your invite, and get "Hagplanið TJ" as a real app icon
   on their home screen — auto-updating whenever you push a new build.

Until you're ready for that, Expo Go + sharing your Expo project link works
fine for testing with a couple of friends without any Apple Developer
account at all (`npx expo start --tunnel` if they're not on your Wi-Fi).

## Known gaps / next steps

- No offline caching — every screen hits the backend fresh. Fine for now,
  but worth adding if TJ's API or your backend has hiccups.
- The shopping list's checkboxes are local-only (not synced back anywhere)
  — checking things off doesn't persist if you close the app.
- No pull-to-refresh on the recipes list yet.
- Recipe "add" only supports plain `ingredient, ingredient` search terms —
  no per-ingredient quantity input beyond the default of 1.
