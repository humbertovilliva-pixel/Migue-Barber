# Miguel Suárez — Barbería a domicilio

Sitio web y panel administrativo para Miguel Suárez, barbero profesional a domicilio en Torreón, Coahuila.

## Arquitectura de producción

- Frontend: Expo Router + React Native Web
- Hosting: Netlify
- Base de datos: Supabase Postgres
- Autenticación admin: Supabase Auth
- Imágenes: Supabase Storage (`barber-media`)
- Seguridad: Row Level Security (RLS) en todas las tablas públicas

El backend FastAPI/MongoDB utilizado durante el prototipo fue retirado de la versión de producción.

## Desarrollo

```bash
cd frontend
npm install
npm run web
```

Crea `frontend/.env.local` a partir de `frontend/.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Nunca guardes claves secretas o `service_role` en el frontend.

## Build web

```bash
cd frontend
npm run build:web
```

Netlify usa `netlify.toml` y publica `frontend/dist`.

## Supabase

Las migraciones versionadas están en `supabase/migrations/` y reflejan el historial aplicado al proyecto de producción.

Incluyen:

- tablas y relaciones
- datos iniciales de servicios, zonas, FAQ, políticas y contenido
- funciones transaccionales para disponibilidad y reservas
- protección contra horarios superpuestos
- RLS y permisos
- bucket `barber-media`
- auditoría administrativa

## Administrador

La dirección autorizada está en `public.admin_allowlist`. El usuario correspondiente debe existir además en Supabase Auth. Las contraseñas nunca deben guardarse en este repositorio.
