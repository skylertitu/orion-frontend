# Orion Frontend

Next.js 16 (App Router) en el puerto **3000**. El proxy `/api/*` apunta al backend en `http://localhost:3008`.

## Arranque

```bat
cd C:\PROYECTOS\orion\frontend
pnpm install
pnpm run dev
```

Abre http://localhost:3000

Copia `.env.example` a `.env.local`. Si `pnpm install` falla con `ERR_PNPM_IGNORED_BUILDS`, pon `true` o `false` (no el texto placeholder) en `pnpm-workspace.yaml` → `allowBuilds`.

## Variables

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
BACKEND_URL=http://localhost:3008
```

Las `NEXT_PUBLIC_FIREBASE_*` salen de Firebase Console → Project settings → Your apps → app web.

Sin esas variables el botón **Continuar con Google** muestra un error en pantalla y **no llama** al backend.

## Login con Google

1. El usuario pulsa **Continuar con Google**.
2. Firebase Auth abre el popup y emite un ID token.
3. El frontend envía `POST /api/auth/google` (rewrite hacia el backend).
4. El backend verifica el token, crea o vincula el usuario, y devuelve el JWT de Orion.

El alta del usuario se ve en la **terminal del backend**, no en la de Next:

```
[auth] Nuevo usuario creado vía Google id=12 email=ana@gmail.com username=ana
```

Errores típicos en el navegador (no llegan al backend):

- `auth/unauthorized-domain` → agrega `localhost` en Firebase → Authentication → Settings.
- Popup cerrado por el usuario → se ignora.
- Faltan `NEXT_PUBLIC_FIREBASE_*` → configura `.env.local` y reinicia `pnpm run dev`.

## Rutas

| Ruta | Uso |
|------|-----|
| `/` | Login |
| `/forgot-password` | Recuperar contraseña |
| `/reset-password` | Nueva contraseña (token del correo) |
| `/register` | Registro (correo o Google) |
| `/dashboard` | Panel |
| `/trading` | Órdenes |
| `/mercado` | Mercado en vivo |
| `/lucy` | Lucy IA |
| `/cuentas` | Brokers |
| `/ajustes` | Perfil / wallets |

El backend debe estar en marcha (`pnpm run dev` en `autotrading-back/backend`) para login, Google y trading.

## Recuperar contraseña

El correo de Gmail (Firebase) abre una página blanca y suele caducar porque Gmail escanea el enlace. En `/forgot-password` usa **Restablecer contraseña en AutoTrade**. No uses esa página de Firebase.

Para que el correo abra AutoTrade: Firebase Console → Authentication → Templates → Action URL = `http://localhost:3000/reset-password`.

Si el usuario se registró con Google, puede entrar con **Continuar con Google** sin esperar el correo. En desarrollo la UI muestra un enlace de restablecimiento si el backend lo devuelve.
