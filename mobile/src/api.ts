import type { Recipe, WeeklyPlan, ShoppingList, SharedPlanPayload } from "./types";

export class ApiError extends Error {}

async function request<T>(
  backendUrl: string,
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiError(message);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  return res.text() as unknown as T;
}

export function makeApi(backendUrl: string, apiKey: string) {
  return {
    getRecipes: () => request<Recipe[]>(backendUrl, apiKey, "/api/recipes"),

    addRecipe: (recipe: Omit<Recipe, "id">) =>
      request<Recipe>(backendUrl, apiKey, "/api/recipes", {
        method: "POST",
        body: JSON.stringify(recipe),
      }),

    buildPlan: (opts: {
      recipeIds?: string[];
      auto?: boolean;
      budget?: number;
      days?: number;
      strategy?: string;
    }) =>
      request<WeeklyPlan>(backendUrl, apiKey, "/api/plan", {
        method: "POST",
        body: JSON.stringify(opts),
      }),

    buildShoppingList: (plan: WeeklyPlan) =>
      request<ShoppingList>(backendUrl, apiKey, "/api/shopping-list", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),

    getCalendarIcs: (plan: WeeklyPlan, startDate?: string) =>
      request<string>(backendUrl, apiKey, "/api/calendar", {
        method: "POST",
        body: JSON.stringify({ plan, startDate }),
      }),

    sharePlan: (plan: WeeklyPlan, shoppingList?: ShoppingList | null) =>
      request<{ code: string }>(backendUrl, apiKey, "/api/share", {
        method: "POST",
        body: JSON.stringify({ plan, shoppingList }),
      }),

    getSharedPlan: (code: string) =>
      request<SharedPlanPayload>(backendUrl, apiKey, `/api/share/${code}`),

    findStores: (zip: string) =>
      request<unknown[]>(backendUrl, apiKey, `/api/stores?zip=${encodeURIComponent(zip)}`),
  };
}

export type Api = ReturnType<typeof makeApi>;
