import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  COMMISSION_RATES,
  CUISINES,
  SANTIAGO_COMUNAS,
} from "../lib/constants";

const db = new PrismaClient();

const PASSWORD = "fogon123";

const STORE_NAMES = [
  "La Cocina de la Abuela",
  "Sushi Nori",
  "Pizza Brava",
  "Verde Bowl",
  "Café Central",
  "Pollo del Barrio",
  "Tacos El Fogón",
  "Pasta Fresca",
  "Dulce Momento",
  "Wok Andino",
  "Burger Norte",
  "Arepas Casa",
  "La Picada",
  "Sabor Peruano",
  "Ramen House",
  "Empanadas del Sur",
  "Healthy Lab",
  "Taco Loco",
  "Curry & Co",
  "Mar y Tierra",
  "Fuego Parrilla",
  "Sushi Zen",
  "La Terraza",
  "Café del Parque",
  "Doña Rosa",
  "El Rincón",
  "Sabor del Sur",
  "La Esquina",
  "Verde Natural",
  "Pizza Nostra",
  "Burger Lab",
  "Tacos del Barrio",
  "Dulce Hogar",
  "Parrilla Sur",
];

const CUISINE_ASSIGNMENT = [
  "Chilena",
  "Japonesa",
  "Italiana",
  "Saludable",
  "Café",
  "Pollo",
  "Mexicana",
  "Italiana",
  "Panadería",
  "Asiática",
  "Hamburguesas",
  "Venezolana",
  "Chilena",
  "Peruana",
  "Japonesa",
  "Chilena",
  "Saludable",
  "Mexicana",
  "India",
  "Mariscos",
  "Parrilla",
  "Japonesa",
  "Chilena",
  "Café",
  "Chilena",
  "Peruana",
  "Chilena",
  "Sándwiches",
  "Saludable",
  "Italiana",
  "Hamburguesas",
  "Mexicana",
  "Panadería",
  "Parrilla",
];

type MenuItemSeed = {
  name: string;
  description: string;
  price: number;
  emoji: string;
};

