import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { formatCLP } from "@/lib/format";
import type { Store } from "@/lib/types";

export function StoreCard({
  store,
  onPress,
}: {
  store: Store;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cover}>
        {store.coverUrl ? (
          <Image source={{ uri: store.coverUrl }} style={StyleSheet.absoluteFill} accessibilityLabel={`Portada de ${store.name}`} alt="" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
            <Text style={{ fontSize: 38 }}>{store.emoji}</Text>
          </View>
        )}
        <View style={styles.coverOverlay} />
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineText}>
            {store.emoji} {store.cuisine}
          </Text>
        </View>
        <View style={styles.coverText}>
          <Text style={styles.name} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.comuna}>{store.comuna}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="star" size={13} color={colors.primary} />
          <Text style={styles.metaValue}>{store.rating.toFixed(1)}</Text>
          <Text style={styles.metaMuted}>({store.ratingCount})</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.metaMuted}>
            {store.prepTimeMin}–{store.prepTimeMin + 10} min
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="bicycle-outline" size={14} color={colors.muted} />
          <Text style={styles.metaMuted}>{formatCLP(store.deliveryFeeFrom)}</Text>
        </View>
      </View>
      {store.minOrder > 0 && (
        <Text style={styles.minOrder}>
          Pedido mínimo {formatCLP(store.minOrder)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  cover: { height: 150, backgroundColor: colors.surface2 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  coverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,14,17,0.18)",
  },
  cuisineBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cuisineText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  coverText: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.sm },
  name: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  comuna: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaValue: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  metaMuted: { color: colors.muted, fontSize: 10 },
  minOrder: {
    color: colors.muted,
    fontSize: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 4,
  },
});
