import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "fogon_mobile_cart_v1";

export type CartStore = {
  id: string;
  name: string;
  slug: string;
  emoji?: string | null;
  comuna: string;
  prepTimeMin: number;
  lat: number;
  lng: number;
  minOrder: number;
};

export type CartModifier = {
  id: string;
  name: string;
  priceDelta: number;
};

export type CartItem = {
  key: string;
  itemId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
  emoji?: string | null;
  imageUrl?: string | null;
};

type CartState = {
  store: CartStore | null;
  items: CartItem[];
};

type CartContextValue = CartState & {
  isReady: boolean;
  subtotal: number;
  count: number;
  addItem: (
    store: CartStore,
    item: {
      id: string;
      name: string;
      price: number;
      emoji?: string | null;
      imageUrl?: string | null;
    },
    quantity?: number,
    modifiers?: CartModifier[],
    notes?: string,
  ) => boolean;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function itemKey(itemId: string, modifiers: CartModifier[], notes?: string) {
  const mods = modifiers.map((modifier) => modifier.id).sort().join(",");
  return `${itemId}::${mods}::${notes ?? ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ store: null, items: [] });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartState;
          if (parsed && Array.isArray(parsed.items)) setState(parsed);
        }
      } catch {
        // carrito vacío
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, isReady]);

  const addItem = useCallback(
    (
      store: CartStore,
      item: {
        id: string;
        name: string;
        price: number;
        emoji?: string | null;
        imageUrl?: string | null;
      },
      quantity = 1,
      modifiers: CartModifier[] = [],
      notes?: string,
    ) => {
      const replaced = Boolean(state.store && state.store.id !== store.id);
      setState((current) => {
        const sameStore = current.store?.id === store.id;
        const baseItems = sameStore ? current.items : [];
        const key = itemKey(item.id, modifiers, notes);
        const existing = baseItems.find((line) => line.key === key);
        const modifierDelta = modifiers.reduce(
          (sum, modifier) => sum + modifier.priceDelta,
          0,
        );
        const unitPrice = item.price + modifierDelta;

        const items = existing
          ? baseItems.map((line) =>
              line.key === key
                ? { ...line, quantity: line.quantity + quantity }
                : line,
            )
          : [
              ...baseItems,
              {
                key,
                itemId: item.id,
                name: item.name,
                basePrice: item.price,
                unitPrice,
                quantity,
                modifiers,
                notes,
                emoji: item.emoji,
                imageUrl: item.imageUrl,
              },
            ];

        return { store, items };
      });
      return replaced;
    },
    [state.store],
  );

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setState((current) => {
      const items = current.items
        .map((line) =>
          line.key === key ? { ...line, quantity: Math.max(0, quantity) } : line,
        )
        .filter((line) => line.quantity > 0);
      return { store: items.length ? current.store : null, items };
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setState((current) => {
      const items = current.items.filter((line) => line.key !== key);
      return { store: items.length ? current.store : null, items };
    });
  }, []);

  const clearCart = useCallback(() => {
    setState({ store: null, items: [] });
  }, []);

  const subtotal = useMemo(
    () => state.items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [state.items],
  );
  const count = useMemo(
    () => state.items.reduce((sum, line) => sum + line.quantity, 0),
    [state.items],
  );

  const value = useMemo(
    () => ({
      ...state,
      isReady,
      subtotal,
      count,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [state, isReady, subtotal, count, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
