import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity, Text } from "react-native";

import { SettingsProvider } from "./src/context/SettingsContext";
import RecipesScreen from "./src/screens/RecipesScreen";
import PlanScreen from "./src/screens/PlanScreen";
import ShoppingListScreen from "./src/screens/ShoppingListScreen";
import JoinSharedScreen from "./src/screens/JoinSharedScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import type { WeeklyPlan, ShoppingList } from "./src/types";

export type RootStackParamList = {
  Recipes: undefined;
  Plan: {
    recipeIds?: string[];
    auto?: boolean;
    budget?: number;
    days?: number;
    sharedPlan?: WeeklyPlan;
    readOnly?: boolean;
  };
  ShoppingList: { plan: WeeklyPlan; list?: ShoppingList };
  JoinShared: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SettingsProvider>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Recipes">
          <Stack.Screen
            name="Recipes"
            component={RecipesScreen}
            options={({ navigation }) => ({
              title: "Hagplanið TJ",
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate("JoinShared")} style={{ marginRight: 12 }}>
                  <Text style={{ color: "#0a7d3a", fontWeight: "600" }}>Join</Text>
                </TouchableOpacity>
              ),
              headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={{ marginLeft: -8 }}>
                  <Text style={{ color: "#0a7d3a", fontWeight: "600" }}>Settings</Text>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen name="Plan" component={PlanScreen} options={{ title: "Weekly Plan" }} />
          <Stack.Screen
            name="ShoppingList"
            component={ShoppingListScreen}
            options={{ title: "Shopping List" }}
          />
          <Stack.Screen
            name="JoinShared"
            component={JoinSharedScreen}
            options={{ title: "Join a Plan", presentation: "modal" }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SettingsProvider>
  );
}
