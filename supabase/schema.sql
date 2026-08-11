-- Synergy CRM — esquema inicial para Supabase.
-- Correr una sola vez en el SQL Editor del dashboard (Database → SQL Editor → New query).

create extension if not exists pg_trgm;

create table if not exists clientes (
  id text primary key, -- correo normalizado (lowercase, trim)
  nombre text not null,
  email text not null,
  telefono text,
  pais text,
  ciudad text,
  notas text,
  fecha_inscripcion timestamptz,
  fin_acceso timestamptz,
  boletos_sin_informacion boolean not null default false,
  -- Fila del CSV de origen donde cayó por última vez este correo. Define el
  -- orden de la lista principal: la fila más alta = la más reciente.
  orden_csv bigint not null default 0,

  fecha_evento text,
  evento text,
  acceso_plataforma text,
  tipo_membresia text,
  vencimiento_skool text, -- texto libre tal como viene del CSV (D/M/YYYY)
  vencimiento_skool_fecha date, -- misma fecha, parseada, para filtrar/ordenar
  invitacion_skool text,
  contacto_whats text,
  llamada text,
  notas_soporte text,

  -- Región derivada del evento (tabla de inventario de boletos) o, si el
  -- evento no está catalogado, del país capturado a mano. Se recalcula en
  -- cada migración/reasignación de boletos.
  region text not null default 'LATAM' check (region in ('MX', 'US', 'LATAM')),

  accesos jsonb not null default '{
    "general": {"activo": false, "cantidad": 0, "variante": null},
    "vip": {"activo": false, "cantidad": 0, "variante": null},
    "black": {"activo": false, "cantidad": 0, "variante": null}
  }'::jsonb,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_clientes_orden_csv on clientes (orden_csv desc);
create index if not exists idx_clientes_evento on clientes (evento);
create index if not exists idx_clientes_tipo_membresia on clientes (tipo_membresia);
create index if not exists idx_clientes_acceso_plataforma on clientes (acceso_plataforma);
create index if not exists idx_clientes_region on clientes (region);
create index if not exists idx_clientes_fecha_inscripcion on clientes (fecha_inscripcion);
create index if not exists idx_clientes_vencimiento_skool_fecha on clientes (vencimiento_skool_fecha);
create index if not exists idx_clientes_nombre_trgm on clientes using gin (nombre gin_trgm_ops);
create index if not exists idx_clientes_email_trgm on clientes using gin (email gin_trgm_ops);

create table if not exists eventos_timeline (
  -- text, no uuid: los eventos de la importación masiva usan ids propios
  -- ("import-correo@..."), los generados por la app sí son UUID v4 pero se
  -- guardan igual como texto.
  id text primary key default gen_random_uuid()::text,
  cliente_id text not null references clientes (id) on delete cascade,
  tipo text not null,
  detalle text,
  autor text not null,
  fecha timestamptz not null default now()
);

create index if not exists idx_eventos_cliente_id on eventos_timeline (cliente_id, fecha);
create index if not exists idx_eventos_fecha on eventos_timeline (fecha desc);
create index if not exists idx_eventos_tipo on eventos_timeline (tipo);

-- RLS activo sin policies: bloquea cualquier acceso vía la publishable key
-- (anon). Toda la app pasa por el servidor de Next.js usando la secret key,
-- que ignora RLS. Si más adelante agregas acceso directo desde el
-- navegador, tendrás que crear policies explícitas aquí.
alter table clientes enable row level security;
alter table eventos_timeline enable row level security;

-- Integración con Kajabi: id del contacto en Kajabi, para no tener que
-- rebuscarlo por correo en cada alta/otorgamiento de oferta.
alter table clientes add column if not exists kajabi_contact_id text;
