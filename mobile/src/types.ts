export interface Product {
  sku: string;
  title: string;
  price: number | null;
  size: string | null;
  uom: string | null;
  category: string[];
  tags: string[];
  image: string | null;
  isNew: boolean;
}

export interface RecipeIngredient {
  search: string;
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

export interface LineItem {
  search: string;
  qty: number;
  product: Product | null;
  lineTotal: number | null;
  note?: string;
  lowConfidence?: boolean;
}

export interface PlanDay {
  id: string;
  recipe: string;
  lineItems: LineItem[];
  dayTotal: number;
}

export interface WeeklyPlan {
  days: PlanDay[];
  weekTotal: number;
  budget: number | null;
  overBudget: boolean | null;
  remaining: number | null;
  skipped?: number;
}

export interface ShoppingListItem {
  sku: string;
  title: string;
  category: string;
  unitPrice: number;
  qty: number;
  total: number;
  usedIn: string[];
  lowConfidence: boolean;
}

export interface ShoppingList {
  items: ShoppingListItem[];
  grandTotal: number;
}

export interface SharedPlanPayload {
  plan: WeeklyPlan;
  shoppingList: ShoppingList | null;
  createdAt: string;
}
