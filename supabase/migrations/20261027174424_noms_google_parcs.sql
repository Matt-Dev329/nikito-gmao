-- Nom des fiches Google des parcs (recherche des horaires Google)
UPDATE public.parcs
SET meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('nom_google', v.nom)
FROM (VALUES ('DOM', 'Nikito Rosny'), ('ALF', 'Nikito Alfortville'), ('SGB', 'Nikito SGDB'), ('FRA', 'Nikito Franconville')) AS v(code, nom)
WHERE parcs.code = v.code;
