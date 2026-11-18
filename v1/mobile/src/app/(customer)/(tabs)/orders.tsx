import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCLP, formatDate } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";
import { EmptyState, LoadingScreen, PageHeader, StatusPill } from "@/components/ui";

export default function OrdersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      if (refresh) setRefreshing(true);
      try {
        const data = await api<{ orders: OrderSummary[] }>("/api/mobile/orders", {
          token,
        });
        setOrders(data.orders);
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

  if (loading) return <LoadingScreen label="Cargando pedidos…" />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <PageHeader
            title="Mis pedidos"
            subtitle="Sigue tus pedidos y vuelve a pedir tus favoritos."
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Todavía no tienes pedidos"
            description={error ?? "Cuando hagas tu primer pedido aparecerá aquí."}
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
          <Pressable
            onPress={() => router.push(`/order/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.icon}>
              <Text style={{ fontSize: 23 }}>{item.store.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.store.name}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.meta}>
                {item.code} · {item.itemCount} {item.itemCount === 1 ? "producto" : "productos"}
              </Text>
              <Text style={styles.meta}>
                {formatDate(item.createdAt)} · {item.deliveryMode === "PICKUP" ? "Retiro" : "Delivery"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={styles.total}>{formatCLP(item.total)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  card: {
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
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 10 },
  total: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
