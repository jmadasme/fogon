import Constants from "expo-constants";
import { Platform } from "react-native";

const isDev = __DEV__;

function trim(value: string) {
  return value.replace(/\/$/, "");
}

function deriveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    if (!isDev && !configured.startsWith("https://")) {
      throw new Error(
        "EXPO_PUBLIC_API_URL debe usar HTTPS en producción.",
      );
    }
    return trim(configured);
  }

  if (!isDev) {
    throw new Error(
      "EXPO_PUBLIC_API_URL es obligatoria en builds de producción.",
    );
  }

  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host) return `http://${host}:3000`;
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

function deriveWebUrl(apiUrl: string) {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  const value = configured ? trim(configured) : apiUrl;
  if (!isDev && !value.startsWith("https://")) {
    throw new Error("EXPO_PUBLIC_WEB_URL debe usar HTTPS en producción.");
  }
  return value;
}

export const API_URL = deriveApiUrl();
export const WEB_URL = deriveWebUrl(API_URL);
