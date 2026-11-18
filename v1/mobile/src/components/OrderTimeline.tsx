import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";

const STEPS = [
  { title: "Pedido recibido", description: "El local confirmó tu pedido" },
  { title: "En preparación", description: "La cocina está trabajando" },
  { title: "Listo", description: "Empacado y esperando repartidor" },
  { title: "En camino", description: "Tu pedido va hacia ti" },
  { title: "Entregado", description: "Pedido entregado" },
];

function stepFor(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
    case "PENDING_MERCHANT":
      return 0;
    case "ACCEPTED":
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    case "PENDING_COURIER":
    case "COURIER_ASSIGNED":
    case "PICKED_UP":
    case "OUT_FOR_DELIVERY":
      return 3;
    case "DELIVERED":
    case "COMPLETED":
      return STEPS.length;
    default:
      return -1;
  }
}

export function OrderTimeline({ status }: { status: string }) {
  const current = stepFor(status);

  if (status.startsWith("CANCELLED") || ["REFUNDED", "EXPIRED"].includes(status)) {
    return (
      <View style={styles.cancel}>
        <Ionicons name="close-circle" size={20} color={colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cancelTitle}>Pedido no completado</Text>
          <Text style={styles.cancelText}>
            Este pedido no se completó. Si tienes dudas, contacta a soporte.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === STEPS.length - 1;
        return (
          <View key={step.title} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={13} color={colors.success} />
                ) : active ? (
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                ) : (
                  <Text style={styles.dotNumber}>{index + 1}</Text>
                )}
              </View>
              {!last && (
                <View style={[styles.line, done && styles.lineDone]} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.md }}>
              <Text
                style={[
                  styles.title,
                  active && { color: colors.text },
                  !done && !active && { color: colors.muted },
                ]}
              >
                {step.title}
              </Text>
              <Text style={styles.description}>{step.description}</Text>
              {active && (
                <View style={styles.activeRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>En curso</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  rail: { alignItems: "center", width: 28 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { borderColor: "rgba(14,203,129,0.4)", backgroundColor: "rgba(14,203,129,0.12)" },
  dotActive: { borderColor: "rgba(240,185,11,0.5)", backgroundColor: "rgba(240,185,11,0.12)" },
  dotNumber: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  line: { width: 1, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
  lineDone: { backgroundColor: "rgba(14,203,129,0.3)" },
  title: { color: colors.text, fontSize: 13, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 11, marginTop: 1 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  activeText: { color: colors.primary, fontSize: 9, fontWeight: "700" },
  cancel: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(246,70,93,0.25)",
    backgroundColor: "rgba(246,70,93,0.06)",
    borderRadius: 12,
    padding: spacing.md,
  },
  cancelTitle: { color: "#FF7A8A", fontSize: 13, fontWeight: "700" },
  cancelText: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 16 },
});
