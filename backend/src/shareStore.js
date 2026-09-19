// shareStore.js
//
// Minimal persistence for "share this plan with friends": each shared plan
// gets a short random code; anyone with the code can fetch it read-only.
//
// This is intentionally a flat JSON file, not a database — fine for a small
// friends-and-family app. IMPORTANT if you deploy this: most free hosting
// platforms (Render, Railway free tier, etc.) use an ephemeral filesystem,
// meaning this file gets wiped on every redeploy/restart. If shared plans
// need to survive that, either (a) attach a persistent volume/disk on your
// host, or (b) swap this module for a real datastore (SQLite on a mounted
// volume, or a hosted Postgres/Redis). The function signatures below are
// deliberately tiny so swapping the implementation later is a one-file change.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "shared-plans.json");

async function readStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function generateCode() {
  // 6 chars, easy to read aloud / type on a phone keyboard
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Save a plan (+ optional shopping list) and return its share code. */
export async function savePlan(payload) {
  const store = await readStore();
  let code;
  do {
    code = generateCode();
  } while (store[code]); // avoid the rare collision

  store[code] = { ...payload, createdAt: new Date().toISOString() };
  await writeStore(store);
  return code;
}

/** Look up a shared plan by code. Returns null if not found/expired. */
export async function getPlan(code) {
  const store = await readStore();
  return store[code.toUpperCase()] ?? null;
}
