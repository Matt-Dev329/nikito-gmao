
-- ============================================================================
-- INTÉGRATION ROLLER DANS ALBA — FONDATIONS
-- ============================================================================

-- 1. Cache des tokens OAuth Roller par venue
create table if not exists public.roller_tokens (
  venue_code text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.roller_tokens enable row level security;

drop policy if exists "service_role_only_tokens" on public.roller_tokens;
create policy "service_role_only_tokens"
  on public.roller_tokens for all to service_role
  using (true) with check (true);

comment on table public.roller_tokens is 'Cache des Bearer tokens OAuth Roller (TTL ~23h, renouvelés automatiquement)';

-- 2. Journal des synchros Roller (qui/quand/quoi/succès)
create table if not exists public.roller_sync_log (
  id uuid primary key default gen_random_uuid(),
  venue_code text not null,
  endpoint text not null,
  sync_type text not null,
  start_date date,
  end_date date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  http_status int,
  items_received int default 0,
  items_inserted int default 0,
  items_updated int default 0,
  items_skipped int default 0,
  error_message text,
  meta jsonb
);

create index if not exists idx_roller_sync_log_venue_endpoint
  on public.roller_sync_log(venue_code, endpoint, started_at desc);

alter table public.roller_sync_log enable row level security;

drop policy if exists "service_role_only_synclog" on public.roller_sync_log;
create policy "service_role_only_synclog"
  on public.roller_sync_log for all to service_role
  using (true) with check (true);

drop policy if exists "auth_read_synclog" on public.roller_sync_log;
create policy "auth_read_synclog"
  on public.roller_sync_log for select to authenticated
  using (true);

comment on table public.roller_sync_log is 'Journal des synchronisations Roller — suivi quotidien, debug, audit';

-- 3. Mapping venues Roller ↔ parcs ALBA
alter table public.parcs
  add column if not exists roller_venue_code text,
  add column if not exists roller_venue_name text;

update public.parcs set roller_venue_code = 'SGB'   where code = 'SGB'   and roller_venue_code is null;
update public.parcs set roller_venue_code = 'ALF'   where code = 'ALF'   and roller_venue_code is null;
update public.parcs set roller_venue_code = 'FRA'   where code = 'FRA'   and roller_venue_code is null;
update public.parcs set roller_venue_code = 'ROSNY' where code = 'DOM'   and roller_venue_code is null;

create unique index if not exists idx_parcs_roller_venue on public.parcs(roller_venue_code)
  where roller_venue_code is not null;

-- 4. ATTRACTIONS (activités commerciales, distinctes des équipements techniques)
create table if not exists public.attractions (
  id uuid primary key default gen_random_uuid(),
  parc_id uuid not null references public.parcs(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete set null,

  -- Identification
  code text not null,
  libelle text not null,
  type_attraction text,

  -- Mapping Roller
  roller_product_id text,
  roller_product_type text,
  roller_product_subtype text,
  roller_default_price numeric(10,2),

  -- Métadonnées métier (ALBA-only)
  nb_sous_unites int default 1,
  capacite_simultanee int,
  duree_moyenne_minutes int,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  date_mise_service date,
  marque text,
  modele text,
  numero_serie text,
  photo_url text,

  -- État
  statut text not null default 'actif',
  a_surveiller boolean not null default false,
  est_formation boolean not null default false,

  -- Traçabilité
  source text default 'roller',
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  meta jsonb,

  constraint attractions_code_parc_unique unique (parc_id, code)
);

create index if not exists idx_attractions_parc on public.attractions(parc_id);
create index if not exists idx_attractions_roller_product on public.attractions(roller_product_id);
create index if not exists idx_attractions_statut on public.attractions(statut);

alter table public.attractions enable row level security;

drop policy if exists "service_role_all_attractions" on public.attractions;
create policy "service_role_all_attractions"
  on public.attractions for all to service_role
  using (true) with check (true);

drop policy if exists "auth_read_attractions" on public.attractions;
create policy "auth_read_attractions"
  on public.attractions for select to authenticated
  using (true);

comment on table public.attractions is 'Activités commerciales (bowling, trampoline, prison island…) — synchronisées depuis Roller /data/products';

-- 5. Liaison attraction_id dans plaintes_clients / incidents / interventions
alter table public.plaintes_clients
  add column if not exists attraction_id uuid references public.attractions(id) on delete set null;

alter table public.incidents
  add column if not exists attraction_id uuid references public.attractions(id) on delete set null;

create index if not exists idx_plaintes_attraction on public.plaintes_clients(attraction_id)
  where attraction_id is not null;
create index if not exists idx_incidents_attraction on public.incidents(attraction_id)
  where attraction_id is not null;

-- 6. Fréquentation quotidienne par parc (depuis /data/attendances)
create table if not exists public.parc_attendance (
  id uuid primary key default gen_random_uuid(),
  parc_id uuid not null references public.parcs(id) on delete cascade,
  date_attendance date not null,
  heure_slot int,
  attendances_count int not null default 0,
  roller_attraction_code text,
  attraction_id uuid references public.attractions(id) on delete set null,
  synced_at timestamptz not null default now(),
  meta jsonb,
  constraint parc_attendance_unique unique (parc_id, date_attendance, heure_slot, roller_attraction_code)
);

create index if not exists idx_parc_attendance_parc_date on public.parc_attendance(parc_id, date_attendance desc);
create index if not exists idx_parc_attendance_attraction on public.parc_attendance(attraction_id)
  where attraction_id is not null;

alter table public.parc_attendance enable row level security;

drop policy if exists "service_role_all_attendance" on public.parc_attendance;
create policy "service_role_all_attendance"
  on public.parc_attendance for all to service_role
  using (true) with check (true);

drop policy if exists "auth_read_attendance" on public.parc_attendance;
create policy "auth_read_attendance"
  on public.parc_attendance for select to authenticated
  using (true);

comment on table public.parc_attendance is 'Fréquentation par parc et créneau horaire — source Roller /data/attendances';

-- 7. Revenue par parc/heure/produit (depuis /reporting/revenue-entries)
create table if not exists public.parc_revenue (
  id uuid primary key default gen_random_uuid(),
  parc_id uuid not null references public.parcs(id) on delete cascade,
  record_date date not null,
  heure_slot int,
  roller_product_id text,
  attraction_id uuid references public.attractions(id) on delete set null,
  transaction_value numeric(12,2) default 0,
  net_revenue numeric(12,2) default 0,
  funds_received numeric(12,2) default 0,
  tax_payable numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  ticket_quantity int default 0,
  booking_reference text,
  roller_entry_id text,
  entry_type text,
  synced_at timestamptz not null default now(),
  meta jsonb,
  constraint parc_revenue_unique unique (roller_entry_id)
);

create index if not exists idx_parc_revenue_parc_date on public.parc_revenue(parc_id, record_date desc);
create index if not exists idx_parc_revenue_attraction on public.parc_revenue(attraction_id)
  where attraction_id is not null;
create index if not exists idx_parc_revenue_product on public.parc_revenue(roller_product_id);

alter table public.parc_revenue enable row level security;

drop policy if exists "service_role_all_revenue" on public.parc_revenue;
create policy "service_role_all_revenue"
  on public.parc_revenue for all to service_role
  using (true) with check (true);

drop policy if exists "auth_read_revenue" on public.parc_revenue;
create policy "auth_read_revenue"
  on public.parc_revenue for select to authenticated
  using (true);

comment on table public.parc_revenue is 'CA granulaire par parc/heure/produit — source Roller /reporting/revenue-entries';

-- 8. Fonction utilitaire : résoudre un parc par son venue_code Roller
create or replace function public.get_parc_by_roller_venue(p_venue_code text)
returns uuid
language sql stable
as $$
  select id from public.parcs
  where roller_venue_code = p_venue_code
  limit 1
$$;

comment on function public.get_parc_by_roller_venue is 'Résout un parc ALBA depuis un code venue Roller (SGB, ALF, FRA, ROSNY, HQ)';
;