const MENUS: Record<string, MenuItemSeed[]> = {
  Chilena: [
    { name: "Empanada de pino", description: "Masa casera, carne, cebolla, huevo y aceituna.", price: 2400, emoji: "🥟" },
    { name: "Pastel de choclo", description: "Choclo cremoso, pino de carne y pollo gratinado.", price: 7900, emoji: "🌽" },
    { name: "Cazuela de vacuno", description: "Caldo de campo con carne, papa, zapallo y choclo.", price: 8500, emoji: "🍲" },
    { name: "Completo italiano", description: "Vienesa, palta, tomate y mayonesa casera.", price: 3500, emoji: "🌭" },
    { name: "Mote con huesillo", description: "Bebida tradicional chilena, bien fría.", price: 2500, emoji: "🥤" },
  ],
  Japonesa: [
    { name: "Roll California", description: "Palta, pepino, cangrejo y sésamo.", price: 6500, emoji: "🍣" },
    { name: "Roll salmón", description: "Salmón fresco, queso crema y cebollín.", price: 7900, emoji: "🍣" },
    { name: "Ramen tonkotsu", description: "Caldo de cerdo, fideos, huevo marinado y cerdo.", price: 8900, emoji: "🍜" },
    { name: "Gyozas", description: "6 unidades de cerdo y verduras.", price: 4500, emoji: "🥟" },
    { name: "Edamame", description: "Poroto de soya al vapor con sal marina.", price: 3500, emoji: "🫛" },
  ],
  Italiana: [
    { name: "Pizza margherita", description: "Tomate, mozzarella fresca y albahaca.", price: 8900, emoji: "🍕" },
    { name: "Pizza pepperoni", description: "Pepperoni, mozzarella y orégano.", price: 9900, emoji: "🍕" },
    { name: "Lasaña bolognesa", description: "Capas de pasta, carne y bechamel.", price: 8500, emoji: "🍝" },
    { name: "Focaccia de romero", description: "Pan horneado con aceite de oliva y romero.", price: 4500, emoji: "🥖" },
    { name: "Tiramisú", description: "Café, mascarpone y cacao.", price: 3900, emoji: "🍰" },
  ],
  Saludable: [
    { name: "Bowl Andino", description: "Quinoa, pollo, palta, tomate y dressing de limón.", price: 7900, emoji: "🥗" },
    { name: "Ensalada César", description: "Lechuga, pollo, parmesano y crutones.", price: 6900, emoji: "🥗" },
    { name: "Wrap de pollo", description: "Tortilla integral, pollo, verduras y yogurt.", price: 5900, emoji: "🌯" },
    { name: "Smoothie verde", description: "Espinaca, manzana, plátano y jengibre.", price: 3500, emoji: "🥤" },
    { name: "Granola artesanal", description: "Avena, frutos secos, miel y yogurt.", price: 3200, emoji: "🥣" },
  ],
  Café: [
    { name: "Latte", description: "Espresso doble con leche vaporizada.", price: 3200, emoji: "☕" },
    { name: "Cappuccino", description: "Espresso, leche y espuma cremosa.", price: 3400, emoji: "☕" },
    { name: "Croissant de mantequilla", description: "Horneado en casa, capas crujientes.", price: 2800, emoji: "🥐" },
    { name: "Sándwich ave palta", description: "Pan de miga, ave, palta y mayo casera.", price: 4900, emoji: "🥪" },
    { name: "Cheesecake", description: "Base de galleta y crema de queso.", price: 3900, emoji: "🍰" },
  ],
  Pollo: [
    { name: "Pollo asado 1/2", description: "Pollo marinado, papas y ensalada.", price: 8900, emoji: "🍗" },
    { name: "Alitas BBQ", description: "8 alitas con salsa BBQ ahumada.", price: 6900, emoji: "🍗" },
    { name: "Papas rústicas", description: "Papas con cáscara, sal de mar y romero.", price: 3500, emoji: "🍟" },
    { name: "Ensalada chilena", description: "Tomate, cebolla y cilantro.", price: 2900, emoji: "🥗" },
    { name: "Chicha en vaso", description: "Bebida tradicional, helada.", price: 2500, emoji: "🥤" },
  ],
  Mexicana: [
    { name: "Tacos al pastor 3x", description: "Cerdo, piña, cebolla y cilantro.", price: 6500, emoji: "🌮" },
    { name: "Burrito de carne", description: "Carne, arroz, frijoles, queso y salsa.", price: 6900, emoji: "🌯" },
    { name: "Quesadilla", description: "Tortilla, queso, pollo y pico de gallo.", price: 5900, emoji: "🫓" },
    { name: "Nachos", description: "Totopos, queso cheddar, guacamole y jalapeños.", price: 4900, emoji: "🧀" },
    { name: "Churros", description: "4 churros con azúcar y chocolate.", price: 3500, emoji: "🍩" },
  ],
  Panadería: [
    { name: "Torta de chocolate", description: "Bizcocho húmedo y ganache.", price: 4500, emoji: "🍰" },
    { name: "Brownie", description: "Chocolate intenso y nueces.", price: 2500, emoji: "🍫" },
    { name: "Cupcake de vainilla", description: "Bizcocho y buttercream.", price: 2200, emoji: "🧁" },
    { name: "Galleta de avena", description: "Avena, pasas y canela.", price: 1500, emoji: "🍪" },
    { name: "Café del día", description: "Café filtrado, 250 ml.", price: 2500, emoji: "☕" },
  ],
  Asiática: [
    { name: "Arroz frito", description: "Arroz, huevo, verduras y salsa de soya.", price: 6900, emoji: "🍚" },
    { name: "Noodles salteados", description: "Fideos, pollo, verduras y sésamo.", price: 7500, emoji: "🍜" },
    { name: "Curry verde", description: "Leche de coco, pollo y arroz jazmín.", price: 7900, emoji: "🍛" },
    { name: "Dumplings", description: "6 unidades al vapor con salsa.", price: 4900, emoji: "🥟" },
    { name: "Té helado", description: "Té negro con limón.", price: 2500, emoji: "🧋" },
  ],
  Hamburguesas: [
    { name: "Burger clásica", description: "Carne 150g, queso, lechuga, tomate y salsa.", price: 7900, emoji: "🍔" },
    { name: "Burger doble", description: "Doble carne, doble queso y tocino.", price: 9900, emoji: "🍔" },
    { name: "Burger veggie", description: "Medallón de garbanzos, palta y verduras.", price: 7500, emoji: "🍔" },
    { name: "Papas fritas", description: "Porción grande con sal de mar.", price: 3500, emoji: "🍟" },
    { name: "Malteada", description: "Vainilla, chocolate o frutilla.", price: 3900, emoji: "🥤" },
  ],
  Venezolana: [
    { name: "Arepa reina", description: "Pollo, palta y mayonesa.", price: 6500, emoji: "🫓" },
    { name: "Tequeños", description: "6 unidades de queso con salsa.", price: 4500, emoji: "🧀" },
    { name: "Pabellón criollo", description: "Carne, arroz, caraotas y plátano.", price: 8900, emoji: "🍲" },
    { name: "Cachapa", description: "Maíz dulce, queso de mano y mantequilla.", price: 5900, emoji: "🥞" },
    { name: "Jugo de mango", description: "Natural, sin azúcar añadida.", price: 2500, emoji: "🥤" },
  ],
  Peruana: [
    { name: "Ceviche clásico", description: "Pescado, limón, cebolla y ají.", price: 8900, emoji: "🐟" },
    { name: "Lomo saltado", description: "Carne, papas, arroz y salsa de soya.", price: 9500, emoji: "🍲" },
    { name: "Causa limeña", description: "Papa, ají amarillo, pollo y palta.", price: 5500, emoji: "🥔" },
    { name: "Anticuchos", description: "3 brochetas de corazón con papa.", price: 6500, emoji: "🍢" },
    { name: "Chicha morada", description: "Bebida de maíz morado y frutas.", price: 2500, emoji: "🥤" },
  ],
  India: [
    { name: "Curry de pollo", description: "Pollo, tomate, especias y arroz basmati.", price: 8500, emoji: "🍛" },
    { name: "Naan", description: "Pan plano recién horneado.", price: 2500, emoji: "🫓" },
    { name: "Samosa", description: "2 unidades de papa y arvejas.", price: 3500, emoji: "🥟" },
    { name: "Biryani", description: "Arroz especiado con pollo y azafrán.", price: 8900, emoji: "🍚" },
    { name: "Lassi", description: "Yogurt, mango y cardamomo.", price: 3200, emoji: "🥤" },
  ],
  Mariscos: [
    { name: "Ceviche mixto", description: "Pescado, camarón y pulpo.", price: 9900, emoji: "🦐" },
    { name: "Fish & chips", description: "Pescado frito, papas y salsa tártara.", price: 8500, emoji: "🐟" },
    { name: "Camarones al ajillo", description: "Camarones, ajo, perejil y arroz.", price: 9500, emoji: "🦐" },
    { name: "Arroz con mariscos", description: "Arroz, mariscos y azafrán.", price: 8900, emoji: "🍚" },
    { name: "Pisco sour", description: "Pisco, limón, azúcar y clara.", price: 4500, emoji: "🍸" },
  ],
  Parrilla: [
    { name: "Bife de chorizo", description: "300g con papas y ensalada.", price: 12900, emoji: "🥩" },
    { name: "Churrasco", description: "Carne, pan, palta y tomate.", price: 9900, emoji: "🥪" },
    { name: "Chorizo artesanal", description: "Con pan y pebre.", price: 5500, emoji: "🌭" },
    { name: "Papas rústicas", description: "Con sal de mar y romero.", price: 3500, emoji: "🍟" },
    { name: "Ensalada mixta", description: "Lechuga, tomate y cebolla.", price: 2900, emoji: "🥗" },
  ],
  Sándwiches: [
    { name: "Churrasco italiano", description: "Carne, palta, tomate y mayo.", price: 6900, emoji: "🥪" },
    { name: "Ave palta", description: "Pollo, palta y mayo casera.", price: 5900, emoji: "🥪" },
    { name: "Barros Luco", description: "Carne y queso fundido.", price: 6500, emoji: "🥪" },
    { name: "Papas fritas", description: "Porción individual.", price: 3000, emoji: "🍟" },
    { name: "Bebida", description: "Lata 350 ml.", price: 2000, emoji: "🥤" },
  ],
};

