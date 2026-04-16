import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UtilisateurMetier {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  trigramme: string | null;
  role_code: 'direction' | 'chef_maintenance' | 'manager_parc' | 'technicien' | 'staff_operationnel';
  parc_ids: string[];
  consentement_gps: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [utilisateur, setUtilisateur] = useState<UtilisateurMetier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((prev) => (prev?.access_token === newSession?.access_token ? prev : newSession));
      setAuthUser((prev) => {
        const next = newSession?.user ?? null;
        if (prev?.id === next?.id) return prev; // ← évite la nouvelle référence
        return next;
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ⚠️ Dépendance sur authUser?.id (primitive), PAS sur authUser (objet)
  useEffect(() => {
    if (!authUser?.id) {
      setUtilisateur(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('utilisateurs')
      .select(
        `id, email, nom, prenom, trigramme, consentement_gps,
         roles!inner(code),
         parcs_utilisateurs(parc_id)`
      )
      .eq('auth_user_id', authUser.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setUtilisateur(null);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = data as any;
          setUtilisateur({
            id: d.id,
            email: d.email,
            nom: d.nom,
            prenom: d.prenom,
            trigramme: d.trigramme,
            consentement_gps: d.consentement_gps,
            role_code: d.roles.code,
            parc_ids: d.parcs_utilisateurs.map((pu: { parc_id: string }) => pu.parc_id),
          });
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]); // ← ICI, la correction critique

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return { session, authUser, utilisateur, loading, signIn, signOut };
}