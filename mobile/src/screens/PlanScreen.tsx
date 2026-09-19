import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  SafeAreaView,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useSettings } from "../context/SettingsContext";
import { makeApi, ApiError } from "../api";
import type { WeeklyPlan } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Plan">;

export default function PlanScreen({ route, navigation }: Props) {
  const { recipeIds, auto, budget, days, sharedPlan, readOnly } = route.params ?? {};
  const { backendUrl, apiKey } = useSettings();
  const api = makeApi(backendUrl, apiKey);

  const [plan, setPlan] = useState<WeeklyPlan | null>(sharedPlan ?? null);
  const [loading, setLoading] = useState(!sharedPlan);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (sharedPlan) return; // already have the plan, nothing to fetch
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.buildPlan({ recipeIds, auto, budget, days });
        setPlan(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't build the plan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [backendUrl, apiKey]);

  async function handleExportCalendar() {
    if (!plan) return;
    try {
      const ics = await api.getCalendarIcs(plan);
      const fileUri = `${FileSystem.cacheDirectory}week-plan.ics`;
      await FileSystem.writeAsStringAsync(fileUri, ics, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/calendar", dialogTitle: "Add to calendar" });
      } else {
        Alert.alert("Saved", `Calendar file saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert("Couldn't export calendar", err instanceof ApiError ? err.message : String(err));
    }
  }

  async function handleSharePlan() {
    if (!plan) return;
    setSharing(true);
    try {
      const shoppingList = await api.buildShoppingList(plan);
      const { code } = await api.sharePlan(plan, shoppingList);
      await Share.share({
        message: `Check out this week's meal plan — open the app, go to "Join a shared plan", and enter code: ${code}`,
      });
    } catch (err) {
      Alert.alert("Couldn't share plan", err instanceof ApiError ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.dim}>Talking to Trader Joe's…</Text>
      </SafeAreaView>
    );
  }

  if (error || !plan) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "No plan to show."}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {plan.days.map((day) => (
          <View key={day.id} style={styles.dayCard}>
            <View style={styles.dayHeaderRow}>
              <Text style={styles.dayTitle}>{day.recipe}</Text>
              <Text style={styles.dayTotal}>${day.dayTotal.toFixed(2)}</Text>
            </View>
            {day.lineItems.map((li, i) => (
              <View key={i} style={styles.lineItemRow}>
                <Text style={styles.lineItemText}>
                  {li.product ? `${li.product.title} x${li.qty}` : `${li.search}: ${li.note ?? "no match"}`}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {li.lowConfidence && <Text style={styles.warningBadge}>⚠</Text>}
                  {li.product?.price != null && (
                    <Text style={styles.lineItemPrice}>${li.product.price.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Week total</Text>
          <Text style={styles.totalValue}>${plan.weekTotal.toFixed(2)}</Text>
          {plan.budget != null && (
            <Text style={plan.overBudget ? styles.overBudget : styles.underBudget}>
              {plan.overBudget
                ? `Over budget by $${Math.abs(plan.remaining ?? 0).toFixed(2)}`
                : `Under budget by $${(plan.remaining ?? 0).toFixed(2)}`}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("ShoppingList", { plan })}
        >
          <Text style={styles.primaryButtonText}>View shopping list</Text>
        </TouchableOpacity>

        {!readOnly && (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleExportCalendar}>
              <Text style={styles.secondaryButtonText}>Add week to calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSharePlan}
              disabled={sharing}
            >
              <Text style={styles.secondaryButtonText}>
                {sharing ? "Sharing…" : "Share with friends"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10 },
  dim: { color: "#666" },
  errorText: { textAlign: "center", color: "#b00020" },
  dayCard: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 14,
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayTitle: { fontSize: 17, fontWeight: "700" },
  dayTotal: { fontSize: 17, fontWeight: "700", color: "#0a7d3a" },
  lineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  lineItemText: { flex: 1, fontSize: 14, color: "#333" },
  lineItemPrice: { fontSize: 14, color: "#555" },
  warningBadge: { color: "#b8860b" },
  totalCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  totalLabel: { fontSize: 14, color: "#666" },
  totalValue: { fontSize: 28, fontWeight: "800" },
  overBudget: { color: "#b00020", fontWeight: "600" },
  underBudget: { color: "#0a7d3a", fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#0a7d3a", fontWeight: "700", fontSize: 16 },
});
