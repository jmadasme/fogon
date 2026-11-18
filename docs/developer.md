# Fogón · developer

## Mapa del código

```text
fogon/
├── v1/                  # primera versión: pedidos, reparto y pagos manuales
├── v2/                  # segunda versión: Flow, auditorías y hardening
├── docs/                # página, datasheet y developer
├── README.md
└── .env.example         # variables de entorno, secretos en "x"
```

## Flujo de datos

1. `Cliente` — web
2. `Next.js` — API + UI
3. `Prisma` — PostgreSQL
4. `Repartidor` — Expo
5. `Pagos` — Flow / sandbox

## Decisiones de diseño

- **La base operativa** (V1): Pedidos, reparto, roles, comisiones y pagos con Mercado Pago, Transbank y efectivo.
- **La capa de confianza** (V2): Flow online, efectivo deshabilitado, auditorías, multi-modelo y hardening P0.
- **Pruebas en terreno** (QA): Capturas de escritorio, mobile, QA nativo y e2e; build y lint documentados.

## Stack

Next.js, TypeScript, Prisma, PostgreSQL, Expo, Docker, Caddy, Flow.

La app web y la API viven en Next.js. Prisma modela usuarios, locales, platos, pedidos, pagos y auditorías sobre PostgreSQL. La app móvil usa Expo para el repartidor. El despliegue documentado usa Docker, Caddy y Cloudflare; las credenciales se inyectan por entorno.

## Cómo extenderlo

- Separá la lógica de dominio de la interfaz: el motor debe poder probarse sin navegador.
- Mantené los datos de demo fuera de la lógica y documentá su origen.
- Si agregás una integración externa, poné las credenciales en variables de entorno y un `.env.example` con `x`.
- Agregá una prueba de humo por cada flujo crítico antes de publicar.

## Puesta en marcha

```bash
# V2 (recomendada)
cd v2
cp .env.example .env
# Editar DATABASE_URL y los secretos que correspondan
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
# Abrir http://localhost:3000

# V1
cd ../v1
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

## Seguridad

Los secretos viven en `.env` y nunca se versionan. El repo incluye `.env.example` con valores `x`. Las cuentas demo usan una contraseña conocida solo para desarrollo; no las uses en producción.

## Límites conocidos

- **Datos de demostración**: Los 34 locales y 170 platos son seed. No representan comercios reales.
- **Pagos en sandbox**: Flow y los demás medios se documentan con credenciales de prueba; no hay cobros reales en la demo.
- **App móvil**: La app Expo requiere build propio y un dispositivo; no se distribuye como APK en el repo.
- **Dos versiones**: V1 y V2 conviven para comparar. La versión recomendada para operar es V2.

## Enlaces

- [README](../README.md)
- [Datasheet](datasheet.md)
- [Repositorio](https://github.com/jmadasme/fogon)
