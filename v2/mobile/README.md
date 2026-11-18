# Fogón Mobile

App Expo/React Native para **clientes** y **repartidores** de Fogón.

## Requisitos

- Node.js 20+.
- Expo Go en el teléfono.
- Servidor Fogón en `http://<IP-de-tu-computador>:3000`.

## Levantar el servidor

Desde la raíz del proyecto:

```bash
npm run dev -- --hostname 0.0.0.0
```

## Levantar la app

```bash
cd mobile
npm install
npx expo start
```

Escanea el QR con Expo Go.

La app detecta la IP del servidor desde Metro. Si no funciona, crea `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.9:3000
```

## Cuentas demo

| Rol | Email | Contraseña |
|---|---|---|
| Cliente | `cliente@fogon.cl` | `fogon123` |
| Repartidor demo (KYC aprobado) | `repartidor@fogon.cl` | `fogon123` |
| Repartidor QA (cuenta libre) | `courier2@fogon.cl` | `fogon123` |

En desarrollo, el login muestra botones para entrar como cliente o repartidor.
El botón “Repartidor demo” usa la misma cuenta que el botón “Repartidor” de la
web, para que el KYC aprobado sea consistente entre app y navegador.

## Scripts

```bash
npx expo start          # desarrollo
npx expo start --web    # preview web
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npx expo export --platform web
```

## Documentación

La guía completa está en:

`../docs/14-app-movil.md`

## Notas

- No hay notificaciones push; la app consulta cada 5 segundos.
- El pago online abre el navegador; el pago en efectivo se cobra al entregar.
- Para tiendas se requiere EAS Build.
