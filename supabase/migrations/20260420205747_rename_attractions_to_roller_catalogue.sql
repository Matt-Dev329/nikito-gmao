
-- 1. Renommer attractions → roller_catalogue (référentiel tarifaire Roller)
alter table public.attractions rename to roller_catalogue;

alter index if exists idx_attractions_parc rename to idx_roller_catalogue_parc;
alter index if exists idx_attractions_roller_product rename to idx_roller_catalogue_roller_product;
alter index if exists idx_attractions_statut rename to idx_roller_catalogue_statut;

comment on table public.roller_catalogue is 'Dictionnaire des produits commerciaux Roller (Pass, Package, PartyPackage) — sert de référentiel pour les types d''attraction et les prix moyens. Ce N''EST PAS la liste des équipements physiques (qui est dans `equipements`).';

-- 2. Ajouter type_attraction dans equipements (pour matcher Roller globalement)
alter table public.equipements
  add column if not exists type_attraction text,
  add column if not exists code_zone text,
  add column if not exists numero_unite int;

comment on column public.equipements.type_attraction is 'Type commercial Roller correspondant (trampoline, bowling, laser_game, prison_island, flechettes, hache, mini_golf, karting, arcades, etc.) — permet de joindre sur roller_catalogue pour calculer CA/fréquentation';
comment on column public.equipements.code_zone is 'Code de zone physique dans le parc (ex: ZONE-1, ZONE-NORD)';
comment on column public.equipements.numero_unite is 'Numéro d''ordre dans la zone (ex: 2 pour le 2e trampoline de la zone 1)';

create index if not exists idx_equipements_type_attraction on public.equipements(type_attraction)
  where type_attraction is not null;

-- 3. Renommer les colonnes de parc_attendance et parc_revenue pour garder la cohérence
alter table public.parc_attendance
  rename column attraction_id to roller_catalogue_id;

alter table public.parc_revenue
  rename column attraction_id to roller_catalogue_id;

alter index if exists idx_parc_attendance_attraction rename to idx_parc_attendance_catalogue;
alter index if exists idx_parc_revenue_attraction rename to idx_parc_revenue_catalogue;

-- 4. Nettoyer les colonnes attraction_id dans plaintes_clients et incidents
-- (on va les relier aux equipements, pas aux roller_catalogue)
alter table public.plaintes_clients
  drop column if exists attraction_id;

alter table public.incidents
  drop column if exists attraction_id;

-- 5. Vue utilitaire : équipement → contexte Roller (CA moyen, fréquentation moyenne)
create or replace view public.v_equipement_contexte_roller as
select
  e.id as equipement_id,
  e.code as equipement_code,
  e.libelle as equipement_libelle,
  e.parc_id,
  e.type_attraction,
  p.code as parc_code,
  p.roller_venue_code,

  -- Fréquentation moyenne sur 30j (du produit Roller correspondant)
  (
    select round(avg(daily.total)::numeric, 1)
    from (
      select date_attendance, sum(pa.attendances_count) as total
      from parc_attendance pa
      join roller_catalogue rc on rc.id = pa.roller_catalogue_id
      where pa.parc_id = e.parc_id
        and rc.type_attraction = e.type_attraction
        and pa.date_attendance >= current_date - interval '30 days'
      group by date_attendance
    ) daily
  ) as frequentation_moyenne_jour_30j,

  -- CA moyen par jour sur 30j
  (
    select round(avg(daily.ca)::numeric, 2)
    from (
      select record_date, sum(pr.net_revenue) as ca
      from parc_revenue pr
      join roller_catalogue rc on rc.id = pr.roller_catalogue_id
      where pr.parc_id = e.parc_id
        and rc.type_attraction = e.type_attraction
        and pr.record_date >= current_date - interval '30 days'
      group by record_date
    ) daily
  ) as ca_moyen_jour_30j

from equipements e
join parcs p on p.id = e.parc_id
where e.type_attraction is not null
  and e.est_formation is not true;

comment on view public.v_equipement_contexte_roller is 'Pour chaque équipement lié à un type Roller, donne la fréquentation et le CA moyens sur 30j. Base pour calculer le coût d''une panne.';

-- 6. Vue utilitaire : catégories d'équipement suggérées (pour l'écran de saisie)
create or replace view public.v_categories_equipement_suggestions as
select
  ce.id as categorie_id,
  ce.nom as categorie_nom,
  count(e.id) as nb_equipements_existants,
  array_agg(distinct e.type_attraction) filter (where e.type_attraction is not null) as types_attraction_utilises
from categories_equipement ce
left join equipements e on e.categorie_id = ce.id and e.est_formation is not true
group by ce.id, ce.nom
order by ce.nom;
;
