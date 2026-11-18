import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCLP, formatDate } from "@/lib/format";
import { EmptyState, LoadingScreen, PageHeader, StatCard } from "@/components/ui";

type Earnings = {
  summary: {
    total: number;
    base: number;
    tips: number;
    deliveries: number;
    average: number;
  };
  orders: {
    id: string;
    code: string;
    deliveredAt?: string | null;
    courierPayout: number;
    tip: number;
    total: number;
    store: { name: string; emoji: string; comuna: string };
  }[];
};

export default function CourierEarningsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      if (refresh) setRefreshing(true);
      try {
        const result = await api<Earnings>("/api/mobile/courier/earnings", { token });
        setData(result);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos cargar.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) return <LoadingScreen label="Cargando ganancias…" />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={data?.orders ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Ganancias"
              subtitle="Últimos 30 días de entregas completadas."
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              <StatCard
                label="Total"
                value={formatCLP(data?.summary.total ?? 0)}
                hint={`${data?.summary.deliveries ?? 0} entregas`}
                icon="wallet-outline"
                tone={colors.success}
              />
              <StatCard
                label="Promedio"
                value={formatCLP(data?.summary.average ?? 0)}
                hint="Por entrega"
                icon="trending-up-outline"
                tone={colors.primary}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              <StatCard
                label="Base"
                value={formatCLP(data?.summary.base ?? 0)}
                icon="bicycle-outline"
                tone={colors.text}
              />
              <StatCard
                label="Propinas"
                value={formatCLP(data?.summary.tips ?? 0)}
                icon="cash-outline"
                tone={colors.success}
              />
            </View>
            <Text style={styles.section}>Detalle de entregas</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title="Aún no tienes entregas"
            description={error ?? "Cuando completes una entrega, verás el detalle aquí."}
          />
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.icon}>
              <Text style={{ fontSize: 20 }}>{item.store.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.store}>{item.store.name}</Text>
              <Text style={styles.muted}>
                {item.deliveredAt ? formatDate(item.deliveredAt) : "Entregado"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.total}>{formatCLP(item.total)}</Text>
              <Text style={styles.muted}>propina {formatCLP(item.tip)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  code: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  store: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 1 },
  muted: { color: colors.muted, fontSize: 10, marginTop: 1 },
  total: { color: colors.primary, fontSize: 14, fontWeight: "800" },
});
