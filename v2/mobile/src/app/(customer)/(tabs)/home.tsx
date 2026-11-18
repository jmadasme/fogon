import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
import { SANTIAGO_COMUNAS } from "@/lib/communes";
import type { Comuna, Store } from "@/lib/types";
import { StoreCard } from "@/components/StoreCard";
import { CartBar } from "@/components/CartBar";
import { Chip, EmptyState, Logo } from "@/components/ui";

type HomeResponse = {
  stores: Store[];
  communes: Comuna[];
  cuisines: { name: string; emoji: string }[];
};

export default function CustomerHome() {
  const { user, token } = useAuth();
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stores, setStores] = useState<Store[]>([]);
  const [communes, setCommunes] = useState<Comuna[]>(SANTIAGO_COMUNAS);
  const [cuisines, setCuisines] = useState<{ name: string; emoji: string }[]>([]);
  const [query, setQuery] = useState("");
  const [comuna, setComuna] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (comuna) params.set("comuna", comuna);
        if (cuisine) params.set("cuisine", cuisine);
        const data = await api<HomeResponse>(
          `/api/mobile/home${params.toString() ? `?${params}` : ""}`,
          { token },
        );
        setStores(data.stores);
        setCommunes(data.communes);
        setCuisines(data.cuisines);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos cargar.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, query, comuna, cuisine],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  const header = useMemo(
    () => (
      <View>
        <View style={styles.topRow}>
          <Logo />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable onPress={() => router.push("/checkout")} style={styles.iconButton}>
              <Ionicons name="bag-outline" size={20} color={colors.text} />
              {cart.count > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.count}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => router.push("/account")} style={styles.iconButton}>
              <Ionicons name="person-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.eyebrow}>HOLA, {user?.name?.split(" ")[0]?.toUpperCase()}</Text>
        <Text style={styles.title}>¿Qué cocinas hoy?</Text>
        <Text style={styles.subtitle}>
          Comida local, precio claro y entrega confiable.
        </Text>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Busca sushi, pizza, comida casera…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip label="Todo Santiago" selected={!comuna} onPress={() => setComuna("")} />
          {communes.map((item) => (
            <Chip
              key={item.name}
              label={item.name}
              selected={comuna === item.name}
              onPress={() => setComuna(comuna === item.name ? "" : item.name)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip label="Todas" selected={!cuisine} onPress={() => setCuisine("")} />
          {cuisines.map((item) => (
            <Chip
              key={item.name}
              label={`${item.emoji} ${item.name}`}
              selected={cuisine === item.name}
              onPress={() => setCuisine(cuisine === item.name ? "" : item.name)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Cocinas cerca</Text>
          <Text style={styles.sectionCount}>
            {loading ? "Buscando…" : `${stores.length} disponibles`}
          </Text>
        </View>
      </View>
    ),
    [user, cart.count, query, comuna, cuisine, communes, cuisines, stores.length, loading, router],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard store={item} onPress={() => router.push(`/store/${item.slug}`)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No encontramos cocinas"
              description={
                error
                  ? error
                  : "Prueba con otra comuna, otro antojo o limpia los filtros."
              }
            />
          )
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.primaryInk, fontSize: 9, fontWeight: "800" },
  eyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  search: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  sectionCount: { color: colors.muted, fontSize: 10 },
});
