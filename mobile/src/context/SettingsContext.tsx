import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Settings {
  backendUrl: string;
  apiKey: string;
}

interface SettingsContextValue extends Settings {
  loaded: boolean;
  setBackendUrl: (url: string) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
}

const DEFAULTS: Settings = {
  // Sensible default for local dev: iOS Simulator can reach your Mac's
  // localhost directly. A physical phone on the same Wi-Fi network needs
  // your Mac's LAN IP instead (e.g. http://192.168.1.23:3000) — change this
  // in the Settings screen once you know it, or once you have a hosted URL.
  backendUrl: "http://localhost:3000",
  apiKey: "",
};

const STORAGE_KEY = "hagplanid-tj:settings";

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .finally(() => setLoaded(true));
  }, []);

  async function persist(next: Settings) {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const value: SettingsContextValue = {
    ...settings,
    loaded,
    setBackendUrl: (backendUrl) => persist({ ...settings, backendUrl }),
    setApiKey: (apiKey) => persist({ ...settings, apiKey }),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside a SettingsProvider");
  return ctx;
}
