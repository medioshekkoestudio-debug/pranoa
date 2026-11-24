-- Datos de ejemplo para probar. Cambiar desde el panel de administración.
with c as (
  insert into categorias (nombre, orden) values
    ('Para compartir', 1), ('Principales', 2), ('Bowls y ensaladas', 3), ('Postres', 4), ('Bebidas', 5)
  returning id, nombre
)
insert into productos (categoria_id, nombre, descripcion, precio_usd, costo_usd, alergenos, orden)
select c.id, p.nombre, p.descripcion, p.precio, p.costo, p.alergenos, p.orden
from c join (values
  ('Para compartir', 'Hummus de la casa', 'Garbanzo, tahini, aceite de oliva y pan pita tibio', 7.50, 2.10, array['sésamo','gluten'], 1),
  ('Para compartir', 'Tequeños de queso llanero', 'Seis unidades con salsa de ajo y miel', 6.00, 1.80, array['gluten','lácteos'], 2),
  ('Para compartir', 'Burrata con tomates asados', 'Burrata, tomates confitados, albahaca y pesto', 11.00, 4.20, array['lácteos','frutos secos'], 3),
  ('Principales', 'Pesca del día a la plancha', 'Con puré de batata y vegetales salteados', 16.00, 6.50, array['pescado'], 1),
  ('Principales', 'Lomito al chimichurri', 'Lomito de res, papas rústicas y ensalada', 18.00, 7.80, array[]::text[], 2),
  ('Principales', 'Risotto de hongos', 'Arroz arborio, hongos, parmesano y trufa', 14.00, 4.90, array['lácteos'], 3),
  ('Principales', 'Pollo mediterráneo', 'Pollo marinado en hierbas, cuscús y yogur de pepino', 13.00, 4.30, array['gluten','lácteos'], 4),
  ('Bowls y ensaladas', 'Bowl Pranoa', 'Quinoa, aguacate, garbanzos crujientes, vegetales y aderezo de limón', 10.50, 3.40, array[]::text[], 1),
  ('Bowls y ensaladas', 'Ensalada griega', 'Tomate, pepino, cebolla morada, aceitunas y queso feta', 9.00, 2.90, array['lácteos'], 2),
  ('Postres', 'Tres leches de pistacho', 'Bizcocho húmedo con crema de pistacho', 6.50, 1.90, array['gluten','lácteos','huevo','frutos secos'], 1),
  ('Postres', 'Marquesa de chocolate', 'Galleta, chocolate oscuro y crema', 6.00, 1.70, array['gluten','lácteos','huevo'], 2),
  ('Bebidas', 'Limonada de hierbabuena', 'Natural, endulzada con papelón', 3.50, 0.60, array[]::text[], 1),
  ('Bebidas', 'Matcha latte', 'Matcha ceremonial con leche a elección', 4.50, 1.20, array['lácteos'], 2),
  ('Bebidas', 'Café de especialidad', 'Espresso, americano o guayoyo', 2.50, 0.50, array[]::text[], 3)
) as p(cat, nombre, descripcion, precio, costo, alergenos, orden) on p.cat = c.nombre;

insert into mesas (numero, ambiente, capacidad)
select n, case when n > 8 then 'terraza'::ambiente_mesa else 'salon'::ambiente_mesa end, case when n % 3 = 0 then 6 else 4 end
from generate_series(1, 12) n;

insert into zonas_delivery (nombre, tarifa_usd, orden) values
  ('Valencia norte (El Viñedo, La Viña, Prebo)', 2.00, 1),
  ('Valencia centro', 2.50, 2),
  ('San Diego', 3.00, 3),
  ('Naguanagua', 3.00, 4),
  ('Valencia sur', 3.50, 5),
  ('Los Guayos / Tocuyito', 4.50, 6);

update ajustes set tasa_bs = 40, tasa_fuente = 'ejemplo', tasa_actualizada = now() where id = 1;
