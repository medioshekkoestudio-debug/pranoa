# Pranoa — Actualización del proyecto

_Fecha: 24 de noviembre de 2026_

App web (PWA, se descarga al teléfono como una app) del restaurante **Pranoa · un refugio seguro**, Valencia, Carabobo.
Hecha a partir de la propuesta técnica y el manual de marca. **Sin Firebase**: todo funciona con Supabase.

---

## 1. Dónde está todo

| Qué | Dónde |
|---|---|
| Web publicada | https://pranoa.vercel.app |
| Dominio propio | https://espaciopranoa.com (conectado en Vercel, esperando que termine de propagarse) |
| Código | https://github.com/medioshekkoestudio-debug/pranoa |
| Base de datos | Supabase, proyecto `cuhtkfgapzrgxgrmnqap` |
| Hosting | Vercel, proyecto `hekkoweb/pranoa` |
| Guía técnica | `LEEME.md` en este mismo proyecto |

---

## 2. Lo que ya está hecho

### Parte pública (clientes, sin cuenta)
- **Portada** con accesos a carta, delivery y reservas; horario, dirección, WhatsApp y botón para descargar la app.
- **Carta** con buscador, categorías, filtro por alérgenos y precios en dólares y bolívares (tasa del día).
- **Delivery**: el cliente arma su pedido, elige su zona (el envío se calcula solo), método de pago y referencia. Recibe un enlace para **seguir su pedido** en vivo.
- **Reservas**: salón principal o terraza.
- **Contacto** con mapa.
- **Pedido desde la mesa por QR**: el cliente escanea el QR, ve la carta, pide, llama al mesonero y pide la cuenta.
- Los precios siempre los calcula el servidor: el cliente no puede cambiarlos.

### Personal (cada perfil con su usuario, contraseña y menú inferior propio)

| Perfil | Qué puede hacer |
|---|---|
| **Administrador** | Todo: resumen de ventas, mesas, cocina, caja, carta y costos, personal, zonas, mesas y QR, ajustes |
| **Cajero** | Cobrar, verificar pagos, fijar la tasa, confirmar deliveries y asignar motorizado, reservas |
| **Mesonero** | Abrir mesas, tomar pedidos por puesto, confirmar pedidos del QR, dividir cuentas, marcar servido, reservas |
| **Cocina** | Tablero de pedidos en 3 columnas con tiempos y alerta de atraso; apagar platos agotados |
| **Motorizado** | Solo ve sus entregas asignadas |

- Avisos con sonido y notificación cuando llega algo nuevo para cada perfil.
- Todo se actualiza en tiempo real entre teléfonos.
- Pagos: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares y punto.
- Tasa BCV consultada automáticamente.
- El personal entra con **usuario** (no con correo).
- El administrador puede **crear más usuarios** de cualquier perfil, cambiar contraseñas, cambiar perfiles y desactivar cuentas desde **Personal**.

### Cuentas creadas
`admin_pranoa`, `cajero_pranoa`, `mesonero1_pranoa`, `motorizado1_pranoa`, `cocina1_pranoa`.
Las contraseñas las tiene la administración. No se guardan en este archivo.

> El motorizado quedó como `motorizado1_pranoa` porque en la lista venía con el mismo usuario del mesonero.

### Seguridad
- Cada perfil solo puede hacer lo suyo. Las reglas viven en la base de datos, no solo en la pantalla.
- Probado con 21 pruebas de permisos usando cuentas de prueba, que luego se borraron.
- Se corrigió un fallo que dejaba a un mesonero cambiarse a administrador.
- El registro público está desactivado: solo el administrador crea cuentas.

### Marca
- Colores del manual: oliva, naranja, taupe, ciruela y crema. Tipografía Poppins.
- **Logo oficial completo** en la web y **favicon oficial** en la pestaña y en el ícono de la app.
  - Están en `public/marca/`.
  - Se regeneran con `npm run iconos`.
  - _Revisado en local, falta publicarlo._

### Datos de ejemplo cargados
5 categorías, 14 platos, 12 mesas (de la 13 en adelante, terraza), 6 zonas de delivery en Valencia, tasa de ejemplo 40.

---

## 3. Lo que falta por hacer o definir

### Pendientes inmediatos
- [ ] **Publicar los logos nuevos** (están listos en local).
- [ ] **Dominio espaciopranoa.com**:
  1. Cuando termine de propagar, cambiar `NEXT_PUBLIC_SITE_URL` a `https://espaciopranoa.com` en Vercel.
  2. Volver a desplegar sin caché.
  3. Comprobar que todo funciona.
- [ ] **Reimprimir los QR de las mesas** desde *Panel → Mesas y QR*, una vez esté el dominio, para que apunten a espaciopranoa.com.
- [ ] **Borrar el token de Supabase** que se usó para la configuración: https://supabase.com/dashboard/account/tokens
- [ ] **Cambiar las contraseñas** del personal, porque se compartieron por chat. Se hace desde *Panel → Personal → Nueva contraseña*.

### Contenido por definir (lo pone el restaurante)
- [ ] **Carta real**: platos, descripciones, precios, alérgenos y **fotos** (reemplazan los datos de ejemplo).
- [ ] **Costos** de cada plato, para los reportes del administrador.
- [ ] **Mesas reales**: cantidad, numeración y cuáles son de terraza.
- [ ] **Zonas de delivery** reales con su precio de envío.
- [ ] **Ajustes del negocio**:
  - WhatsApp, horario, dirección y enlace de Google Maps.
  - Datos de Pago Móvil y Zelle.
- [ ] **Personal real**: crear las cuentas de cada mesonero, cocinero y motorizado.

### Decisiones por tomar
- [ ] ¿Los pedidos por QR necesitan que el mesonero los **apruebe** antes de ir a cocina? Hoy se puede activar o desactivar en Ajustes.
- [ ] ¿El **delivery** queda activo desde el primer día?
- [ ] ¿Cuántos minutos son "pedido atrasado" para la alerta de cocina?
- [ ] ¿Se quieren **notificaciones con la app cerrada** (Web Push)? Hoy los avisos llegan con la app abierta o en segundo plano.

### Mejoras posibles a futuro
- [ ] Notificaciones push con la app cerrada.
- [ ] Reportes más detallados (por plato, por mesonero, por día).
- [ ] Confirmación de reservas por WhatsApp.
