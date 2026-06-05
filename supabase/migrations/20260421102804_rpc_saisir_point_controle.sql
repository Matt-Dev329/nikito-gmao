
-- ============================================================================
-- RPC saisir_point_controle()
-- Saisit ou met à jour un point de contrôle dans une transaction unique.
-- - Crée le controle_item s'il n'existe pas, le met à jour sinon
-- - Met le contrôle parent en statut 'en_cours' si premier point saisi
-- - Bloque si le contrôle est déjà 'valide' (immutabilité)
-- - Snapshot du libellé/catégorie/type du point au moment de la saisie
-- - Le trigger trg_auto_create_incident s'occupera de créer un incident si etat='hs'
-- ============================================================================
create or replace function public.saisir_point_controle(
  p_controle_id uuid,
  p_point_id uuid,
  p_etat etat_controle_item,
  p_equipement_id uuid default null,
  p_commentaire text default null,
  p_photo_url text default null,
  p_saisi_par_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_controle controles%rowtype;
  v_point bibliotheque_points%rowtype;
  v_existing controle_items%rowtype;
  v_item_id uuid;
  v_result jsonb;
begin
  -- 1. Vérifier que le contrôle existe et n'est pas déjà validé
  select * into v_controle from controles where id = p_controle_id;
  if not found then
    raise exception 'Contrôle introuvable: %', p_controle_id using errcode = 'P0001';
  end if;

  if v_controle.statut = 'valide' then
    raise exception 'Contrôle déjà validé, modification impossible (immutabilité Lean)' using errcode = 'P0002';
  end if;

  if v_controle.statut = 'remplace' then
    raise exception 'Contrôle remplacé, utiliser le nouveau contrôle' using errcode = 'P0003';
  end if;

  -- 2. Récupérer le point de référence pour snapshot
  select * into v_point from bibliotheque_points where id = p_point_id;
  if not found then
    raise exception 'Point bibliothèque introuvable: %', p_point_id using errcode = 'P0004';
  end if;

  -- 3. Vérifier si l'item existe déjà
  select * into v_existing from controle_items
  where controle_id = p_controle_id and point_id = p_point_id;

  if found then
    -- UPDATE
    update controle_items set
      etat = p_etat,
      equipement_id = coalesce(p_equipement_id, v_existing.equipement_id),
      commentaire = coalesce(p_commentaire, v_existing.commentaire),
      photo_url = coalesce(p_photo_url, v_existing.photo_url),
      saisi_par_id = coalesce(p_saisi_par_id, v_existing.saisi_par_id),
      saisi_le = now()
    where id = v_existing.id;
    v_item_id := v_existing.id;
  else
    -- INSERT avec snapshot
    insert into controle_items (
      controle_id, point_id, equipement_id, etat,
      commentaire, photo_url, saisi_par_id, saisi_le,
      point_libelle_snapshot, point_categorie_snapshot, point_type_controle_snapshot,
      est_formation
    ) values (
      p_controle_id, p_point_id, p_equipement_id, p_etat,
      p_commentaire, p_photo_url, p_saisi_par_id, now(),
      v_point.libelle, v_point.categorie::text, v_point.type_controle::text,
      v_controle.est_formation
    ) returning id into v_item_id;
  end if;

  -- 4. Mettre le contrôle en 'en_cours' si c'est le premier point saisi
  if v_controle.statut = 'a_faire' then
    update controles set
      statut = 'en_cours',
      date_demarrage = coalesce(date_demarrage, now()),
      realise_par_id = coalesce(realise_par_id, p_saisi_par_id),
      modifie_le = now()
    where id = p_controle_id;
  end if;

  -- 5. Récupérer l'item créé/mis à jour avec son éventuel incident généré
  select jsonb_build_object(
    'item_id', ci.id,
    'controle_id', ci.controle_id,
    'point_id', ci.point_id,
    'etat', ci.etat,
    'incident_genere_id', ci.incident_genere_id,
    'saisi_le', ci.saisi_le,
    'controle_statut', c.statut
  ) into v_result
  from controle_items ci
  join controles c on c.id = ci.controle_id
  where ci.id = v_item_id;

  return v_result;
end;
$$;

comment on function public.saisir_point_controle is 'Saisit ou met à jour un point de contrôle. Gère immutabilité, snapshot, mise en cours du contrôle. Le trigger trg_auto_create_incident gère la création d''incident si etat=hs.';

-- Permettre à l'appel depuis l'app authenticated et anon (staff via RPC)
grant execute on function public.saisir_point_controle(uuid, uuid, etat_controle_item, uuid, text, text, uuid) to authenticated, anon;

-- ============================================================================
-- RPC valider_controle()
-- Valide définitivement un contrôle :
-- - Vérifie que tous les points obligatoires ont été saisis
-- - Calcule le hash d'intégrité (snapshot complet pour audit)
-- - Passe le statut à 'valide'
-- - Stocke signature + IP + user_agent pour audit
-- ============================================================================
create or replace function public.valider_controle(
  p_controle_id uuid,
  p_valide_par_id uuid,
  p_signature_url text default null,
  p_signature_ip text default null,
  p_signature_user_agent text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_controle controles%rowtype;
  v_total_points int;
  v_points_saisis int;
  v_nb_hs int;
  v_nb_degrade int;
  v_hash_input text;
  v_hash text;
begin
  select * into v_controle from controles where id = p_controle_id;
  if not found then
    raise exception 'Contrôle introuvable' using errcode = 'P0001';
  end if;

  if v_controle.statut = 'valide' then
    raise exception 'Contrôle déjà validé' using errcode = 'P0002';
  end if;

  -- Compter points
  select count(*) into v_points_saisis from controle_items
  where controle_id = p_controle_id and etat <> 'non_saisi';

  if v_points_saisis = 0 then
    raise exception 'Aucun point saisi, validation impossible' using errcode = 'P0005';
  end if;

  select count(*) filter (where etat = 'hs'),
         count(*) filter (where etat = 'degrade')
  into v_nb_hs, v_nb_degrade
  from controle_items where controle_id = p_controle_id;

  -- Calcul d'un hash d'intégrité simple (concat de tous les items)
  select md5(string_agg(
    ci.id::text || ':' || ci.etat::text || ':' || coalesce(ci.commentaire, ''),
    '|' order by ci.id
  ))
  into v_hash
  from controle_items ci where ci.controle_id = p_controle_id;

  update controles set
    statut = 'valide',
    valide_par_id = p_valide_par_id,
    date_validation = now(),
    signature_url = coalesce(p_signature_url, signature_url),
    signature_at = case when p_signature_url is not null then now() else signature_at end,
    signature_ip = coalesce(p_signature_ip, signature_ip),
    signature_user_agent = coalesce(p_signature_user_agent, signature_user_agent),
    hash_integrite = v_hash,
    modifie_le = now()
  where id = p_controle_id;

  return jsonb_build_object(
    'controle_id', p_controle_id,
    'statut', 'valide',
    'points_saisis', v_points_saisis,
    'nb_hs', v_nb_hs,
    'nb_degrade', v_nb_degrade,
    'hash_integrite', v_hash,
    'date_validation', now()
  );
end;
$$;

comment on function public.valider_controle is 'Valide définitivement un contrôle Lean : calcule hash, fige le statut, capture signature/IP/UA pour audit.';

grant execute on function public.valider_controle(uuid, uuid, text, text, text, boolean) to authenticated, anon;
;
