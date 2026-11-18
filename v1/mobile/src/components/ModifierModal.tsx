import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { formatCLP } from "@/lib/format";
import type { MenuItem, Modifier } from "@/lib/types";
import { Button, QuantityStepper } from "./ui";

export type ModifierSelection = {
  id: string;
  name: string;
  priceDelta: number;
};

export function ModifierModal({
  visible,
  item,
  onClose,
  onAdd,
}: {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (payload: {
    quantity: number;
    modifiers: ModifierSelection[];
    notes?: string;
  }) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    const defaults: Record<string, string[]> = {};
    for (const modifier of item.modifiers) {
      if (modifier.required && modifier.min > 0) {
        defaults[modifier.id] = modifier.options
          .slice(0, Math.max(1, modifier.min))
          .map((option) => option.id);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(defaults);
    setNotes("");
    setQuantity(1);
    setError(null);
  }, [visible, item]);

  const selectedModifiers = useMemo(() => {
    if (!item) return [];
    return item.modifiers.flatMap((modifier) => {
      const ids = selection[modifier.id] ?? [];
      return modifier.options
        .filter((option) => ids.includes(option.id))
        .map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        }));
    });
  }, [item, selection]);

  if (!item) return null;

  const unitPrice =
    item.price + selectedModifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);

  function toggle(modifier: Modifier, optionId: string) {
    setError(null);
    setSelection((current) => {
      const ids = current[modifier.id] ?? [];
      if (modifier.type === "SINGLE") {
        return { ...current, [modifier.id]: [optionId] };
      }
      if (ids.includes(optionId)) {
        return { ...current, [modifier.id]: ids.filter((id) => id !== optionId) };
      }
      if (ids.length >= modifier.max) {
        setError(`Hasta ${modifier.max} opciones en ${modifier.name}.`);
        return current;
      }
      return { ...current, [modifier.id]: [...ids, optionId] };
    });
  }

  function submit() {
    if (!item) return;
    for (const modifier of item.modifiers) {
      const count = (selection[modifier.id] ?? []).length;
      if (count < modifier.min) {
        setError(`Elige al menos ${modifier.min} opción(es) en ${modifier.name}.`);
        return;
      }
      if (count > modifier.max) {
        setError(`Elige hasta ${modifier.max} opción(es) en ${modifier.name}.`);
        return;
      }
    }
    onAdd({
      quantity,
      modifiers: selectedModifiers,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.description}>{item.description}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {item.modifiers.map((modifier) => (
              <View key={modifier.id} style={{ marginTop: spacing.md }}>
                <View style={styles.modifierHeader}>
                  <Text style={styles.modifierName}>{modifier.name}</Text>
                  <Text style={styles.modifierHint}>
                    {modifier.required ? "Obligatorio" : "Opcional"}
                    {modifier.max > 1 ? ` · hasta ${modifier.max}` : ""}
                  </Text>
                </View>
                {modifier.options.map((option) => {
                  const checked = (selection[modifier.id] ?? []).includes(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => toggle(modifier, option.id)}
                      style={[styles.option, checked && styles.optionChecked]}
                    >
                      <View style={styles.optionLeft}>
                        <View style={[styles.check, checked && styles.checkChecked]}>
                          {checked && (
                            <Ionicons name="checkmark" size={13} color={colors.primaryInk} />
                          )}
                        </View>
                        <Text style={styles.optionName}>{option.name}</Text>
                      </View>
                      <Text style={styles.optionPrice}>
                        {option.priceDelta > 0 ? `+${formatCLP(option.priceDelta)}` : "Incluido"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Text style={[styles.label, { marginTop: spacing.md }]}>Notas para la cocina</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Sin cebolla, salsa aparte…"
              placeholderTextColor={colors.muted}
              style={styles.notes}
              multiline
              maxLength={240}
            />
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <View style={{ flex: 1 }}>
              <Button
                title={`Agregar · ${formatCLP(unitPrice * quantity)}`}
                onPress={submit}
                icon="add"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 34,
    maxHeight: "92%",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface3,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  description: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  modifierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  modifierName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  modifierHint: { color: colors.muted, fontSize: 9, textTransform: "uppercase", fontWeight: "700" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginTop: 5,
  },
  optionChecked: { borderColor: "rgba(240,185,11,0.45)", backgroundColor: "rgba(240,185,11,0.08)" },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  check: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionName: { color: colors.text, fontSize: 13 },
  optionPrice: { color: colors.muted, fontSize: 11 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  notes: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    color: colors.text,
    padding: spacing.md,
    fontSize: 13,
    textAlignVertical: "top",
  },
  error: { color: colors.danger, fontSize: 11, marginTop: spacing.sm },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
