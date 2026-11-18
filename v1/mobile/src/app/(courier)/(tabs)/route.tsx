import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCLP, timeAgo, vehicleLabel } from "@/lib/format";
import type { CourierDashboard, CourierOrder } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  LoadingScreen,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/ui";

export default function CourierRouteScreen() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<CourierDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinOrder, setPinOrder] = useState<CourierOrder | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      if (refresh) setRefreshing(true);
      try {
        const data = await api<CourierDashboard>("/api/courier", { token });
        setDashboard(data);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos cargar tu ruta.");
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
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!token || !["AVAILABLE", "BUSY"].includes(dashboard?.courier.status ?? "")) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted" || cancelled) return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 50,
        },
        (position) => {
          api("/api/courier/location", {
            method: "POST",
            token,
            body: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          }).catch(() => {});
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [token, dashboard?.courier.status]);

  const verified = dashboard?.courier.verificationStatus === "VERIFIED";

  async function toggleOnline() {
    if (!token || !dashboard) return;
    if (!verified) {
      Alert.alert("Cuenta en revisión", "Aún estamos verificando tus datos.");
      return;
    }
    const next = dashboard.courier.status === "OFFLINE" ? "AVAILABLE" : "OFFLINE";
    setBusy("status");
    try {
      await api("/api/courier/status", {
        method: "POST",
        token,
        body: { status: next },
      });
      await load();
    } catch (caught) {
      Alert.alert(
        "No pudimos cambiar tu estado",
        caught instanceof Error ? caught.message : "Intenta de nuevo.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateOrder(
    order: { id: string },
    status: string,
    deliveryPin?: string,
  ) {
    if (!token) return;
    setBusy(order.id);
    setPinError(null);
    try {
      await api(`/api/orders/${order.id}`, {
        method: "PATCH",
        token,
        body: { status, pin: deliveryPin },
      });
      setPinOrder(null);
      setPin("");
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No pudimos actualizar.";
      if (deliveryPin) setPinError(message);
      else Alert.alert("No pudimos actualizar el pedido", message);
    } finally {
      setBusy(null);
    }
  }

  function openRoute(lat: number, lng: number) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(
      () => {},
    );
  }

  const active = dashboard?.active ?? null;

  if (loading) return <LoadingScreen label="Cargando tu ruta…" />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PANEL REPARTIDOR</Text>
            <Text style={styles.title}>Hola, {dashboard?.courier.name.split(" ")[0]}</Text>
            <Text style={styles.subtitle}>
              {dashboard?.courier.zone ? `Zona ${dashboard.courier.zone} · ` : ""}
              {dashboard?.courier.rating.toFixed(1)} ★ ·{" "}
              {vehicleLabel(dashboard?.courier.vehicle ?? "")}
            </Text>
          </View>
          <Pressable
            onPress={toggleOnline}
            disabled={busy === "status"}
            style={[
              styles.onlineButton,
              dashboard?.courier.status === "AVAILABLE" && styles.onlineActive,
            ]}
          >
            <Ionicons
              name="power"
              size={16}
              color={
                dashboard?.courier.status === "AVAILABLE"
                  ? colors.primaryInk
                  : colors.primary
              }
            />
            <Text
              style={[
                styles.onlineText,
                dashboard?.courier.status === "AVAILABLE" && {
                  color: colors.primaryInk,
                },
              ]}
            >
              {dashboard?.courier.status === "AVAILABLE"
                ? "Conectado"
                : dashboard?.courier.status === "BUSY"
                  ? "En entrega"
                  : "Conectarme"}
            </Text>
          </Pressable>
        </View>

        {!verified && (
          <Card style={styles.warningCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Cuenta en revisión</Text>
              <Text style={styles.muted}>
                Estamos verificando tus datos. Podrás conectarte cuando esté activa.
              </Text>
            </View>
          </Card>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <StatCard
            label="Hoy"
            value={formatCLP(dashboard?.earnings.today ?? 0)}
            hint={`${dashboard?.earnings.deliveriesToday ?? 0} entregas`}
            icon="wallet-outline"
            tone={colors.success}
          />
          <StatCard
            label="Semana"
            value={formatCLP(dashboard?.earnings.week ?? 0)}
            hint={`${dashboard?.earnings.deliveriesWeek ?? 0} entregas`}
            icon="bicycle-outline"
            tone={colors.primary}
          />
        </View>

        {active ? (
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Entrega activa" action={<StatusPill status={active.status} />} />
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <Text style={styles.code}>{active.code}</Text>
                <Text style={styles.payout}>{formatCLP(active.courierPayout)}</Text>
              </View>
              <View style={styles.routeBlock}>
                <View style={styles.routePoint}>
                  <View style={[styles.point, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>RETIRO</Text>
                    <Text style={styles.routeTitle}>{active.store.name}</Text>
                    <Text style={styles.muted}>
                      {active.store.address}, {active.store.comuna}
                    </Text>
                    <Text style={styles.distance}>{active.distanceToStore} km desde ti</Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.point, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>ENTREGA</Text>
                    <Text style={styles.routeTitle}>{active.customer.name}</Text>
                    <Text style={styles.muted}>
                      {active.addressLine}, {active.comuna}
                    </Text>
                    {active.instructions ? (
                      <Text style={styles.italic}>“{active.instructions}”</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {active.customer.phone && (
                  <Button
                    title="Llamar"
                    variant="secondary"
                    icon="call-outline"
                    onPress={() =>
                      Linking.openURL(`tel:${active.customer.phone}`).catch(() => {})
                    }
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title="Ruta"
                  variant="secondary"
                  icon="navigate-outline"
                  onPress={() => openRoute(active.lat, active.lng)}
                  style={{ flex: 1 }}
                />
              </View>

              {active.status === "COURIER_ASSIGNED" && (
                <Button
                  title="Confirmar retiro en local"
                  icon="bag-check-outline"
                  loading={busy === active.id}
                  onPress={() => updateOrder(active, "PICKED_UP")}
                />
              )}
              {active.status === "PICKED_UP" && (
                <Button
                  title="Confirmar entrega"
                  variant="success"
                  icon="checkmark-circle-outline"
                  onPress={() => {
                    setPin("");
                    setPinError(null);
                    setPinOrder(active);
                  }}
                />
              )}
            </Card>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle
              title="Pedidos disponibles"
              action={
                <Text style={styles.muted}>
                  {dashboard?.available.length ?? 0} cerca
                </Text>
              }
            />
            {dashboard?.available.length ? (
              dashboard.available.map((order, index) => (
                <Card key={order.id} style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.code}>{order.code}</Text>
                      <Text style={styles.storeName}>{order.store.name}</Text>
                      <Text style={styles.muted}>
                        {order.store.comuna} · {order.comuna}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.payout}>{formatCLP(order.courierPayout)}</Text>
                      {index === 0 && <Text style={styles.closest}>Más cercano</Text>}
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.distance}>{order.distanceToStore} km al local</Text>
                    <Text style={styles.muted}>{order.distanceKm} km de entrega</Text>
                    <Text style={styles.muted}>{timeAgo(order.createdAt)}</Text>
                  </View>
                  <Button
                    title="Aceptar pedido"
                    icon="arrow-forward"
                    loading={busy === order.id}
                    onPress={() => updateOrder(order, "COURIER_ASSIGNED")}
                  />
                </Card>
              ))
            ) : (
              <EmptyState
                icon="bicycle-outline"
                title={
                  dashboard?.courier.status === "OFFLINE"
                    ? "Conéctate para recibir pedidos"
                    : "Esperando pedidos"
                }
                description={
                  dashboard?.courier.status === "OFFLINE"
                    ? "Pulsa Conectarme y te avisaremos cuando haya una entrega cerca."
                    : "No hay pedidos disponibles ahora. Te avisaremos en cuanto aparezca uno."
                }
              />
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(pinOrder)} transparent animationType="slide" onRequestClose={() => setPinOrder(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPinOrder(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>PIN de entrega</Text>
            <Text style={styles.muted}>Pídele al cliente el código de 4 dígitos.</Text>
            <TextInput
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.muted}
              style={styles.pinInput}
              autoFocus
            />
            {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
            <Button
              title="Confirmar entrega"
              variant="success"
              loading={busy === pinOrder?.id}
              disabled={pin.length !== 4}
              onPress={() => pinOrder && updateOrder(pinOrder, "DELIVERED", pin)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.9, marginTop: 3 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  onlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(240,185,11,0.4)",
    backgroundColor: "rgba(240,185,11,0.08)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  onlineActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  onlineText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  warningCard: {
    flexDirection: "row",
    gap: spacing.sm,
    borderColor: "rgba(240,185,11,0.25)",
    backgroundColor: "rgba(240,185,11,0.05)",
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
  warningTitle: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  error: { color: colors.danger, fontSize: 11, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  code: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  payout: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  storeName: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 1 },
  closest: {
    color: colors.success,
    fontSize: 8,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: "rgba(14,203,129,0.3)",
    backgroundColor: "rgba(14,203,129,0.1)",
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  distance: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  routeBlock: { gap: 4 },
  routePoint: { flexDirection: "row", gap: spacing.sm },
  point: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  routeLabel: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  routeTitle: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 1 },
  routeLine: { width: 1, height: 18, backgroundColor: colors.border, marginLeft: 5 },
  italic: { color: colors.muted, fontSize: 10, fontStyle: "italic", marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 34,
    gap: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  pinInput: {
    borderWidth: 1,
    borderColor: "rgba(240,185,11,0.35)",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    color: colors.primary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 12,
    textAlign: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
});
