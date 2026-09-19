// server.js
//
// REST wrapper around the existing planner/shoppingList/calendar/tjClient
// modules (unchanged from the CLI version) so any client — the Expo app,
// a future web UI, curl — can use them over HTTP.

import express from "express";
import cors from "cors";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildWeeklyPlan, buildPlanWithinBudget } from "./mealPlanner.js";
import { buildShoppingList } from "./shoppingList.js";
import { buildIcs } from "./calendar.js";
import { findStores, disconnect } from "./tjClient.js";
import { savePlan, getPlan } from "./shareStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, "..", "data", "recipes.json");

const app = express();
app.use(cors());
app.use(express.json());

// --- optional shared-secret auth --------------------------------------
// This server proxies Trader Joe's internal API. If you host it somewhere
// public, an unauthenticated endpoint is an open invitation for randoms to
// hammer TJ's backend through your server. Set API_KEY in your environment
// to require an `x-api-key` header matching it. Leave API_KEY unset for
// local development.
app.use((req, res, next) => {
  const required = process.env.API_KEY;
  if (!required) return next();
  if (req.header("x-api-key") === required) return next();
  res.status(401).json({ error: "missing or invalid x-api-key header" });
});

async function loadRecipes() {
  const raw = await readFile(RECIPES_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveRecipes(recipes) {
  await writeFile(RECIPES_PATH, JSON.stringify(recipes, null, 2), "utf-8");
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// --- routes -------------------------------------------------------------

app.get("/api/health", (req, res) => res.json({ ok: true }));

// List all recipes in the shared library.
app.get("/api/recipes", async (req, res) => {
  try {
    res.json(await loadRecipes());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new recipe to the shared library (the "create your own meals" flow).
// Body: { name, servings, ingredients: [{ search, qty }] }
app.post("/api/recipes", async (req, res) => {
  try {
    const { name, servings = 4, ingredients } = req.body ?? {};
    if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "name and a non-empty ingredients[] are required" });
    }
    const recipes = await loadRecipes();
    let id = slugify(name);
    if (recipes.some((r) => r.id === id)) id = `${id}-${Date.now().toString(36)}`;

    const recipe = { id, name, servings, ingredients };
    recipes.push(recipe);
    await saveRecipes(recipes);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Build a priced weekly plan.
// Body: { recipeIds: string[] } OR { auto: true, budget, days }
// Optional: { budget, strategy, debug }
app.post("/api/plan", async (req, res) => {
  try {
    const { recipeIds, auto, budget, days = 7, strategy = "best-match", debug = false } = req.body ?? {};
    const all = await loadRecipes();

    let plan;
    if (auto) {
      if (budget == null) return res.status(400).json({ error: "budget is required when auto is true" });
      plan = await buildPlanWithinBudget(all, budget, days);
    } else {
      if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
        return res.status(400).json({ error: "recipeIds[] is required unless auto is true" });
      }
      const recipes = all.filter((r) => recipeIds.includes(r.id));
      const missing = recipeIds.filter((id) => !recipes.some((r) => r.id === id));
      if (missing.length) {
        return res.status(404).json({ error: `unknown recipe id(s): ${missing.join(", ")}` });
      }
      plan = await buildWeeklyPlan(recipes, { budget, strategy, debug });
    }
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Build a shopping list from a plan you already built (pass it straight
// through from a prior POST /api/plan response), avoiding a second set of
// TJ lookups.
app.post("/api/shopping-list", (req, res) => {
  try {
    const { plan } = req.body ?? {};
    if (!plan?.days) return res.status(400).json({ error: "body must include the plan object from /api/plan" });
    res.json(buildShoppingList(plan));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export a plan as an .ics file. Returns the raw ICS text; the client saves
// and shares it as a file (see the mobile app's calendar export screen).
app.post("/api/calendar", (req, res) => {
  try {
    const { plan, startDate } = req.body ?? {};
    if (!plan?.days) return res.status(400).json({ error: "body must include the plan object from /api/plan" });
    const ics = buildIcs(plan, { startDate: startDate ? new Date(startDate) : new Date() });
    res.type("text/calendar").send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Find nearby Trader Joe's stores by ZIP.
app.get("/api/stores", async (req, res) => {
  try {
    const { zip, radius } = req.query;
    if (!zip) return res.status(400).json({ error: "zip query param is required" });
    res.json(await findStores(zip, radius ? Number(radius) : undefined));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Share a plan (+ optional shopping list) with friends via a short code.
app.post("/api/share", async (req, res) => {
  try {
    const { plan, shoppingList } = req.body ?? {};
    if (!plan?.days) return res.status(400).json({ error: "body must include a plan object" });
    const code = await savePlan({ plan, shoppingList: shoppingList ?? null });
    res.status(201).json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch a previously shared plan by code.
app.get("/api/share/:code", async (req, res) => {
  try {
    const result = await getPlan(req.params.code);
    if (!result) return res.status(404).json({ error: "no shared plan with that code" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`hagplanid-tj backend listening on port ${PORT}`);
});

// Make sure the MCP server subprocess doesn't get left running on shutdown.
async function shutdown() {
  await disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
