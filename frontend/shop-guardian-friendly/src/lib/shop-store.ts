import { useEffect, useState } from "react";
import { setAuthToken, getStoredAuthToken, getMe, type UserProfile, type ShopData } from "./api";

export type Avatar = "male" | "female" | "family";
export type SystemState = "running" | "empty" | "detected" | "offline" | "stopped";
export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "emerald" | "purple" | "amber" | "rose";
export type DensityMode = "comfortable" | "compact";

export interface ShopConfig {
  shopName: string;
  ownerName: string;
  shopType: string;
  language: string;
  avatar: Avatar;
  onboarded: boolean;

  // Appearance
  theme: ThemeMode;
  accentColor: AccentColor;
  density: DensityMode;
  animations: boolean;
  statusPulse: boolean;

  // Notifications & Sound
  alertSound: boolean;
  securitySound: boolean;
  cameraDisconnectAlert: boolean;
  browserNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Detection Preferences
  personDetection: boolean;
  entryDetection: boolean;
  occupancyDetection: boolean;
  confidenceThreshold: number;
  showBoxes: boolean;
  showZones: boolean;
}

const KEY = "shopguardian:config:v2";

export const accentColorMap: Record<AccentColor, { label: string; brand: string; brandSoft: string }> = {
  blue: { label: "Ocean Blue", brand: "oklch(0.58 0.22 262)", brandSoft: "oklch(0.96 0.04 262)" },
  emerald: { label: "Emerald Green", brand: "oklch(0.62 0.2 150)", brandSoft: "oklch(0.95 0.05 150)" },
  purple: { label: "Royal Purple", brand: "oklch(0.58 0.22 300)", brandSoft: "oklch(0.96 0.04 300)" },
  amber: { label: "Sunset Amber", brand: "oklch(0.68 0.18 65)", brandSoft: "oklch(0.96 0.05 65)" },
  rose: { label: "Rose Crimson", brand: "oklch(0.62 0.22 15)", brandSoft: "oklch(0.96 0.04 15)" },
};

const defaultConfig: ShopConfig = {
  shopName: "",
  ownerName: "",
  shopType: "",
  language: "en",
  avatar: "male",
  onboarded: false,

  theme: "light",
  accentColor: "blue",
  density: "comfortable",
  animations: true,
  statusPulse: true,

  alertSound: true,
  securitySound: true,
  cameraDisconnectAlert: true,
  browserNotifications: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",

  personDetection: true,
  entryDetection: true,
  occupancyDetection: true,
  confidenceThreshold: 0.35,
  showBoxes: true,
  showZones: true,
};

export function applyThemeAndAccent(cfg: ShopConfig) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.documentElement;

  // 1. Theme application (Light / Dark / System)
  const isDark =
    cfg.theme === "dark" ||
    (cfg.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Accent color application
  const accent = accentColorMap[cfg.accentColor] || accentColorMap.blue;
  root.style.setProperty("--brand", accent.brand);
  root.style.setProperty("--brand-soft", accent.brandSoft);
  root.style.setProperty("--primary", accent.brand);
  root.style.setProperty("--ring", accent.brand);

  // 3. Animation preference
  if (!cfg.animations) {
    root.classList.add("reduce-motion");
  } else {
    root.classList.remove("reduce-motion");
  }
}

export function readConfig(): ShopConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const token = getStoredAuthToken();
    if (!token) return defaultConfig;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    const merged = { ...defaultConfig, ...parsed };
    applyThemeAndAccent(merged);
    return merged;
  } catch {
    return defaultConfig;
  }
}

export function writeConfig(cfg: ShopConfig) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(cfg));
    applyThemeAndAccent(cfg);
    window.dispatchEvent(new CustomEvent("shopguardian:config"));
  }
}

export function clearSession() {
  setAuthToken(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem("shopguardian_token");
    applyThemeAndAccent(defaultConfig);
    window.dispatchEvent(new CustomEvent("shopguardian:config"));
  }
}

export function useShopConfig() {
  const [cfg, setCfg] = useState<ShopConfig>(() => readConfig());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyThemeAndAccent(cfg);

    async function initAuth() {
      const token = getStoredAuthToken();
      if (!token) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(KEY);
        }
        setCfg(defaultConfig);
        applyThemeAndAccent(defaultConfig);
        setUser(null);
        setShop(null);
        setLoading(false);
        setReady(true);
        return;
      }

      try {
        const res = await getMe();
        setUser(res.user);
        if (res.shop && res.shop.shop_name) {
          setShop(res.shop);
          const nextCfg: ShopConfig = {
            ...readConfig(),
            shopName: res.shop.shop_name,
            ownerName: res.user.full_name || res.user.username,
            shopType: res.shop.shop_type || "General Retail",
            onboarded: true,
          };
          setCfg(nextCfg);
          writeConfig(nextCfg);
        } else {
          setShop(null);
          setCfg({ ...readConfig(), onboarded: false });
        }
      } catch (err) {
        console.error("Session restore failed:", err);
        clearSession();
        setUser(null);
        setShop(null);
        setCfg(defaultConfig);
      } finally {
        setLoading(false);
        setReady(true);
      }
    }

    initAuth();

    const handler = () => {
      const token = getStoredAuthToken();
      if (!token) {
        setCfg(defaultConfig);
        applyThemeAndAccent(defaultConfig);
        setUser(null);
        setShop(null);
      } else {
        const current = readConfig();
        setCfg(current);
        applyThemeAndAccent(current);
      }
    };
    window.addEventListener("shopguardian:config", handler);
    return () => window.removeEventListener("shopguardian:config", handler);
  }, []);

  const updateCfg = (c: ShopConfig) => {
    writeConfig(c);
    setCfg(c);
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setShop(null);
    setCfg(defaultConfig);
  };

  return {
    cfg,
    setCfg: updateCfg,
    user,
    setUser,
    shop,
    setShop,
    loading,
    ready,
    logout,
  };
}

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}
export function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}
export function formatWeekday(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}