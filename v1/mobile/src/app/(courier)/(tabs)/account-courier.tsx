import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { API_URL, WEB_URL } from "@/lib/config";
import { vehicleLabel } from "@/lib/format";
import type { CourierDashboard } from "@/lib/types";
import { Button, Card, PageHeader } from "@/components/ui";

export default function CourierAccountScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<CourierDashboard | null>(null);

  useEffect(() => {
    if (!token) return;
    api<CourierDashboard>("/api/courier", { token })
      .then(setDashboard)
      .catch(() => {});
  }, [token]);

  const initials = (user?.name ?? "F")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={{ padding: spacing.lg }}>
        <PageHeader
          title="Mi cuenta"
          subtitle="Tus datos, verificación y herramientas de reparto."
        />

        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.role}>
            <Ionicons name="bicycle-outline" size={12} color={colors.primary} />
            <Text style={styles.roleText}>Repartidor Fogón</Text>
          </View>
          {dashboard && (
            <Text style={styles.meta}>
              {vehicleLabel(dashboard.courier.vehicle)} · Zona{" "}
              {dashboard.courier.zone ?? "sin zona"} ·{" "}
              {dashboard.courier.verificationStatus === "VERIFIED"
                ? "Verificado"
                : "En revisión"}
            </Text>
          )}
        </Card>

        <Card style={{ marginTop: spacing.sm, padding: 0 }}>
          <LinkRow
            icon="bicycle-outline"
            label="Mi ruta"
            onPress={() => router.push("/route")}
          />
          <LinkRow
            icon="wallet-outline"
            label="Ganancias"
            onPress={() => router.push("/earnings")}
          />
          <LinkRow
            icon="shield-checkmark-outline"
            label="Verificación KYC"
            hint="Identidad y liveness en la web de Fogón"
            onPress={() => Linking.openURL(`${WEB_URL}/kyc`)}
          />
          <LinkRow
            icon="lock-closed-outline"
            label="Seguridad de la cuenta"
            hint="MFA, email y teléfono"
            onPress={() => Linking.openURL(`${WEB_URL}/settings/security`)}
          />
          <LinkRow
            icon="help-circle-outline"
            label="Soporte Fogón"
            onPress={() => Linking.openURL(`${WEB_URL}/soporte`)}
          />
        </Card>

        <Card style={{ marginTop: spacing.sm }}>
          <Text style={styles.section}>Conexión</Text>
          <Text style={styles.muted}>{API_URL}</Text>
          <Text style={styles.version}>Fogón Mobile · 1.0.0</Text>
        </Card>

        <Button
          title="Cerrar sesión"
          variant="danger"
          onPress={handleLogout}
          icon="log-out-outline"
          style={{ marginTop: spacing.md }}
        />
      </View>
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        {hint ? <Text style={styles.linkHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(240,185,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(240,185,11,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: spacing.sm },
  email: { color: colors.muted, fontSize: 12, marginTop: 2 },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(240,185,11,0.3)",
    backgroundColor: "rgba(240,185,11,0.08)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: { color: colors.primary, fontSize: 9, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 10, marginTop: spacing.sm, textAlign: "center" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  linkLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  linkHint: { color: colors.muted, fontSize: 9, marginTop: 2 },
  section: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 10 },
  version: { color: colors.muted, fontSize: 9, marginTop: spacing.sm },
});
