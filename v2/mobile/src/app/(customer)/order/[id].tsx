import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  formatCLP,
  paymentLabel,
  vehicleLabel,
} from "@/lib/format";
import type { Order } from "@/lib/types";
import { OrderTimeline } from "@/components/OrderTimeline";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  LoadingScreen,
  PageHeader,
  StatusPill,
  Stars,
} from "@/components/ui";

type ModifierSnapshot = { id: string; name: string; priceDelta: number };

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      const data = await api<Order>(`/api/orders/${id}`, { token });
      setOrder(data);
      setReviewed(data.reviewed);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos cargar el pedido.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function cancelOrder() {
    if (!order || !token) return;
    Alert.alert("Cancelar pedido", "¿Seguro que quieres cancelar este pedido?", [
      { text: "Volver", style: "cancel" },
      {
        text: "Cancelar pedido",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/api/orders/${order.id}`, {
              method: "PATCH",
              token,
              body: {
                status: "CANCELLED_BY_CUSTOMER",
                reason: "Cancelado desde la app",
              },
            });
            await load();
          } catch (caught) {
            Alert.alert(
              "No pudimos cancelar",
              caught instanceof Error ? caught.message : "Intenta de nuevo.",
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function submitReview() {
    if (!order || !token) return;
    setBusy(true);
    try {
      await api("/api/reviews", {
        method: "POST",
        token,
        body: {
          orderId: order.id,
          rating,
          comment: comment.trim() || undefined,
        },
      });
      setReviewed(true);
      Alert.alert("Gracias", "Tu calificación quedó registrada.");
    } catch (caught) {
      Alert.alert(
        "No pudimos calificar",
        caught instanceof Error ? caught.message : "Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openRoute(lat: number, lng: number) {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    ).catch(() => {});
  }

  if (loading) return <LoadingScreen label="Cargando pedido…" />;

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={{ padding: spacing.lg }}>
          <PageHeader title="Pedido" back />
          <EmptyState
            icon="receipt-outline"
            title="No encontramos el pedido"
            description={error ?? "Vuelve a tus pedidos."}
            action={<Button title="Mis pedidos" onPress={() => router.replace("/orders")} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  const showPin =
    order.deliveryPin &&
    ["COURIER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.status);
  const cancelled =
    order.status.startsWith("CANCELLED") || ["REFUNDED", "EXPIRED"].includes(order.status);
  const delivered = ["DELIVERED", "COMPLETED"].includes(order.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={cancelled ? "Pedido no completado" : delivered ? "¡Buen provecho!" : "Tu pedido"}
          subtitle={`${order.code} · ${order.store.name}`}
          back
          right={<StatusPill status={order.status} />}
        />

        <Card style={{ marginTop: spacing.sm }}>
          <OrderTimeline status={order.status} />
        </Card>

        {showPin && (
          <Card style={styles.pinCard}>
            <Text style={styles.pinLabel}>PIN DE ENTREGA</Text>
            <Text style={styles.pinHint}>Dale este código al repartidor.</Text>
            <View style={styles.pinRow}>
              {order.deliveryPin!.split("").map((digit, index) => (
                <View key={`${digit}-${index}`} style={styles.pinDigit}>
                  <Text style={styles.pinText}>{digit}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {order.courier && (
          <Card style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={styles.courierIcon}>
              <Ionicons name="bicycle" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courierName}>{order.courier?.name}</Text>
              <Text style={styles.muted}>
                {vehicleLabel(order.courier?.vehicle ?? "")} ·{" "}
                {(order.courier?.rating ?? 0).toFixed(1)} ★
              </Text>
            </View>
            {order.courier?.phone && (
              <Pressable
                onPress={() =>
                  Linking.openURL(`tel:${order.courier?.phone}`).catch(() => {})
                }
                style={styles.iconButton}
              >
                <Ionicons name="call-outline" size={18} color={colors.text} />
              </Pressable>
            )}
          </Card>
        )}

        <Card style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <Text style={styles.section}>
            {order.deliveryMode === "PICKUP" ? "Retiro" : "Entrega"}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Ionicons
              name={order.deliveryMode === "PICKUP" ? "storefront-outline" : "location-outline"}
              size={18}
              color={colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>
                {order.deliveryMode === "PICKUP" ? order.store.name : order.addressLine}
              </Text>
              <Text style={styles.muted}>
                {order.deliveryMode === "PICKUP"
                  ? `${order.store.address}, ${order.store.comuna}`
                  : order.comuna}
              </Text>
              {order.instructions ? (
                <Text style={styles.italic}>“{order.instructions}”</Text>
              ) : null}
            </View>
          </View>
          {order.deliveryMode === "DELIVERY" && !cancelled && (
            <Button
              title="Abrir ruta en mapas"
              variant="secondary"
              icon="navigate-outline"
              onPress={() => openRoute(order.lat, order.lng)}
            />
          )}
        </Card>

        <Card style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <Text style={styles.section}>Pedido</Text>
          {order.items.map((item) => {
            let modifiers: ModifierSnapshot[] = [];
            try {
              modifiers = item.modifiersJson ? JSON.parse(item.modifiersJson) : [];
            } catch {
              modifiers = [];
            }
            return (
              <View key={item.id} style={{ gap: 2 }}>
                <View style={styles.row}>
                  <Text style={styles.body} numberOfLines={2}>
                    {item.quantity} × {item.name}
                  </Text>
                  <Text style={styles.body}>
                    {formatCLP(item.unitPrice * item.quantity)}
                  </Text>
                </View>
                {modifiers.length > 0 && (
                  <Text style={styles.muted}>
                    {modifiers.map((modifier) => modifier.name).join(" · ")}
                  </Text>
                )}
                {item.notes ? <Text style={styles.italic}>“{item.notes}”</Text> : null}
              </View>
            );
          })}
          <Divider />
          <SummaryRow label="Subtotal" value={formatCLP(order.subtotal)} />
          {order.deliveryMode === "DELIVERY" && (
            <SummaryRow label={`Envío (${order.distanceKm} km)`} value={formatCLP(order.deliveryFee)} />
          )}
          {order.deliveryMode === "DELIVERY" && (
            <SummaryRow label="Servicio" value={formatCLP(order.serviceFee)} />
          )}
          <SummaryRow label="Propina" value={formatCLP(order.tip)} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCLP(order.total)}</Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.sm, gap: 4 }}>
          <Text style={styles.section}>Pago</Text>
          <View style={styles.row}>
            <Text style={styles.muted}>
              {order.paymentProvider === "CASH"
                ? "Efectivo al recibir"
                : order.paymentProvider === "FLOW"
                  ? "Flow (Webpay / MACH)"
                  : order.paymentProvider === "TRANSBANK"
                    ? "Webpay / Transbank"
                    : order.paymentProvider === "MERCADOPAGO"
                      ? "Mercado Pago"
                      : "Pago demo"}
            </Text>
            <Text style={styles.bodyStrong}>{paymentLabel(order.paymentStatus)}</Text>
          </View>
          <Text style={styles.muted}>
            {order.paymentStatus === "PAID"
              ? "Pago confirmado."
              : order.paymentStatus === "CANCELLED"
                ? "No se realizó ningún cobro."
                : order.paymentProvider === "CASH"
                  ? "El repartidor cobrará al entregar."
                  : order.paymentProvider === "FLOW"
                    ? "Pago online pendiente. Se confirmará en segundos."
                    : "Pago pendiente de confirmación."}
          </Text>
        </Card>

        {order.canCancel && (
          <Button
            title="Cancelar pedido"
            variant="danger"
            onPress={cancelOrder}
            loading={busy}
            style={{ marginTop: spacing.md }}
          />
        )}

        {order.canReview && !reviewed && (
          <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Text style={styles.section}>¿Cómo estuvo?</Text>
            <Text style={styles.muted}>Tu calificación ayuda a la cocina local.</Text>
            <Stars value={rating} onChange={setRating} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Cuéntanos qué tal estuvo…"
              placeholderTextColor={colors.muted}
              style={styles.textarea}
              multiline
              maxLength={500}
            />
            <Button title="Enviar calificación" onPress={submitReview} loading={busy} />
          </Card>
        )}

        {reviewed && (
          <Card style={{ marginTop: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.body}>Ya calificaste este pedido. ¡Gracias!</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { color: colors.text, fontSize: 16, fontWeight: "800" },
  body: { color: colors.text, fontSize: 12 },
  bodyStrong: { color: colors.text, fontSize: 13, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  italic: { color: colors.muted, fontSize: 11, fontStyle: "italic", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingVertical: 2 },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "800" },
  totalValue: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  pinCard: {
    marginTop: spacing.sm,
    borderColor: "rgba(240,185,11,0.35)",
    backgroundColor: "rgba(240,185,11,0.06)",
    alignItems: "center",
    gap: spacing.xs,
  },
  pinLabel: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  pinHint: { color: colors.muted, fontSize: 11 },
  pinRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  pinDigit: {
    width: 42,
    height: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(240,185,11,0.4)",
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  pinText: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  courierIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(240,185,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  courierName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    color: colors.text,
    padding: spacing.md,
    fontSize: 13,
    textAlignVertical: "top",
  },
});
