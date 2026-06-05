
-- Permettre la lecture des parcs actifs en anonyme
-- (les parcs sont publics, ils sont sur le site web Nikito de toute façon)
CREATE POLICY "parcs_lecture_publique"
ON parcs
FOR SELECT
TO anon, authenticated
USING (actif = true);

-- Vérif
SELECT COUNT(*) AS parcs_actifs FROM parcs WHERE actif = true;
;
