// tjClient.js
//
// Thin wrapper around the @striderlabs/mcp-traderjoes MCP server.
// We talk to it exactly the way Claude Desktop or any other MCP host would:
// spawn it as a subprocess over stdio, call its tools, and parse the JSON
// text it returns.
//
// The underlying server proxies Trader Joe's own storefront GraphQL API
// (traderjoes.com/api/graphql), so results reflect live catalog data,
// including retail_price and nutrition_facts. It is NOT an official/public
// API — it can change or break without notice.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We run a locally vendored, patched copy of @striderlabs/mcp-traderjoes
// (vendor/mcp-traderjoes/index.js) instead of the published npm package.
// The published version's GraphQL queries request a `caption` field on
// ImageWithMeta that Trader Joe's schema no longer has, which makes every
// call fail with "Cannot query field \"caption\" on type \"ImageWithMeta\"".
// See vendor/mcp-traderjoes/README.md for details. If TJ's schema drifts
// again, re-pull the package, diff it against the vendored copy, and patch
// forward.
const SERVER_PATH = path.join(__dirname, "..", "vendor", "mcp-traderjoes", "index.cjs");

let client = null;
let transport = null;

/** Start the MCP server subprocess and connect a client to it. Call once. */
export async function connect() {
  if (client) return client;

  transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
  });

  client = new Client(
    { name: "hagplanid-tj", version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  return client;
}

/** Cleanly shut down the subprocess. Call when your program exits. */
export async function disconnect() {
  if (transport) {
    await transport.close();
    client = null;
    transport = null;
  }
}

/** Call an MCP tool and parse the JSON text it returns. */
async function callTool(name, args) {
  const c = await connect();
  const res = await c.callTool({ name, arguments: args });

  if (res.isError) {
    const msg = res.content?.[0]?.text ?? "unknown MCP error";
    throw new Error(`MCP tool "${name}" failed: ${msg}`);
  }

  const text = res.content?.[0]?.text;
  if (!text) throw new Error(`MCP tool "${name}" returned no content`);

  const parsed = JSON.parse(text);

  // The server forwards raw GraphQL responses. Surface GraphQL-level errors.
  if (parsed.errors?.length) {
    throw new Error(
      `Trader Joe's API error: ${parsed.errors.map((e) => e.message).join("; ")}`
    );
  }

  return parsed.data;
}

/**
 * Search Trader Joe's products by keyword.
 * Returns an array of { sku, title, price, size, uom, tags, category, image, isNew }
 */
export async function searchProducts(query, pageSize = 10) {
  const data = await callTool("search_products", { query, page_size: pageSize });
  const items = data?.products?.items ?? [];
  return items.map(normalizeProduct);
}

/**
 * Get full detail for one SKU: ingredients, nutrition_facts, allergens, directions,
 * plus everything searchProducts returns.
 */
export async function getProductDetails(sku) {
  const data = await callTool("get_product_details", { sku });
  const item = data?.products?.items?.[0];
  if (!item) throw new Error(`No product found for SKU ${sku}`);
  return {
    ...normalizeProduct(item),
    ingredients: item.ingredients ?? null,
    allergens: item.allergens ?? null,
    directions: item.directions ?? null,
    nutrition: item.nutrition_facts ?? null,
  };
}

/** Find stores near a US ZIP code. */
export async function findStores(zip, radius = 25) {
  const data = await callTool("find_stores", { zip, radius });
  const items = data?.storeSearch?.items ?? [];
  return items.map((s) => ({
    storeCode: s.storeCode,
    name: s.storeName,
    address: [s.addressLine1, s.addressLine2].filter(Boolean).join(", "),
    city: s.city,
    state: s.state,
    zip: s.zip,
    phone: s.phone,
    hours: s.hours,
  }));
}

/** New / featured products, optionally filtered by category. */
export async function getNewProducts(category) {
  const data = await callTool("get_new_products", category ? { category } : {});
  const items = data?.products?.items ?? [];
  return items.map(normalizeProduct);
}

function normalizeProduct(item) {
  return {
    sku: item.sku,
    title: item.item_title,
    price: toNumber(item.retail_price),
    size: item.sales_size ?? null,
    uom: item.sales_uom_description ?? null,
    category: item.category_hierarchy?.map((c) => c.name) ?? [],
    tags: item.fun_tags ?? [],
    image: item.primary_image ?? null,
    isNew: item.new_product === "1" || item.new_product === true,
  };
}

function toNumber(price) {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const n = Number(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
