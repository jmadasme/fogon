import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { formatCLP } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export function MenuItemCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}) {
  return (
    <View style={[styles.card, !item.available && { opacity: 0.55 }]}>
      <View style={styles.thumb}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} accessibilityLabel={item.name} alt="" />
        ) : (
          <Text style={{ fontSize: 28 }}>{item.emoji ?? "🍽️"}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {item.modifiers.length > 0 && (
            <View style={styles.custom}>
              <Text style={styles.customText}>Personalizable</Text>
            </View>
          )}
        </View>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.bottom}>
          <Text style={styles.price}>{formatCLP(item.price)}</Text>
          <Pressable
            onPress={() => onAdd(item)}
            disabled={!item.available}
            style={({ pressed }) => [
              styles.add,
              { opacity: !item.available ? 0.4 : pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.addText}>
              {item.available ? "Agregar" : "Agotado"}
            </Text>
            {item.available && <Ionicons name="add" size={14} color={colors.text} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  custom: {
    backgroundColor: "rgba(132,142,156,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customText: { color: colors.muted, fontSize: 8, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  price: { color: colors.text, fontSize: 14, fontWeight: "800" },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addText: { color: colors.text, fontSize: 11, fontWeight: "700" },
});
