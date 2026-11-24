# Pranoa · PWA (Next.js 14 + Supabase + Vercel)

Carta digital (QR de mesa y delivery), reservas, comandera de mesoneros, pantalla de cocina (KDS),
caja multimoneda ($ / Bs.) y panel del dueño. Sin Firebase: todo el tiempo real va por Supabase Realtime.

## Perfiles y permisos

| Perfil | Menú inferior | Qué puede hacer |
|---|---|---|
| **Administrador** | Resumen · Mesas · Cocina · Caja · Más | Todo: reportes, costos/escandallo, carta, personal, mesas y QR, zonas, ajustes |
| **Caja** | Caja · Mesas · Delivery · Reservas · Más | Tasa del día (manual o BCV), cobrar y verificar pagos, cerrar cuentas, confirmar deliveries, asignar motorizado, cancelar platos ya en cocina |
| **Mesonero** | Mesas · Reservas · Carta · Más | Mapa de mesas, tomar pedidos por puesto, confirmar pedidos del QR, dividir cuenta, marcar servido, atender llamadas; cancela solo antes de que cocina empiece |
| **Cocina** | Cocina · Carta · Más | Tablero Por preparar → En preparación → Listo, con temporizadores; apagar platos agotados |
| **Motorizado** | Entregas · Más | Solo ve sus entregas: llamar, WhatsApp, mapa, «salgo» y «entregado» |
| **Público** | Inicio · Carta · Delivery · Reservar · Contacto | Sin cuenta. En la mesa (QR): Carta · Mis pedidos · Mesonero · La cuenta |

Las reglas viven en la base de datos (RLS + funciones en `supabase/migrations/0001_inicial.sql`), no solo en
la pantalla: aunque alguien manipule la app, la base rechaza lo que su perfil no puede hacer.
`lib/permisos.ts` decide qué secciones y menú ve cada perfil.

## Puesta en marcha

1. **Supabase**: crear un proyecto nuevo (región más cercana: `us-east-1`).
2. En el **SQL Editor** del proyecto Pranoa, correr en orden:
   - `supabase/migrations/0001_inicial.sql`
   - `supabase/migrations/0002_datos_ejemplo.sql` (carta, 12 mesas y zonas de Valencia de ejemplo)
3. **Authentication → Sign In / Providers → Email**: desactivar **«Allow new users to sign up»**.
   Las cuentas del personal las crea el administrador desde la app.
4. **Primer administrador**: Authentication → Users → *Add user* (correo + contraseña, marcar *Auto confirm*).
   Copiar su ID y en el SQL Editor:
   ```sql
   insert into perfiles (id, nombre, rol) values ('ID-DEL-USUARIO', 'Nombre del dueño', 'admin');
   ```
5. Copiar `.env.example` a `.env.local` y llenar las claves (Project Settings → API).
6. `npm install` y `npm run dev` → http://localhost:3000

## Despliegue en Vercel

Importar el repositorio en Vercel y cargar las mismas 4 variables de `.env.example`
(`NEXT_PUBLIC_SITE_URL` = el dominio final). `SUPABASE_SERVICE_ROLE_KEY` nunca lleva `NEXT_PUBLIC_`.

## Pendiente

- **Logo oficial**: el isotipo actual es un dibujo provisional hecho a partir del manual. Guardar el SVG oficial
  en blanco como `public/marca/isotipo.svg` y correr `npm run iconos` para regenerar los íconos de la app.
  Para el logotipo «pranoa» (tipografía propia) reemplazar `components/Logo.tsx` con el SVG oficial.
- **Fotos reales** de los platos (se suben desde Panel → Carta → tocar un plato).
- **Datos reales** en Panel → Ajustes: WhatsApp, Instagram, dirección, Pago Móvil y Zelle.
- **Avisos con la app cerrada** (push real): hoy los avisos suenan y notifican mientras la app está abierta o en
  segundo plano. Para recibirlos con la app cerrada hace falta Web Push (claves VAPID + función en el servidor).
- El cálculo de envío es **por zona** (tarifa fija por zona). Si se quiere por kilómetros exactos hace falta
  la API de Google Maps (de pago).
