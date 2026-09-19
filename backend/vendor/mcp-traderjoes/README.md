# Vendored & patched: @striderlabs/mcp-traderjoes

This is a locally patched copy of `@striderlabs/mcp-traderjoes@1.0.0`
(MIT licensed), not the version from npm.

## Why

The published package's GraphQL queries request:

```graphql
primary_image_meta { url caption }
```

Trader Joe's live schema no longer has a `caption` field on `ImageWithMeta`,
so every `search_products` / `get_product_details` call fails with:

```
Cannot query field "caption" on type "ImageWithMeta".
```

This copy removes `caption`, keeping just `url`.

A second, separate schema-drift error then showed up:

```
Cannot query field "fearless_flyer_applicable" on type "ProductInterface".
```

Rather than patch fields one at a time as they surface, this copy now
requests **only the fields the app actually reads** in `search_products` and
`get_product_details` (see `src/tjClient.js`'s `normalizeProduct`). Removed
entirely: `primary_image_meta`, `item_characteristics`,
`fearless_flyer_applicable` — none of these were used downstream anyway, so
dropping them removes both the immediate errors and future drift risk from
those fields. `fun_tags`, `category_hierarchy`, and `nutrition_facts`'
subfields are still requested since the app uses them — if TJ's schema drops
one of those next, the field list in this file's two GraphQL queries is the
first place to check.

The app itself is also more resilient now: a failed ingredient lookup (a
schema error, a network blip, etc.) is caught per-ingredient in
`mealPlanner.js` and shows up as a "lookup failed" note on that one line item
instead of crashing the whole plan.

## If this breaks again

TJ's schema isn't public/versioned, so it can drift again without notice.
If you hit a similar `Cannot query field "X" on type "Y"` error:

1. Find the offending field in this file's GraphQL query strings.
2. Remove it (or replace it with whatever the new schema calls it, if you
   can find that from browser devtools on traderjoes.com).
3. Re-run.

To check whether upstream has published a fix:

```bash
npm view @striderlabs/mcp-traderjoes versions
```

If a newer version exists, diff it against this file before switching back
to depending on the npm package directly.
