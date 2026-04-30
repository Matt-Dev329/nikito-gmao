import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UtilisateurMetier {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  trigramme: string | null;
  role_code: 'direction' | 'chef_maintenance' | 'manager_parc' | 'technicien' | 'staff_operationnel' | 'admin_it';
  parc_ids: string[];
  consentement_gps: boolean;
}

interface AuthContextValue {
  session: Session | null;
  authUser: User | null;
  utilisateur: UtilisateurMetier | null;
  loading: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [utilisateur, setUtilisateur] = useState<UtilisateurMetier | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthUser(data.session?.user ?? null);
      setSessionChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((prev) => (prev?.access_token === newSession?.access_token ? prev : newSession));
      setAuthUser((prev) => {
        const next = newSession?.user ?? null;
        if (prev?.id === next?.id) return prev;
        return next;
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;

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
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setUtilisateur(null);
        } else {
          const d = data as Record<string, unknown>;
          const roles = d.roles as { code: string };
          const pu = d.parcs_utilisateurs as { parc_id: string }[];
          setUtilisateur({
            id: d.id as string,
            email: d.email as string,
            nom: d.nom as string,
            prenom: d.prenom as string,
            trigramme: d.trigramme as string | null,
            consentement_gps: d.consentement_gps as boolean,
            role_code: roles.code as UtilisateurMetier['role_code'],
            parc_ids: pu.map((p) => p.parc_id),
          });
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionChecked, authUser?.id]);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, authUser, utilisateur, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
