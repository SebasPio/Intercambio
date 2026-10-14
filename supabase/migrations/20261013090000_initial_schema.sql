-- Migración inicial: estructura del intercambio.
-- Convenciones:
--   * Tablas de datos (participants, assignments, gift_options): lectura pública.
--   * Tablas internas (access_identities, edit_permissions, sessions): sin acceso
--     para anon/authenticated; solo service_role (edge functions y scripts).
--   * Ninguna escritura directa desde el cliente: no se conceden INSERT/UPDATE/DELETE.

-- ---------------------------------------------------------------------------
-- Tablas de datos (lectura pública)
-- ---------------------------------------------------------------------------

create table public.participants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint participants_name_len check (char_length(btrim(name)) between 1 and 80)
);

-- Asignación del intercambio: quien regala (giver) -> quien recibe (receiver).
create table public.assignments (
  id                     uuid primary key default gen_random_uuid(),
  giver_participant_id    uuid not null references public.participants(id) on delete cascade,
  receiver_participant_id uuid not null references public.participants(id) on delete cascade,
  created_at             timestamptz not null default now(),
  constraint assignments_giver_unique    unique (giver_participant_id),
  constraint assignments_receiver_unique unique (receiver_participant_id),
  constraint assignments_no_self         check (giver_participant_id <> receiver_participant_id)
);

-- Opciones de regalo, ordenadas por participante.
create table public.gift_options (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  position       integer not null,
  text           text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint gift_options_position_positive check (position >= 0),
  constraint gift_options_text_len          check (char_length(btrim(text)) between 1 and 120),
  constraint gift_options_participant_pos   unique (participant_id, position)
);

-- ---------------------------------------------------------------------------
-- Tablas internas (sin acceso público)
-- ---------------------------------------------------------------------------

-- Identidad de acceso representada por un enlace. No tiene que corresponder a
-- un participante del intercambio. credential_hash = sha256(credencial).
create table public.access_identities (
  id              uuid primary key default gen_random_uuid(),
  display_name    text not null,
  credential_hash text not null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint access_identities_display_len check (char_length(btrim(display_name)) between 1 and 80),
  constraint access_identities_credential_unique unique (credential_hash)
);

-- Permisos de edición: identidad -> participante (N:M). Independiente de assignments.
create table public.edit_permissions (
  identity_id    uuid not null references public.access_identities(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (identity_id, participant_id)
);

-- Sesiones temporales derivadas de un enlace. token_hash = sha256(token).
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  identity_id  uuid not null references public.access_identities(id) on delete cascade,
  token_hash   text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  constraint sessions_token_unique unique (token_hash)
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index assignments_receiver_idx      on public.assignments (receiver_participant_id);
create index edit_permissions_participant_idx on public.edit_permissions (participant_id);
create index sessions_identity_idx         on public.sessions (identity_id);
create index sessions_expires_idx          on public.sessions (expires_at);

-- ---------------------------------------------------------------------------
-- updated_at automático para gift_options
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger gift_options_set_updated_at
before update on public.gift_options
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seguridad: RLS
-- ---------------------------------------------------------------------------

alter table public.participants      enable row level security;
alter table public.assignments       enable row level security;
alter table public.gift_options      enable row level security;
alter table public.access_identities enable row level security;
alter table public.edit_permissions  enable row level security;
alter table public.sessions          enable row level security;

-- Lectura pública de los datos del intercambio.
create policy participants_public_read
  on public.participants for select to anon, authenticated using (true);

create policy assignments_public_read
  on public.assignments for select to anon, authenticated using (true);

create policy gift_options_public_read
  on public.gift_options for select to anon, authenticated using (true);

-- Las tablas internas no tienen políticas: quedan denegadas para anon/authenticated.

-- ---------------------------------------------------------------------------
-- Seguridad: privilegios explícitos
-- ---------------------------------------------------------------------------

-- Solo lectura para los visitantes en las tablas de datos.
revoke all on public.participants from anon, authenticated;
revoke all on public.assignments  from anon, authenticated;
revoke all on public.gift_options from anon, authenticated;

grant select on public.participants to anon, authenticated;
grant select on public.assignments  to anon, authenticated;
grant select on public.gift_options to anon, authenticated;

-- Sin acceso alguno a las tablas internas.
revoke all on public.access_identities from anon, authenticated;
revoke all on public.edit_permissions  from anon, authenticated;
revoke all on public.sessions          from anon, authenticated;
