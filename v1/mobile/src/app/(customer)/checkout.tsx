import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { SANTIAGO_COMUNAS, COMUNA_BY_NAME } from "@/lib/communes";
import { calculateFees, distanceForComuna } from "@/lib/pricing";
import { formatCLP } from "@/lib/format";
import { Button, Card, Chip, EmptyState, Input, LoadingScreen, PageHeader } from "@/components/ui";

type Address = {
  id: string;
  label: string;
  line1: string;
  comuna: string;
  instructions?: string | null;
  isDefault: boolean;
};

export default function CheckoutScreen() {
  const { user, token } = useAuth();
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requestIdRef = useRef<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [line1, setLine1] = useState("");
  const [comuna, setComuna] = useState(cart.store?.comuna ?? "Santiago");
  const [instructions, setInstructions] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [tipChoice, setTipChoice] = useState("1000");
  const [customTip, setCustomTip] = useState("");
  const [payment, setPayment] = useState<"CASH" | "MERCADOPAGO">("CASH");
  const [communeModal, setCommuneModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestIdRef.current) {
      requestIdRef.current = `mobile-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ addresses: Address[] }>("/api/mobile/addresses", { token })
      .then((data) => {
        setAddresses(data.addresses);
        const preferred = data.addresses.find((address) => address.isDefault) ?? data.addresses[0];
        if (preferred) {
          setLine1(preferred.line1);
          setComuna(preferred.comuna);
          setInstructions(preferred.instructions ?? "");
        }
      })
      .catch(() => {});
  }, [token]);

  const tip = useMemo(() => {
    if (tipChoice === "custom") {
      return Math.min(10000, Math.max(0, Number(customTip) || 0));
    }
    return Number(tipChoice);
  }, [tipChoice, customTip]);

  const selectedComuna = COMUNA_BY_NAME.get(comuna);
  const fees = useMemo(() => {
    if (!cart.store) {
      return calculateFees({ subtotal: 0, distanceKm: 0, deliveryMode, tip });
    }
    const distance = selectedComuna
      ? distanceForComuna(
          { lat: cart.store.lat, lng: cart.store.lng, comuna: cart.store.comuna },
          selectedComuna,
        )
      : 2.4;
    return calculateFees({
      subtotal: cart.subtotal,
      distanceKm: distance,
      deliveryMode,
      tip,
    });
  }, [cart.store, cart.subtotal, selectedComuna, deliveryMode, tip]);

  const belowMinimum = Boolean(cart.store && cart.subtotal < cart.store.minOrder);

  async function submit() {
    if (!cart.store || !user || !token) return;
    setError(null);
    if (deliveryMode === "DELIVERY" && !line1.trim()) {
      setError("Ingresa tu dirección de entrega.");
      return;
    }
    if (deliveryMode === "DELIVERY" && !selectedComuna) {
      setError("Selecciona una comuna válida.");
      return;
    }
    if (belowMinimum) {
      setError(`El pedido mínimo de este local es ${formatCLP(cart.store.minOrder)}.`);
      return;
    }

    setLoading(true);
    try {
      const data = await api<{
        orderId: string;
        redirectUrl?: string;
        error?: string;
      }>("/api/orders", {
        method: "POST",
        token,
        body: {
          storeId: cart.store.id,
          clientRequestId: requestIdRef.current ?? undefined,
          items: cart.items.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            modifierOptionIds: line.modifiers.map((modifier) => modifier.id),
            notes: line.notes,
          })),
          deliveryMode,
          address:
            deliveryMode === "DELIVERY"
              ? {
                  line1: line1.trim(),
                  comuna,
                  instructions: instructions.trim() || undefined,
                }
              : undefined,
          tip,
          paymentProvider: payment,
          customerName: user.name,
          customerPhone: user.phone ?? undefined,
        },
      });

      await cart.clearCart();
      if (data.redirectUrl) {
        Linking.openURL(data.redirectUrl).catch(() => {});
      }
      router.replace(`/order/${data.orderId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  if (!cart.isReady) return <LoadingScreen label="Preparando checkout…" />;

  if (!cart.store || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={{ padding: spacing.lg }}>
          <PageHeader title="Checkout" back />
          <EmptyState
            icon="bag-outline"
            title="Tu carrito está vacío"
            description="Agrega platos de una cocina para continuar."
            action={<Button title="Ver cocinas" onPress={() => router.replace("/home")} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + 120,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <PageHeader
            title="Confirma tu pedido"
            subtitle={`${cart.store.name} · ${cart.store.comuna}`}
            back
          />

          <Card style={{ gap: spacing.sm }}>
            <Text style={styles.section}>1. ¿Cómo lo recibes?</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setDeliveryMode("DELIVERY")}
                style={[
                  styles.mode,
                  deliveryMode === "DELIVERY" && styles.modeActive,
                ]}
              >
                <Ionicons name="bicycle-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Delivery</Text>
                  <Text style={styles.modeHint}>
                    {formatCLP(fees.deliveryFee)} · {fees.distanceKm} km
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setDeliveryMode("PICKUP")}
                style={[styles.mode, deliveryMode === "PICKUP" && styles.modeActive]}
              >
                <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>Retiro</Text>
                  <Text style={styles.modeHint}>Sin costo</Text>
                </View>
              </Pressable>
            </View>
          </Card>

          {deliveryMode === "DELIVERY" && (
            <Card style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Text style={styles.section}>2. Dirección</Text>
              {addresses.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {addresses.map((address) => (
                      <Chip
                        key={address.id}
                        label={`${address.label} · ${address.comuna}`}
                        selected={line1 === address.line1 && comuna === address.comuna}
                        onPress={() => {
                          setLine1(address.line1);
                          setComuna(address.comuna);
                          setInstructions(address.instructions ?? "");
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
              )}
              <Input
                label="Calle y número"
                value={line1}
                onChangeText={setLine1}
                placeholder="Av. Irarrázaval 1234, depto 56"
              />
              <Pressable onPress={() => setCommuneModal(true)} style={styles.select}>
                <View>
                  <Text style={styles.selectLabel}>Comuna</Text>
                  <Text style={styles.selectValue}>{comuna}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
              <Input
                label="Instrucciones para el repartidor"
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Timbre, portón, conserjería…"
              />
            </Card>
          )}

          <Card style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Text style={styles.section}>{deliveryMode === "DELIVERY" ? "3" : "2"}. Pago</Text>
            <Pressable
              onPress={() => setPayment("CASH")}
              style={[styles.payment, payment === "CASH" && styles.paymentActive]}
            >
              <Ionicons name="cash-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>Efectivo al recibir</Text>
                <Text style={styles.modeHint}>Paga al repartidor cuando llegue.</Text>
              </View>
              {payment === "CASH" && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setPayment("MERCADOPAGO")}
              style={[styles.payment, payment === "MERCADOPAGO" && styles.paymentActive]}
            >
              <Ionicons name="card-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>Pago online</Text>
                <Text style={styles.modeHint}>
                  Se abre la pasarela en el navegador (demo/sandbox).
                </Text>
              </View>
              {payment === "MERCADOPAGO" && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </Pressable>

            <Text style={[styles.label, { marginTop: spacing.sm }]}>Propina</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {["0", "500", "1000", "1500"].map((value) => (
                <Chip
                  key={value}
                  label={value === "0" ? "Sin propina" : formatCLP(Number(value))}
                  selected={tipChoice === value}
                  onPress={() => setTipChoice(value)}
                />
              ))}
              <Chip
                label="Otro"
                selected={tipChoice === "custom"}
                onPress={() => setTipChoice("custom")}
              />
            </View>
            {tipChoice === "custom" && (
              <TextInput
                value={customTip}
                onChangeText={setCustomTip}
                keyboardType="number-pad"
                placeholder="Monto en CLP"
                placeholderTextColor={colors.muted}
                style={styles.smallInput}
              />
            )}
          </Card>

          <Card style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <Text style={styles.section}>Resumen</Text>
            {cart.items.map((line) => (
              <View key={line.key} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {line.quantity} × {line.name}
                </Text>
                <Text style={styles.rowValue}>
                  {formatCLP(line.unitPrice * line.quantity)}
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <SummaryRow label="Subtotal" value={formatCLP(fees.subtotal)} />
            {deliveryMode === "DELIVERY" && (
              <SummaryRow label={`Envío (${fees.distanceKm} km)`} value={formatCLP(fees.deliveryFee)} />
            )}
            {deliveryMode === "DELIVERY" && (
              <SummaryRow label="Servicio" value={formatCLP(fees.serviceFee)} />
            )}
            <SummaryRow label="Propina" value={formatCLP(fees.tip)} />
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCLP(fees.total)}</Text>
            </View>
            {belowMinimum && (
              <Text style={styles.warning}>
                El pedido mínimo es {formatCLP(cart.store.minOrder)}. Agrega{" "}
                {formatCLP(cart.store.minOrder - cart.subtotal)} más.
              </Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={`Pagar ${formatCLP(fees.total)}`}
              onPress={submit}
              loading={loading}
              disabled={belowMinimum}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.note}>
              {payment === "CASH"
                ? "El repartidor cobrará al entregar. La propina es 100% para él."
                : "Si el pago se completa, el pedido pasa a la cocina automáticamente."}
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={communeModal} transparent animationType="slide" onRequestClose={() => setCommuneModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCommuneModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Elige tu comuna</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {SANTIAGO_COMUNAS.map((item) => (
                <Pressable
                  key={item.name}
                  onPress={() => {
                    setComuna(item.name);
                    setCommuneModal(false);
                  }}
                  style={[
                    styles.communeRow,
                    comuna === item.name && { borderColor: colors.primary },
                  ]}
                >
                  <Text style={styles.communeName}>{item.name}</Text>
                  {comuna === item.name && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 2 },
  mode: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  modeActive: { borderColor: "rgba(240,185,11,0.45)", backgroundColor: "rgba(240,185,11,0.08)" },
  modeTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  modeHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  payment: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  paymentActive: { borderColor: "rgba(240,185,11,0.45)", backgroundColor: "rgba(240,185,11,0.08)" },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  selectLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  selectValue: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  smallInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    color: colors.text,
    padding: spacing.sm,
    maxWidth: 140,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingVertical: 3 },
  rowLabel: { color: colors.muted, fontSize: 12, flex: 1 },
  rowValue: { color: colors.text, fontSize: 12, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: "800" },
  totalValue: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  warning: { color: colors.danger, fontSize: 11, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 11, marginTop: spacing.xs },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 34,
  },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginBottom: spacing.md },
  communeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: 6,
  },
  communeName: { color: colors.text, fontSize: 13 },
});
