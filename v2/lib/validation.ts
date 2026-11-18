import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un email válido").max(254),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Ingresa tu nombre").max(80, "Nombre demasiado largo"),
  email: z.string().email("Ingresa un email válido").max(254),
  phone: z.string().max(24).optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

export const merchantRegisterSchema = registerSchema.extend({
  storeName: z.string().min(2, "Ingresa el nombre del local").max(80),
  comuna: z.string().min(1, "Selecciona una comuna").max(80),
  address: z.string().min(3, "Ingresa la dirección").max(200),
  cuisine: z.string().min(1, "Selecciona un tipo de cocina").max(80),
  deliveryMode: z.enum(["OWN", "FREELANCE", "HYBRID"]).default("HYBRID"),
});

export const courierRegisterSchema = registerSchema.extend({
  vehicle: z.enum(["BIKE", "MOTORCYCLE", "CAR", "WALKING"]).default("MOTORCYCLE"),
  zone: z.string().min(1, "Selecciona una comuna"),
});

export const cartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  modifierOptionIds: z.array(z.string()).default([]),
  notes: z.string().max(240).optional(),
});

export const createOrderSchema = z.object({
  storeId: z.string().min(1),
  clientRequestId: z.string().min(8).max(80),
  items: z.array(cartItemSchema).min(1, "El carrito está vacío").max(30),
  deliveryMode: z.enum(["DELIVERY", "PICKUP"]),
  address: z
    .object({
      line1: z.string().min(3).max(200),
      comuna: z.string().min(1).max(80),
      instructions: z.string().max(240).optional(),
    })
    .optional(),
  tip: z.number().int().min(0).max(10000).default(0),
  paymentProvider: z.enum(["MERCADOPAGO", "TRANSBANK", "FLOW"]),
  flowMethod: z.enum(["webpay", "mach"]).optional(),
  customerName: z.string().min(2).max(80).optional(),
  customerPhone: z.string().max(24).optional(),
});

export const orderStatusSchema = z.object({
  status: z.string().min(1),
  reason: z.string().max(240).optional(),
  pin: z.string().regex(/^\d{4}$/, "PIN inválido").optional(),
});

export const reviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2, "Ingresa el nombre del plato"),
  description: z.string().max(300).optional(),
  price: z.coerce.number().int().min(100, "El precio mínimo es $100"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  emoji: z.string().max(8).optional(),
  available: z.coerce.boolean().default(true),
});

export const categorySchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(2, "Ingresa el nombre de la categoría"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
