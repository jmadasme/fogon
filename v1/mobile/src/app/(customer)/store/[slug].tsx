import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { formatCLP } from "@/lib/format";
import type { MenuItem, StoreDetail } from "@/lib/types";
import { MenuItemCard } from "@/components/MenuItemCard";
import { ModifierModal, type ModifierSelection } from "@/components/ModifierModal";
import { CartBar } from "@/components/CartBar";
import { Chip, EmptyState, LoadingScreen } from "@/components/ui";

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useAuth();
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!slug || !token) return;
    (async () => {
      setLoading(true);
      try {
        const data = await api<StoreDetail>(`/api/mobile/stores/${slug}`, { token });
        setStore(data);
        setActiveCategory(data.categories[0]?.id ?? "");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos cargar el local.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, token]);

  const category = useMemo(
    () => store?.categories.find((item) => item.id === activeCategory) ?? store?.categories[0],
    [store, activeCategory],
  );

  function addItem(
    item: MenuItem,
    quantity = 1,
    modifiers: ModifierSelection[] = [],
    notes?: string,
  ) {
    if (!store) return;
    const replaced = cart.addItem(
      store,
      item,
      quantity,
      modifiers,
      notes,
    );
    if (replaced) {
      Alert.alert(
        "Carrito actualizado",
        "Reemplazamos el carrito anterior porque era de otro local.",
      );
    }
  }

  function handleAdd(item: MenuItem) {
    if (item.modifiers.length > 0) {
      setModalItem(item);
      return;
    }
    addItem(item);
  }

  if (loading) return <LoadingScreen label="Cargando menú…" />;

  if (!store) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={{ padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <EmptyState
            icon="restaurant-outline"
            title="Local no disponible"
            description={error ?? "Vuelve al inicio y elige otra cocina."}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cover}>
          {store.coverUrl ? (
            <Image source={{ uri: store.coverUrl }} style={StyleSheet.absoluteFill} accessibilityLabel={`Portada de ${store.name}`} alt="" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
              <Text style={{ fontSize: 48 }}>{store.emoji}</Text>
            </View>
          )}
          <View style={styles.coverOverlay} />
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <View style={styles.coverInfo}>
            <Text style={styles.cuisine}>
              {store.emoji} {store.cuisine}
            </Text>
            <Text style={styles.name}>{store.name}</Text>
            <Text style={styles.comuna}>{store.comuna}</Text>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text style={styles.infoValue}>{store.rating.toFixed(1)}</Text>
              <Text style={styles.infoMuted}>({store.ratingCount})</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={styles.infoMuted}>
                {store.prepTimeMin}–{store.prepTimeMin + 10} min
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="bicycle-outline" size={15} color={colors.muted} />
              <Text style={styles.infoMuted}>desde {formatCLP(store.deliveryFeeFrom)}</Text>
            </View>
          </View>
          <Text style={styles.address}>
            {store.address}, {store.comuna}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {store.categories.map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              selected={category?.id === item.id}
              onPress={() => setActiveCategory(item.id)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={styles.sectionTitle}>{category?.name ?? "Menú"}</Text>
          {category?.items.length ? (
            category.items.map((item) => (
              <MenuItemCard key={item.id} item={item} onAdd={handleAdd} />
            ))
          ) : (
            <EmptyState
              icon="fast-food-outline"
              title="Menú en preparación"
              description="Este local está cargando sus platos."
            />
          )}
        </View>
      </ScrollView>

      <CartBar />

      <ModifierModal
        visible={Boolean(modalItem)}
        item={modalItem}
        onClose={() => setModalItem(null)}
        onAdd={({ quantity, modifiers, notes }) => {
          if (modalItem) addItem(modalItem, quantity, modifiers, notes);
          setModalItem(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cover: { height: 230, backgroundColor: colors.surface2 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  coverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,14,17,0.28)",
  },
  back: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  coverInfo: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cuisine: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  name: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -0.8, marginTop: 2 },
  comuna: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 2 },
  info: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  infoValue: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  infoMuted: { color: colors.muted, fontSize: 10 },
  address: { color: colors.muted, fontSize: 11, marginTop: spacing.sm },
  categories: { gap: spacing.sm, padding: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
  },
});
