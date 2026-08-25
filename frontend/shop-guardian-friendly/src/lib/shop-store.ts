import { useEffect, useState } from "react";
import { setAuthToken, getStoredAuthToken, getMe, type UserProfile, type ShopData } from "./api";

export type Avatar = "male" | "female" | "family";
export type SystemState = "running" | "empty" | "detected" | "offline" | "stopped";

export interface ShopConfig {
  shopName: string;
  ownerName: string;
  shopType: string;
  language: string;
  avatar: Avatar;
  onboarded: boolean;
}

const KEY = "shopguardian:config:v2";

const defaultConfig: ShopConfig = {
  shopName: "",
  ownerName: "",
  shopType: "",
  language: "en",
  avatar: "male",
  onboarded: false,
};

export function readConfig(): ShopConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultConfig;
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
}

export function writeConfig(cfg: ShopConfig) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent("shopguardian:config"));
  }
}

export function clearSession() {
  setAuthToken(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem("shopguardian_token");
    window.dispatchEvent(new CustomEvent("shopguardian:config"));
  }
}

export function useShopConfig() {
  const [cfg, setCfg] = useState<ShopConfig>(defaultConfig);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initAuth() {
      const token = getStoredAuthToken();
      if (!token) {
        setCfg(defaultConfig);
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
      setCfg(readConfig());
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