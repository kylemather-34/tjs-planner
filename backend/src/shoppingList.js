// shoppingList.js
//
// Collapses a weekly plan's line items into one shopping list, merging
// duplicate SKUs (e.g. "soy sauce" needed twice in the week) into a single
// entry with a combined quantity and price.

export function buildShoppingList(weeklyPlan) {
  const bySku = new Map();

  for (const day of weeklyPlan.days) {
    for (const li of day.lineItems) {
      if (!li.product) continue; // unmatched ingredient, nothing to add

      const key = li.product.sku;
      if (!bySku.has(key)) {
        bySku.set(key, {
          sku: li.product.sku,
          title: li.product.title,
          category: li.product.category?.[0] ?? "Other",
          unitPrice: li.product.price,
          qty: 0,
          total: 0,
          usedIn: [],
          lowConfidence: false,
        });
      }

      const entry = bySku.get(key);
      entry.qty += li.qty;
      entry.total = Math.round(entry.unitPrice * entry.qty * 100) / 100;
      entry.usedIn.push(day.recipe);
      if (li.lowConfidence) entry.lowConfidence = true;
    }
  }

  const items = [...bySku.values()].sort((a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
  );

  const grandTotal = Math.round(
    items.reduce((sum, i) => sum + i.total, 0) * 100
  ) / 100;

  return { items, grandTotal };
}

export function printShoppingList(list) {
  let lastCategory = null;
  for (const item of list.items) {
    if (item.category !== lastCategory) {
      console.log(`\n${item.category}`);
      lastCategory = item.category;
    }
    console.log(
      `  [ ] ${item.title}  x${item.qty}  $${item.total.toFixed(2)}` +
        `  (for: ${[...new Set(item.usedIn)].join(", ")})` +
        (item.lowConfidence ? "  ⚠ low-confidence match, verify" : "")
    );
  }
  console.log(`\nTotal: $${list.grandTotal.toFixed(2)}`);
}
