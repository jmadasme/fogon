import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { formatCLP } from "@/lib/format";
import { useCart } from "@/lib/cart";

export function CartBar() {
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (cart.count === 0) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 8 }]}>
      <Pressable
        onPress={() => router.push("/checkout")}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.count}>
          <Text style={styles.countText}>{cart.count}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Ver pedido</Text>
          <Text style={styles.subtotal}>{formatCLP(cart.subtotal)}</Text>
        </View>
        <Text style={styles.action}>Ir a pagar</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.primaryInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.md, right: spacing.md },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  count: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(11,14,17,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
  label: { color: colors.primaryInk, fontSize: 11, fontWeight: "600", opacity: 0.8 },
  subtotal: { color: colors.primaryInk, fontSize: 15, fontWeight: "800" },
  action: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
});