const MODIFIERS: Record<string, { name: string; type: "SINGLE" | "MULTIPLE"; required: boolean; min: number; max: number; options: { name: string; priceDelta: number }[] }> = {
  Hamburguesas: {
    name: "Extras",
    type: "MULTIPLE",
    required: false,
    min: 0,
    max: 3,
    options: [
      { name: "Queso extra", priceDelta: 500 },
      { name: "Tocino", priceDelta: 700 },
      { name: "Aguacate", priceDelta: 600 },
      { name: "Huevo", priceDelta: 400 },
    ],
  },
  Italiana: {
    name: "Tamaño",
    type: "SINGLE",
    required: true,
    min: 1,
    max: 1,
    options: [
      { name: "Personal", priceDelta: 0 },
      { name: "Familiar", priceDelta: 4000 },
    ],
  },
  Japonesa: {
    name: "Extras",
    type: "MULTIPLE",
    required: false,
    min: 0,
    max: 2,
    options: [
      { name: "Soya", priceDelta: 0 },
      { name: "Jengibre", priceDelta: 0 },
      { name: "Wasabi", priceDelta: 0 },
    ],
  },
  Café: {
    name: "Leche",
    type: "SINGLE",
    required: true,
    min: 1,
    max: 1,
    options: [
      { name: "Entera", priceDelta: 0 },
      { name: "Descremada", priceDelta: 0 },
      { name: "Sin lactosa", priceDelta: 300 },
    ],
  },
  Chilena: {
    name: "Acompañamiento",
    type: "SINGLE",
    required: false,
    min: 0,
    max: 1,
    options: [
      { name: "Ensalada", priceDelta: 0 },
      { name: "Papas", priceDelta: 800 },
      { name: "Arroz", priceDelta: 0 },
    ],
  },
};

