import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useSettings } from "../context/SettingsContext";
import { makeApi, ApiError } from "../api";
import type { ShoppingList, ShoppingListItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ShoppingList">;

export default function ShoppingListScreen({ route }: Props) {
  const { plan, list: preloadedList } = route.params;
  const { backendUrl, apiKey } = useSettings();
  const api = makeApi(backendUrl, apiKey);

  const [list, setList] = useState<ShoppingList | null>(preloadedList ?? null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!preloadedList);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloadedList) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setList(await api.buildShoppingList(plan));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't build the shopping list.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(sku: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !list) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "No shopping list."}</Text>
      </SafeAreaView>
    );
  }

  const sections = groupByCategory(list.items);

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.sku}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isChecked = checked.has(item.sku);
          return (
            <TouchableOpacity style={styles.row} onPress={() => toggle(item.sku)}>
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, isChecked && styles.itemTitleChecked]}>
                  {item.title} {item.qty > 1 ? `x${item.qty}` : ""}
                </Text>
                <Text style={styles.itemSub}>
                  for: {[...new Set(item.usedIn)].join(", ")}
                  {item.lowConfidence ? "  ⚠ verify this match" : ""}
                </Text>
              </View>
              <Text style={styles.itemPrice}>${item.total.toFixed(2)}</Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${list.grandTotal.toFixed(2)}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function groupByCategory(items: ShoppingListItem[]) {
  const map = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }
  return [...map.entries()].map(([title, data]) => ({ title, data }));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { textAlign: "center", color: "#b00020" },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0a7d3a",
  },
  checkboxChecked: { backgroundColor: "#0a7d3a" },
  itemTitle: { fontSize: 15, fontWeight: "600" },
  itemTitleChecked: { textDecorationLine: "line-through", color: "#999" },
  itemSub: { fontSize: 12, color: "#888", marginTop: 2 },
  itemPrice: { fontSize: 14, color: "#333" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 16, fontWeight: "700" },
});
