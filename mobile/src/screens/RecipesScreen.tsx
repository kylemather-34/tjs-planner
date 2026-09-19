import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useSettings } from "../context/SettingsContext";
import { makeApi, ApiError } from "../api";
import type { Recipe } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Recipes">;

export default function RecipesScreen({ navigation }: Props) {
  const { backendUrl, apiKey } = useSettings();
  const api = makeApi(backendUrl, apiKey);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIngredients, setNewIngredients] = useState("");

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecipes(await api.getRecipes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend. Check Settings.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, apiKey]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToPlan() {
    if (selected.size === 0) {
      Alert.alert("Pick at least one recipe", "Tap a few recipes first, then build the plan.");
      return;
    }
    navigation.navigate("Plan", {
      recipeIds: [...selected],
      budget: budget ? Number(budget) : undefined,
    });
  }

  async function handleAddRecipe() {
    const ingredients = newIngredients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((search) => ({ search, qty: 1 }));

    if (!newName.trim() || ingredients.length === 0) {
      Alert.alert("Missing info", "Give the recipe a name and at least one ingredient.");
      return;
    }

    try {
      const created = await api.addRecipe({ name: newName.trim(), servings: 4, ingredients });
      setRecipes((prev) => [...prev, created]);
      setNewName("");
      setNewIngredients("");
      setAddingOpen(false);
    } catch (err) {
      Alert.alert("Couldn't add recipe", err instanceof ApiError ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRecipes}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
          <Text style={styles.link}>Go to Settings</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.title}>This week's recipes</Text>
            <TouchableOpacity onPress={() => setAddingOpen((v) => !v)}>
              <Text style={styles.link}>{addingOpen ? "Cancel" : "+ Add recipe"}</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          addingOpen ? (
            <View style={styles.addForm}>
              <TextInput
                style={styles.input}
                placeholder="Recipe name"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder="Ingredients, comma separated (e.g. lavash bread, barbecue sauce, pineapple)"
                value={newIngredients}
                onChangeText={setNewIngredients}
                multiline
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddRecipe}>
                <Text style={styles.primaryButtonText}>Save recipe</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.recipeRow, isSelected && styles.recipeRowSelected]}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeName}>{item.name}</Text>
                <Text style={styles.recipeSub}>
                  {item.ingredients.length} ingredients · serves {item.servings}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.bottomBar}>
        <TextInput
          style={styles.budgetInput}
          placeholder="Weekly budget (optional)"
          keyboardType="decimal-pad"
          value={budget}
          onChangeText={setBudget}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={goToPlan}>
          <Text style={styles.primaryButtonText}>
            Build plan ({selected.size} selected)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "700" },
  link: { color: "#0a7d3a", fontWeight: "600" },
  errorText: { textAlign: "center", color: "#b00020" },
  retryButton: {
    backgroundColor: "#0a7d3a",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: { color: "#fff", fontWeight: "600" },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  recipeRowSelected: { backgroundColor: "#eef8f1" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0a7d3a",
  },
  checkboxChecked: { backgroundColor: "#0a7d3a" },
  recipeName: { fontSize: 16, fontWeight: "600" },
  recipeSub: { fontSize: 13, color: "#666", marginTop: 2 },
  addForm: { padding: 16, gap: 8, backgroundColor: "#fafafa" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  bottomBar: {
    padding: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  budgetInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
  },
  primaryButton: {
    backgroundColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
