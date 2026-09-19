import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useSettings } from "../context/SettingsContext";
import { makeApi, ApiError } from "../api";

type Props = NativeStackScreenProps<RootStackParamList, "JoinShared">;

export default function JoinSharedScreen({ navigation }: Props) {
  const { backendUrl, apiKey } = useSettings();
  const api = makeApi(backendUrl, apiKey);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const result = await api.getSharedPlan(code.trim());
      navigation.navigate("Plan", { sharedPlan: result.plan, readOnly: true });
    } catch (err) {
      Alert.alert(
        "Couldn't find that plan",
        err instanceof ApiError ? err.message : "Double-check the code and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Join a shared plan</Text>
      <Text style={styles.subtitle}>Enter the 6-character code a friend sent you.</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 5GR4TB"
        autoCapitalize="characters"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Loading…" : "View plan"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#666", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
