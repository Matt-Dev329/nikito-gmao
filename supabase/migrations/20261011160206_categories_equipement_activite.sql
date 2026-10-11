/*
  # Activité des catégories d'équipement

  Chaque catégorie d'équipement est rattachée à une activité (mêmes noms que
  le catalogue « Commander ») pour ranger les tickets par activité dans
  Opérations. Les catégories d'infrastructure sont regroupées (Casiers,
  Sanitaires, Sécurité, Électricité, Éclairage, Climatisation, Ascenseurs).
  Colonne modifiable : une nouvelle catégorie sans activité tombe dans
  « Autres ».
*/

ALTER TABLE public.categories_equipement ADD COLUMN IF NOT EXISTS activite text;

UPDATE public.categories_equipement SET activite = CASE nom
  WHEN 'Trampoline' THEN 'Trampoline'
  WHEN 'Laser Game pack' THEN 'Laser Game'
  WHEN 'Arcade borne' THEN 'Arcade'
  WHEN 'Prison Island salle' THEN 'Prison Island'
  WHEN 'Bowling piste' THEN 'Bowling'
  WHEN 'Karting kart' THEN 'Karting'
  WHEN 'Karting borne recharge' THEN 'Karting'
  WHEN 'Mini-golf trou' THEN 'Mini-golf'
  WHEN 'I-Quiz pupitre' THEN 'I-Quiz'
  WHEN 'Lancer haches cible' THEN 'Lancer de haches'
  WHEN 'Palomano' THEN 'Palomano'
  WHEN 'Fléchettes AR poste' THEN 'Fléchettes AR'
  WHEN 'Ninja parcours' THEN 'Ninja parcours'
  WHEN 'SoftPlay' THEN 'SoftPlay'
  WHEN 'Immersive VR salle' THEN 'Réalité virtuelle'
  WHEN 'Château gonflable' THEN 'Château gonflable'
  WHEN 'Karaoké salle' THEN 'Karaoké'
  WHEN 'Octogone' THEN 'Octogone'
  WHEN 'Casier' THEN 'Casiers'
  WHEN 'Sanitaire bloc' THEN 'Sanitaires'
  WHEN 'Sécurité & Sorties de secours' THEN 'Sécurité & sorties de secours'
  WHEN 'DM (Declencheur Manuel)' THEN 'Sécurité & sorties de secours'
  WHEN 'TGBT' THEN 'Électricité (TGBT)'
  WHEN 'Projecteur DMX' THEN 'Éclairage & DMX'
  WHEN 'Éclairage parc' THEN 'Éclairage & DMX'
  WHEN 'Climatisation' THEN 'Climatisation'
  WHEN 'Ascenseur PMR' THEN 'Ascenseurs & escalators'
  WHEN 'Monte-charge' THEN 'Ascenseurs & escalators'
  WHEN 'Escalator' THEN 'Ascenseurs & escalators'
  ELSE activite
END
WHERE activite IS NULL;
