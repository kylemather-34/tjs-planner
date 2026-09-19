#!/usr/bin/env node
// cli.js
//
// Usage:
//   npm run plan -- --recipes chicken-stir-fry,taco-night,pizza-night --budget 90
//   npm run plan -- --auto --budget 90 --days 5
//   npm run list -- --recipes chicken-stir-fry,taco-night
//   npm run ics  -- --recipes chicken-stir-fry,taco-night --start 2026-09-22

import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { buildWeeklyPlan, buildPlanWithinBudget } from "./mealPlanner.js";
import { buildShoppingList, printShoppingList } from "./shoppingList.js";
import { buildIcs } from "./calendar.js";
import { disconnect } from "./tjClient.js";

const program = new Command();
const RECIPES_PATH = new URL("../data/recipes.json", import.meta.url);

async function loadRecipes() {
  const raw = await readFile(RECIPES_PATH, "utf-8");
  return JSON.parse(raw);
}

function pickRecipes(all, ids) {
  if (!ids) return all;
  const wanted = new Set(ids.split(",").map((s) => s.trim()));
  const chosen = all.filter((r) => wanted.has(r.id));
  const missing = [...wanted].filter((id) => !chosen.some((r) => r.id === id));
  if (missing.length) {
    console.error(`Unknown recipe id(s): ${missing.join(", ")}`);
    console.error(`Available: ${all.map((r) => r.id).join(", ")}`);
    process.exit(1);
  }
  return chosen;
}

function printPlan(plan) {
  console.log("\n=== Weekly Plan ===");
  for (const day of plan.days) {
    console.log(`\n${day.recipe} — $${day.dayTotal.toFixed(2)}`);
    for (const li of day.lineItems) {
      if (li.product) {
        const flag = li.lowConfidence ? "  ⚠ low-confidence match, verify" : "";
        console.log(
          `  - ${li.product.title} ($${li.product.price.toFixed(2)}) x${li.qty}${flag}`
        );
      } else {
        console.log(`  - ${li.search}: ${li.note}`);
      }
    }
  }
  console.log(`\nWeek total: $${plan.weekTotal.toFixed(2)}`);
  if (plan.budget != null) {
    console.log(
      plan.overBudget
        ? `Over budget by $${Math.abs(plan.remaining).toFixed(2)}`
        : `Under budget by $${plan.remaining.toFixed(2)}`
    );
  }
}

program
  .name("hagplanid-tj")
  .description("Weekly meal planner powered by the Trader Joe's MCP server");

program
  .command("plan")
  .description("Build and print a priced weekly plan")
  .option("-r, --recipes <ids>", "comma-separated recipe ids")
  .option("-b, --budget <amount>", "target weekly budget in USD", parseFloat)
  .option("--auto", "auto-pick cheapest recipes to fit the budget")
  .option("--days <n>", "how many days to plan (with --auto)", (v) => parseInt(v, 10), 7)
  .option("--strategy <name>", "match strategy: best-match (default), cheapest, first", "best-match")
  .option("--debug", "print every candidate product and its relevance score per ingredient")
  .action(async (opts) => {
    const all = await loadRecipes();
    try {
      let plan;
      if (opts.auto) {
        if (!opts.budget) {
          console.error("--auto requires --budget");
          process.exit(1);
        }
        plan = await buildPlanWithinBudget(all, opts.budget, opts.days);
      } else {
        const recipes = pickRecipes(all, opts.recipes);
        plan = await buildWeeklyPlan(recipes, { budget: opts.budget, strategy: opts.strategy, debug: opts.debug });
      }
      printPlan(plan);
    } finally {
      await disconnect();
    }
  });

program
  .command("list")
  .description("Build a deduplicated shopping list for a set of recipes")
  .option("-r, --recipes <ids>", "comma-separated recipe ids")
  .option("-b, --budget <amount>", "target weekly budget in USD", parseFloat)
  .option("--strategy <name>", "match strategy: best-match (default), cheapest, first", "best-match")
  .option("--debug", "print every candidate product and its relevance score per ingredient")
  .action(async (opts) => {
    const all = await loadRecipes();
    try {
      const recipes = pickRecipes(all, opts.recipes);
      const plan = await buildWeeklyPlan(recipes, { budget: opts.budget, strategy: opts.strategy, debug: opts.debug });
      const list = buildShoppingList(plan);
      printShoppingList(list);
    } finally {
      await disconnect();
    }
  });

program
  .command("ics")
  .description("Export the week's dinners as an .ics calendar file")
  .option("-r, --recipes <ids>", "comma-separated recipe ids")
  .option("-o, --out <path>", "output file", "week-plan.ics")
  .option("--start <date>", "start date, YYYY-MM-DD (default: today)")
  .action(async (opts) => {
    const all = await loadRecipes();
    try {
      const recipes = pickRecipes(all, opts.recipes);
      const plan = await buildWeeklyPlan(recipes);
      const startDate = opts.start ? new Date(opts.start) : new Date();
      const ics = buildIcs(plan, { startDate });
      await writeFile(opts.out, ics, "utf-8");
      console.log(`Wrote ${opts.out}`);
    } finally {
      await disconnect();
    }
  });

program.parseAsync(process.argv);
