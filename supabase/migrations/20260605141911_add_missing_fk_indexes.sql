/*
  # Index couvrants pour les clés étrangères sans index (performance)

  L'advisor Supabase `unindexed_foreign_keys` signalait 61 clés étrangères
  sans index couvrant → jointures et filtres sous-optimaux, et verrous plus
  longs sur les suppressions/maj de la table référencée.

  Cette migration crée dynamiquement un index sur chaque FK non couverte.
  Idempotente (CREATE INDEX IF NOT EXISTS) et re-jouable sans effet de bord.
*/
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      left(format('idx_%s_%s', c.relname, string_agg(a.attname,'_' ORDER BY k.ord)), 63),
      ns.nspname, c.relname,
      string_agg(format('%I', a.attname), ', ' ORDER BY k.ord)
    ) AS ddl
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
    WHERE con.contype = 'f' AND ns.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = con.conrelid
          AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(con.conkey)] = con.conkey
      )
    GROUP BY con.oid, ns.nspname, c.relname
  LOOP
    EXECUTE r.ddl;
  END LOOP;
END $$;
