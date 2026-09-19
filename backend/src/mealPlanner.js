// mealPlanner.js
//
// Turns a list of recipe ids into a priced weekly plan by matching each
// ingredient search term to a real Trader Joe's product (cheapest match by
// default), then checks the week against a target budget.

import { searchProducts } from "./tjClient.js";

const STOPWORDS = new Set([
  "with", "made", "of", "the", "and", "a", "an", "for", "in", "on", "style",
]);

function normalizeWords(str) {
  return str
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

/**
 * Jaccard similarity: shared meaningful words / total distinct words across
 * both strings. Unlike a raw overlap count, this penalizes titles padded
 * with unrelated extra words — "Pineapple" vs "Pineapple" scores 1.0, while
 * "Pineapple" vs "Something Spritzy Pineapple & Orange" scores only 0.25,
 * even though both technically "contain the word."
 */
function relevanceScore(searchTerm, title) {
  const searchWords = new Set(normalizeWords(searchTerm));
  const titleWords = new Set(normalizeWords(title));
  let overlap = 0;
  for (const w of searchWords) if (titleWords.has(w)) overlap++;
  const union = searchWords.size + titleWords.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

/**
 * Pick the best product among search results for one ingredient.
 * - "best-match" (default): highest word-overlap with the search term wins;
 *   ties broken by cheapest price. Use this when your search term is close
 *   to the actual product name (e.g. "Creamy Spinach & Artichoke Dip") —
 *   otherwise "cheapest" can grab an unrelated but cheaper product that
 *   happened to share one keyword.
 * - "cheapest": lowest price wins outright, ignoring relevance. Good for
 *   generic terms like "chicken breast" where you just want the best price.
 * - "first": whatever TJ's search API ranked first.
 */
function pickProduct(searchTerm, priced, strategy) {
  if (strategy === "first") return priced[0];

  if (strategy === "cheapest") {
    return priced.reduce((a, b) => (b.price < a.price ? b : a));
  }

  // best-match (default)
  return priced.reduce((best, cur) => {
    const bestScore = relevanceScore(searchTerm, best.title);
    const curScore = relevanceScore(searchTerm, cur.title);
    if (curScore > bestScore) return cur;
    if (curScore === bestScore && cur.price < best.price) return cur;
    return best;
  });
}

/**
 * @param {Array} recipes - full recipe objects (id, name, servings, ingredients[])
 * @param {Object} opts
 * @param {number} [opts.budget] - optional weekly budget in USD
 * @param {"cheapest"|"first"} [opts.strategy] - how to pick among search matches
 */
export async function buildWeeklyPlan(recipes, opts = {}) {
  const { budget = null, strategy = "best-match", candidatePoolSize = 10, debug = false } = opts;

  const days = [];
  for (const recipe of recipes) {
    const lineItems = [];

    for (const ing of recipe.ingredients) {
      let matches;
      try {
        matches = await searchProducts(ing.search, candidatePoolSize);
      } catch (err) {
        lineItems.push({
          search: ing.search,
          qty: ing.qty,
          product: null,
          lineTotal: null,
          note: `lookup failed: ${err.message}`,
        });
        continue;
      }

      const priced = matches.filter((m) => m.price != null);
      if (priced.length === 0) {
        lineItems.push({
          search: ing.search,
          qty: ing.qty,
          product: null,
          lineTotal: null,
          note: "no priced match found",
        });
        continue;
      }

      const chosen = pickProduct(ing.search, priced, strategy);
      const topScore = relevanceScore(ing.search, chosen.title);
      const lowConfidence = strategy === "best-match" && topScore === 0;

      if (debug) {
        console.error(`\n[debug] "${ing.search}" (${priced.length} priced candidates):`);
        for (const p of priced) {
          const marker = p.sku === chosen.sku ? ">>" : "  ";
          console.error(
            `${marker} score=${relevanceScore(ing.search, p.title).toFixed(2)}  $${p.price.toFixed(2)}  ${p.title}`
          );
        }
        if (lowConfidence) {
          console.error(`   ⚠ no candidate shared any word with "${ing.search}" — likely not in stock/indexed right now`);
        }
      }

      lineItems.push({
        search: ing.search,
        qty: ing.qty,
        product: chosen,
        lineTotal: round2(chosen.price * ing.qty),
        lowConfidence,
      });
    }

    const dayTotal = round2(
      lineItems.reduce((sum, li) => sum + (li.lineTotal ?? 0), 0)
    );

    days.push({ recipe: recipe.name, id: recipe.id, lineItems, dayTotal });
  }

  const weekTotal = round2(days.reduce((sum, d) => sum + d.dayTotal, 0));
  const overBudget = budget != null ? weekTotal > budget : null;

  return {
    days,
    weekTotal,
    budget,
    overBudget,
    remaining: budget != null ? round2(budget - weekTotal) : null,
  };
}

/**
 * Given a candidate recipe pool and a budget, greedily pick recipes (cheapest
 * first) until adding the next one would blow the budget, then fill any
 * remaining room with whatever fits. Useful for "just keep me under $X".
 */
export async function buildPlanWithinBudget(allRecipes, budget, daysWanted = 7) {
  // Price every recipe once up front.
  const priced = [];
  for (const recipe of allRecipes) {
    const plan = await buildWeeklyPlan([recipe]);
    priced.push({ recipe, cost: plan.weekTotal, days: plan.days[0] });
  }

  priced.sort((a, b) => a.cost - b.cost);

  const chosen = [];
  let runningTotal = 0;
  for (const p of priced) {
    if (chosen.length >= daysWanted) break;
    if (runningTotal + p.cost <= budget) {
      chosen.push(p);
      runningTotal += p.cost;
    }
  }

  return {
    days: chosen.map((c) => c.days),
    weekTotal: round2(runningTotal),
    budget,
    overBudget: false,
    remaining: round2(budget - runningTotal),
    skipped: priced.length - chosen.length,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
