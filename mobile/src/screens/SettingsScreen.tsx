import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
import { useSettings } from "../context/SettingsContext";
import { makeApi, ApiError } from "../api";

export default function SettingsScreen() {
  const { backendUrl, apiKey, setBackendUrl, setApiKey } = useSettings();
  const [urlDraft, setUrlDraft] = useState(backendUrl);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setUrlDraft(backendUrl);
    setKeyDraft(apiKey);
  }, [backendUrl, apiKey]);

  async function handleSave() {
    await setBackendUrl(urlDraft.trim().replace(/\/$/, ""));
    await setApiKey(keyDraft.trim());
    Alert.alert("Saved", "Backend settings updated.");
  }

  async function handleTest() {
    setTesting(true);
    try {
      const api = makeApi(urlDraft.trim().replace(/\/$/, ""), keyDraft.trim());
      await api.getRecipes();
      Alert.alert("Success", "Connected to the backend and fetched recipes.");
    } catch (err) {
      Alert.alert("Connection failed", err instanceof ApiError ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Backend URL</Text>
      <TextInput
        style={styles.input}
        placeholder="http://192.168.1.23:3000"
        autoCapitalize="none"
        autoCorrect={false}
        value={urlDraft}
        onChangeText={setUrlDraft}
      />
      <Text style={styles.hint}>
        On a physical phone, "localhost" means the phone itself — use your computer's LAN
        IP address for local dev, or your hosted URL once deployed.
      </Text>

      <Text style={styles.label}>API key</Text>
      <TextInput
        style={styles.input}
        placeholder="only needed if your backend requires one"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={keyDraft}
        onChangeText={setKeyDraft}
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={handleTest} disabled={testing}>
        <Text style={styles.secondaryButtonText}>{testing ? "Testing…" : "Test connection"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
        <Text style={styles.primaryButtonText}>Save</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, gap: 6 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 16 },
  hint: { fontSize: 12, color: "#888", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
  },
  primaryButton: {
    backgroundColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0a7d3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  secondaryButtonText: { color: "#0a7d3a", fontWeight: "700", fontSize: 16 },
});
