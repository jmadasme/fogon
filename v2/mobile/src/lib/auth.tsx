import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, ApiError } from "./api";
import type { User } from "./types";

const TOKEN_KEY = "fogon_mobile_token";

async function readToken() {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    // sessionStorage en vez de localStorage: el token no persiste en disco
    // entre sesiones del navegador (docs/30, MEDIA-10). El preview web no es
    // un entorno productivo; en nativo se usa Keychain/Keystore.
    return window.sessionStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    // Para una PWA real conviene cookie httpOnly o un
    // backend-for-frontend. En nativo se usa Keychain/Keystore.
    if (typeof window !== "undefined") window.sessionStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function removeToken() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    try {
      const stored = await readToken();
      if (!stored) return;
      const data = await api<{ user: User }>("/api/mobile/me", { token: stored });
      setToken(stored);
      setUser(data.user);
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        await removeToken();
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restore();
  }, [restore]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>(
      "/api/mobile/auth/login",
      {
        method: "POST",
        body: { email, password },
      },
    );
    await saveToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await api("/api/mobile/auth/logout", { method: "POST", token }).catch(
        () => {},
      );
    }
    await removeToken();
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const data = await api<{ user: User }>("/api/mobile/me", { token });
    setUser(data.user);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshUser }),
    [user, token, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
