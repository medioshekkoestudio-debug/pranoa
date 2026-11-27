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

1. **Supabase**: crear un proyecto nuevo (el de producción está en `us-west-2`; `us-east-1` queda más cerca de Venezuela).
2. En el **SQL Editor** del proyecto Pranoa, correr **en orden**:
   - `supabase/migrations/0001_inicial.sql`
   - `supabase/migrations/0002_datos_ejemplo.sql` (carta y zonas de Valencia de ejemplo)
   - `supabase/migrations/0003_permisos_tablas.sql` (sin esta, la web no puede leer nada: los proyectos nuevos de Supabase no dan permisos de tabla por defecto)
   - `supabase/migrations/0004_corregir_proteger_perfil.sql` (sin esta, un mesonero podría ponerse rol de administrador)
   - `supabase/migrations/0005_nombres_mesas.sql` (mesas alfanuméricas A01, B01-B06, C01-C06, D01-D02, E01, F01-F07, G01 + puestos configurables)
   - `supabase/migrations/0006_editar_pedido_mesonero.sql` (edición de pedidos enviados a cocina con notificación)
   - `supabase/migrations/0007_cocina_subestados_tiempos.sql` (subestados Preparando/Retirar/Entregado por plato y tiempo estimado por comida)
   - `supabase/migrations/0008_flujo_factura_cuenta.sql` (solicitud de factura Mesonero ↔ Cajero con datos del cliente y cierre Pagado)
   - `supabase/migrations/0009_clientes_y_llamadas_nota.sql` (registro de clientes QR, estatus por plato en mesa y nota al llamar mesonero)
3. **Authentication → Sign In / Providers → Email**: desactivar **«Allow new users to sign up»**.
   Las cuentas del personal las crea el administrador desde la app.
4. **Primer administrador**: el personal entra con **usuario**, no con correo; por dentro el usuario `admin_pranoa`
   se guarda como `admin_pranoa@pranoa.local` (ver `lib/usuario.ts`).
   Authentication → Users → *Add user* con ese correo interno + contraseña, marcar *Auto confirm*.
   Copiar su ID y en el SQL Editor:
   ```sql
   insert into perfiles (id, nombre, rol) values ('ID-DEL-USUARIO', 'Nombre del dueño', 'admin');
   ```
5. Copiar `.env.example` a `.env.local` y llenar las claves (Project Settings → API).
6. `npm install` y `npm run dev` → http://localhost:3000

## Despliegue en Vercel

Importar el repositorio en Vercel y cargar las mismas 4 variables de `.env.example`
(`NEXT_PUBLIC_SITE_URL` = el dominio final). `SUPABASE_SERVICE_ROLE_KEY` nunca lleva `NEXT_PUBLIC_`.

Los **QR de las mesas** apuntan siempre a `https://www.espaciopranoa.com` (se puede cambiar con `NEXT_PUBLIC_QR_URL`).
También se pueden generar en PDF y PNG listos para imprimir con `npm run qr` (salida en `qr-impresion/`).

Para la **tasa BCV diaria automática**, usar un cron externo gratuito (ej. `cron-job.org`) apuntando cada día a las 9:00 a. m. (hora Venezuela) a:
`https://www.espaciopranoa.com/api/tasa-bcv?sincronizar=1&clave=<CRON_SECRET>`
(definir `CRON_SECRET` en Vercel → Settings → Environment Variables).

## Marca

Logo y favicon oficiales en `public/marca/`. `components/Logo.tsx` los pinta en cualquier color de marca usando
`logo-blanco.png` e `isotipo.png` como máscara. Los íconos de la app se regeneran con `npm run iconos`
a partir de `public/marca/favicon-original.png`.

## Pendiente

- **Fotos reales** de los platos (se suben desde Panel → Carta → tocar un plato).
- **Datos reales** en Panel → Ajustes: WhatsApp, Instagram, dirección, Pago Móvil y Zelle.
- **Avisos con la app cerrada** (push real): hoy los avisos suenan y notifican mientras la app está abierta o en
  segundo plano. Para recibirlos con la app cerrada hace falta Web Push (claves VAPID + función en el servidor).
- El cálculo de envío es **por zona** (tarifa fija por zona). Si se quiere por kilómetros exactos hace falta
  la API de Google Maps (de pago).