const ZONE_FACTOR: Record<string, number> = {
  Oriente: 1.15,
  Centro: 1.05,
  Norte: 0.95,
  Sur: 0.9,
  Poniente: 0.9,
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orderCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FOG-${code}`;
}

function pin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fees(subtotal: number, distanceKm: number, deliveryMode: "DELIVERY" | "PICKUP", tip: number, rate: number) {
  const isDelivery = deliveryMode === "DELIVERY";
  const distance = isDelivery ? Math.max(0.5, distanceKm) : 0;
  const deliveryFee = isDelivery
    ? Math.min(4900, Math.round((1900 + Math.max(0, distance - 2) * 300) / 100) * 100)
    : 0;
  const serviceFee = isDelivery
    ? Math.min(1500, Math.max(500, Math.round((subtotal * 0.06) / 100) * 100))
    : 0;
  const commissionAmount = Math.round((subtotal * rate) / 100);
  const courierPayout = isDelivery
    ? Math.round(1300 + 250 * distance)
    : 0;
  return {
    subtotal,
    deliveryFee,
    serviceFee,
    tip,
    discount: 0,
    total: subtotal + deliveryFee + serviceFee + tip,
    distanceKm: Number(distance.toFixed(1)),
    commissionRate: rate,
    commissionAmount,
    courierPayout,
  };
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Seed demo bloqueado en producción. Usa ALLOW_DEMO_SEED=true solo en una base de staging desechable.",
    );
  }

  console.log("Limpiando datos…");
  await db.kycCase.deleteMany();
  await db.auditLog.deleteMany();
  await db.review.deleteMany();
  await db.orderEvent.deleteMany();
  await db.payment.deleteMany();
  await db.deliveryOffer.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.modifierOption.deleteMany();
  await db.modifier.deleteMany();
  await db.menuItem.deleteMany();
  await db.category.deleteMany();
  await db.store.deleteMany();
  await db.merchant.deleteMany();
  await db.courier.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.zone.deleteMany();

  const passwordHash = await hash(PASSWORD, 10);

  console.log("Creando usuarios…");
  await db.user.create({
    data: {
      name: "Administración Fogón",
      email: "admin@fogon.cl",
      passwordHash,
      role: "ADMIN",
    },
  });

  const customer = await db.user.create({
    data: {
      name: "Camila Pérez",
      email: "cliente@fogon.cl",
      phone: "+56 9 1111 2222",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  const demoMerchantUser = await db.user.create({
    data: {
      name: "María González",
      email: "local@fogon.cl",
      phone: "+56 9 3333 4444",
      passwordHash,
      role: "MERCHANT",
    },
  });

  const demoCourierUser = await db.user.create({
    data: {
      name: "Diego Fuentes",
      email: "repartidor@fogon.cl",
      phone: "+56 9 5555 6666",
      passwordHash,
      role: "COURIER",
    },
  });

  await db.address.create({
    data: {
      userId: customer.id,
      label: "Casa",
      line1: "Av. Irarrázaval 1234, depto 56",
      comuna: "Ñuñoa",
      lat: -33.4569,
      lng: -70.5975,
      isDefault: true,
    },
  });

  const demoMerchant = await db.merchant.create({
    data: {
      ownerId: demoMerchantUser.id,
      name: "Cocinas de María",
      status: "VERIFIED",
      commissionPlan: "HYBRID",
      deliveryMode: "HYBRID",
      rating: 4.8,
      ratingCount: 120,
      coverUrl: CUISINES.Chilena.image,
    },
  });

  console.log("Creando locales y menús…");
  const stores: {
    id: string;
    name: string;
    slug: string;
    emoji: string;
    comuna: string;
    lat: number;
    lng: number;
    address: string;
    merchantId: string;
    commissionPlan: string;
    items: { id: string; name: string; price: number; emoji: string }[];
  }[] = [];

  for (let i = 0; i < SANTIAGO_COMUNAS.length; i++) {
    const comuna = SANTIAGO_COMUNAS[i];
    const name = STORE_NAMES[i] ?? `Cocina ${comuna.name}`;
    const cuisineName = CUISINE_ASSIGNMENT[i] ?? "Chilena";
    const cuisine = CUISINES[cuisineName] ?? CUISINES.Chilena;
    const factor = ZONE_FACTOR[comuna.zone] ?? 1;
    const isDemo = i < 3;
    const isVerified = i < 30;
    const commissionPlan = isDemo
      ? "HYBRID"
      : i % 3 === 0
        ? "KITCHEN"
        : i % 3 === 1
          ? "HYBRID"
          : "FULL";
    const deliveryMode = isDemo
      ? "HYBRID"
      : i % 3 === 0
        ? "OWN"
        : i % 3 === 1
          ? "FREELANCE"
          : "HYBRID";

    let merchant;
    if (isDemo) {
      merchant = demoMerchant;
    } else {
      const owner = await db.user.create({
        data: {
          name: `Responsable ${name}`,
          email: `local${i}@fogon.cl`,
          passwordHash,
          role: "MERCHANT",
        },
      });
      merchant = await db.merchant.create({
        data: {
          ownerId: owner.id,
          name,
          status: isVerified ? "VERIFIED" : "PENDING",
          commissionPlan,
          deliveryMode,
          rating: 4.5 + (i % 5) * 0.1,
          ratingCount: 35 + i * 7,
          coverUrl: cuisine.image,
        },
      });
    }

    const store = await db.store.create({
      data: {
        merchantId: merchant.id,
        name,
        slug: `${slugify(name)}-${slugify(comuna.name)}`,
        description: `Cocina ${cuisineName.toLowerCase()} en ${comuna.name}. Preparado al momento con ingredientes frescos.`,
        cuisine: cuisineName,
        emoji: cuisine.emoji,
        address: `Av. ${["Irarrázaval", "Providencia", "Apoquindo", "Vicuña Mackenna", "Gran Avenida", "Pajaritos", "Recoleta", "Independencia", "La Florida", "Los Leones"][i % 10]} ${100 + i * 37}`,
        comuna: comuna.name,
        lat: comuna.lat + (i % 5) * 0.001,
        lng: comuna.lng + (i % 5) * 0.001,
        status: isVerified ? "ACTIVE" : "PENDING",
        prepTimeMin: 18 + (i % 5) * 4,
        minOrder: i < 3 ? 0 : i % 3 === 0 ? 8000 : 0,
        coverUrl: cuisine.image,
        rating: 4.5 + (i % 5) * 0.1,
        ratingCount: 35 + i * 7,
      },
    });

    const menu = MENUS[cuisineName] ?? MENUS.Chilena;
    const categories = ["Recomendados", "Más del menú"];
    const createdItems: { id: string; name: string; price: number; emoji: string }[] = [];

    for (let c = 0; c < categories.length; c++) {
      const category = await db.category.create({
        data: { storeId: store.id, name: categories[c], position: c },
      });
      const slice = c === 0 ? menu.slice(0, 3) : menu.slice(3);
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j];
        const price = Math.round((item.price * factor) / 100) * 100;
        const created = await db.menuItem.create({
          data: {
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price,
            emoji: item.emoji,
            imageUrl: null,
            position: j,
            available: true,
          },
        });
        createdItems.push({ id: created.id, name: created.name, price: created.price, emoji: created.emoji ?? "🍽️" });

        const modifier = MODIFIERS[cuisineName];
        if (modifier) {
          const group = await db.modifier.create({
            data: {
              itemId: created.id,
              name: modifier.name,
              type: modifier.type,
              required: modifier.required,
              min: modifier.min,
              max: modifier.max,
            },
          });
          await db.modifierOption.createMany({
            data: modifier.options.map((option) => ({
              modifierId: group.id,
              name: option.name,
              priceDelta: option.priceDelta,
            })),
          });
        }
      }
    }

    stores.push({
      id: store.id,
      name: store.name,
      slug: store.slug,
      emoji: store.emoji,
      comuna: store.comuna,
      lat: store.lat,
      lng: store.lng,
      address: store.address,
      merchantId: merchant.id,
      commissionPlan,
      items: createdItems,
    });
  }

  console.log("Creando repartidores…");
  const courierNames = [
    "Diego Fuentes",
    "Camila Rojas",
    "Matías Silva",
    "Valentina Soto",
    "Jorge Díaz",
    "Francisca Muñoz",
    "Sebastián Vera",
    "Antonia Lagos",
    "Cristóbal Reyes",
    "Javiera Torres",
  ];
  const couriers: { id: string; userId: string; name: string }[] = [];
  for (let i = 0; i < courierNames.length; i++) {
    const comuna = SANTIAGO_COMUNAS[(i * 3) % SANTIAGO_COMUNAS.length];
    const user = i === 0
      ? demoCourierUser
      : await db.user.create({
          data: {
            name: courierNames[i],
            email: `courier${i}@fogon.cl`,
            phone: `+56 9 7777 ${String(1000 + i).slice(-4)}`,
            passwordHash,
            role: "COURIER",
          },
        });
    const courier = await db.courier.create({
      data: {
        userId: user.id,
        phone: user.phone,
        vehicle: i % 3 === 0 ? "MOTORCYCLE" : i % 3 === 1 ? "BIKE" : "CAR",
        status: i === 0 ? "AVAILABLE" : "OFFLINE",
        verificationStatus: i === 9 ? "PENDING" : "VERIFIED",
        zone: comuna.name,
        rating: 4.7 + (i % 4) * 0.1,
        ratingCount: 20 + i * 5,
        currentLat: comuna.lat + 0.002,
        currentLng: comuna.lng + 0.002,
        lastSeenAt: new Date(),
      },
    });
    couriers.push({ id: courier.id, userId: user.id, name: courierNames[i] });
  }

  console.log("Creando pedidos de ejemplo…");
  const customerAddress = { line1: "Av. Irarrázaval 1234, depto 56", comuna: "Ñuñoa", lat: -33.4569, lng: -70.5975 };
  const statuses: {
    status: string;
    minutesAgo: number;
    courier?: number;
    fulfillment?: "PLATFORM" | "OWN" | "PICKUP";
    payment?: "PAID" | "PENDING";
    deliveryMode?: "DELIVERY" | "PICKUP";
    cancel?: boolean;
  }[] = [
    { status: "PENDING_MERCHANT", minutesAgo: 2 },
    { status: "PENDING_MERCHANT", minutesAgo: 4 },
    { status: "PENDING_MERCHANT", minutesAgo: 7 },
    { status: "ACCEPTED", minutesAgo: 10 },
    { status: "ACCEPTED", minutesAgo: 13 },
    { status: "PREPARING", minutesAgo: 18 },
    { status: "PREPARING", minutesAgo: 22 },
    { status: "READY", minutesAgo: 27 },
    { status: "READY", minutesAgo: 30, fulfillment: "OWN" },
    { status: "PENDING_COURIER", minutesAgo: 34 },
    { status: "COURIER_ASSIGNED", minutesAgo: 40, courier: 1 },
    { status: "PICKED_UP", minutesAgo: 48, courier: 0 },
    { status: "DELIVERED", minutesAgo: 60 * 24 * 2, courier: 0, payment: "PAID" },
    { status: "DELIVERED", minutesAgo: 60 * 24 * 3, courier: 1, payment: "PAID" },
    { status: "CANCELLED_BY_MERCHANT", minutesAgo: 60 * 24, cancel: true },
    { status: "READY", minutesAgo: 26, deliveryMode: "PICKUP", fulfillment: "PICKUP" },
  ];

  let createdOrders = 0;
  for (let i = 0; i < statuses.length; i++) {
    const spec = statuses[i];
    const store = stores[i % 3];
    const picked = store.items.slice(0, 2 + (i % 2));
    const subtotal = picked.reduce(
      (sum, item, index) => sum + item.price * (index === 0 ? 2 : 1),
      0,
    );
    const deliveryMode = spec.deliveryMode ?? "DELIVERY";
    const distance = deliveryMode === "DELIVERY"
      ? haversine({ lat: store.lat, lng: store.lng }, customerAddress)
      : 0;
    const rate = COMMISSION_RATES[store.commissionPlan] ?? 17;
    const totals = fees(subtotal, distance, deliveryMode, i % 3 === 0 ? 1000 : 0, rate);
    const createdAt = new Date(Date.now() - spec.minutesAgo * 60 * 1000);
    const acceptedAt = ["ACCEPTED", "PREPARING", "READY", "PENDING_COURIER", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED", "CANCELLED_BY_MERCHANT"].includes(spec.status)
      ? new Date(createdAt.getTime() + 2 * 60 * 1000)
      : null;
    const readyAt = ["READY", "PENDING_COURIER", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED"].includes(spec.status)
      ? new Date(createdAt.getTime() + 12 * 60 * 1000)
      : null;
    const courierAssignedAt = spec.courier != null
      ? new Date(createdAt.getTime() + 15 * 60 * 1000)
      : null;
    const pickedUpAt = ["PICKED_UP", "DELIVERED"].includes(spec.status)
      ? new Date(createdAt.getTime() + 20 * 60 * 1000)
      : null;
    const deliveredAt = spec.status === "DELIVERED"
      ? new Date(createdAt.getTime() + 40 * 60 * 1000)
      : null;
    const courier = spec.courier != null ? couriers[spec.courier] : null;
    const paymentStatus = spec.payment ?? (spec.status === "CANCELLED_BY_MERCHANT" ? "REFUNDED" : "PAID");

    const events: { type: string; createdAt: Date; actorId?: string; payload?: string }[] = [
      { type: "ORDER_CREATED", createdAt, actorId: customer.id },
    ];
    if (paymentStatus === "PAID") {
      events.push({ type: "PAYMENT_CONFIRMED", createdAt: new Date(createdAt.getTime() + 30 * 1000) });
    }
    if (acceptedAt) events.push({ type: "MERCHANT_ACCEPTED", createdAt: acceptedAt, actorId: demoMerchantUser.id });
    if (["PREPARING", "READY", "PENDING_COURIER", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED"].includes(spec.status)) {
      events.push({ type: "PREPARING", createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000), actorId: demoMerchantUser.id });
    }
    if (readyAt) events.push({ type: "READY", createdAt: readyAt, actorId: demoMerchantUser.id });
    if (["PENDING_COURIER", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED"].includes(spec.status)) {
      events.push({ type: "COURIER_REQUESTED", createdAt: new Date((readyAt ?? createdAt).getTime() + 60 * 1000), actorId: demoMerchantUser.id });
    }
    if (courierAssignedAt) events.push({ type: "COURIER_ASSIGNED", createdAt: courierAssignedAt, actorId: courier?.userId });
    if (pickedUpAt) events.push({ type: "PICKED_UP", createdAt: pickedUpAt, actorId: courier?.userId });
    if (deliveredAt) events.push({ type: "DELIVERED", createdAt: deliveredAt, actorId: courier?.userId });
    if (spec.cancel) events.push({ type: "CANCELLED", createdAt: new Date(createdAt.getTime() + 3 * 60 * 1000), actorId: demoMerchantUser.id });

    const order = await db.order.create({
      data: {
        code: orderCode(),
        customerId: customer.id,
        storeId: store.id,
        courierId: courier?.id ?? null,
        status: spec.status,
        deliveryMode,
        fulfillment: spec.fulfillment ?? (courier ? "PLATFORM" : "PLATFORM"),
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        serviceFee: totals.serviceFee,
        tip: totals.tip,
        discount: 0,
        total: totals.total,
        commissionRate: totals.commissionRate,
        commissionAmount: totals.commissionAmount,
        courierPayout: totals.courierPayout,
        distanceKm: totals.distanceKm,
        paymentStatus,
        paymentProvider: spec.payment === "PENDING" ? "CASH" : "MOCK",
        addressLine: deliveryMode === "PICKUP" ? store.address : customerAddress.line1,
        comuna: deliveryMode === "PICKUP" ? store.comuna : customerAddress.comuna,
        lat: deliveryMode === "PICKUP" ? store.lat : customerAddress.lat,
        lng: deliveryMode === "PICKUP" ? store.lng : customerAddress.lng,
        instructions: i % 2 === 0 ? "Dejar en conserjería, avisar al llegar." : null,
        pickupPin: pin(),
        deliveryPin: pin(),
        createdAt,
        acceptedAt,
        readyAt,
        courierAssignedAt,
        pickedUpAt,
        deliveredAt,
        cancellationReason: spec.cancel ? "Local sin stock para el pedido" : null,
        items: {
          create: picked.map((item, index) => ({
            itemId: item.id,
            nameSnapshot: item.name,
            unitPrice: item.price,
            quantity: index === 0 ? 2 : 1,
            modifiersJson: null,
            notes: index === 0 && i % 4 === 0 ? "Sin cebolla" : null,
          })),
        },
        events: {
          create: events.map((event) => ({
            type: event.type,
            actorId: event.actorId,
            payload: event.payload,
            createdAt: event.createdAt,
          })),
        },
        payment: {
          create: {
            provider: spec.payment === "PENDING" ? "CASH" : "MOCK",
            status: paymentStatus,
            amount: totals.total,
            raw: JSON.stringify({ seed: true }),
          },
        },
      },
    });
    createdOrders++;

    if (spec.status === "DELIVERED") {
      await db.review.createMany({
        data: [
          {
            orderId: order.id,
            authorId: customer.id,
            targetType: "MERCHANT",
            targetId: store.id,
            rating: 5,
            comment: "Todo rico y llegó a tiempo.",
          },
          ...(courier
            ? [
                {
                  orderId: order.id,
                  authorId: customer.id,
                  targetType: "COURIER",
                  targetId: courier.id,
                  rating: 5,
                  comment: "Muy amable y rápido.",
                },
              ]
            : []),
        ],
      });
    }
  }

  // Dejar en BUSY a todos los repartidores con una entrega activa.
  const activeCourierOrders = await db.order.findMany({
    where: {
      courierId: { not: null },
      status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
    },
    select: { courierId: true },
  });
  const activeCourierIds = [
    ...new Set(
      activeCourierOrders
        .map((order) => order.courierId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (activeCourierIds.length > 0) {
    await db.courier.updateMany({
      where: { id: { in: activeCourierIds } },
      data: { status: "BUSY" },
    });
  }

  console.log("\nSeed completado:");
  console.log(`- ${stores.length} locales`);
  console.log(`- ${stores.reduce((sum, store) => sum + store.items.length, 0)} platos`);
  console.log(`- ${couriers.length} repartidores`);
  console.log(`- ${createdOrders} pedidos`);
  console.log("\nCuentas demo (password: fogon123):");
  console.log("- admin@fogon.cl");
  console.log("- local@fogon.cl");
  console.log("- cliente@fogon.cl");
  console.log("- repartidor@fogon.cl");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
