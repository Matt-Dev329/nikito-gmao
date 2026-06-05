
-- ═══════════════════════════════════════════════════════════════════
-- RESSERRER LES 3 POLITIQUES "ALWAYS TRUE" 
-- (remplacer USING(true)/WITH CHECK(true) par des conditions métier)
-- ═══════════════════════════════════════════════════════════════════

-- ─── controle_items : INSERT et UPDATE doivent être faits par un user authentifié 
--     ayant un rôle GMAO valide (pas n'importe qui avec un compte) ───

DROP POLICY IF EXISTS "items_ecriture_authentifies" ON controle_items;
CREATE POLICY "items_ecriture_roles_metier" ON controle_items 
  FOR INSERT TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

DROP POLICY IF EXISTS "items_modification_authentifies" ON controle_items;
CREATE POLICY "items_modification_roles_metier" ON controle_items 
  FOR UPDATE TO authenticated
  USING (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  )
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

-- ─── plaintes_clients : INSERT par un user authentifié ayant un rôle métier
--     (les plaintes sont saisies par les staff/managers depuis l'app, pas par n'importe qui) ───

DROP POLICY IF EXISTS "plaintes_creation_authentifies" ON plaintes_clients;
CREATE POLICY "plaintes_creation_roles_metier" ON plaintes_clients 
  FOR INSERT TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'staff_operationnel')
  );

-- Vérification
SELECT policyname, cmd, qual::text AS using_clause, with_check::text 
FROM pg_policies 
WHERE tablename IN ('controle_items', 'plaintes_clients') 
ORDER BY tablename, policyname;
;
