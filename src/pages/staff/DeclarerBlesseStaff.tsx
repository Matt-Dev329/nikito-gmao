import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { FormulaireBlesse, type ParcBlesse } from '@/components/blesses/FormulaireBlesse';

interface SessionStaff {
  utilisateur: { utilisateur_id?: string; id?: string; prenom?: string; nom?: string; role_code?: string };
  parc: ParcBlesse;
}

function sessionStaff(): SessionStaff | null {
  try {
    const raw = sessionStorage.getItem('staff_session');
    return raw ? (JSON.parse(raw) as SessionStaff) : null;
  } catch {
    return null;
  }
}

/**
 * Formulaire d'accident sur la tablette : staff connecté par code (son parc)
 * ou compte connecté (hors techniciens). Le staff ne voit pas le registre.
 */
export function DeclarerBlesseStaff() {
  const navigate = useNavigate();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const session = sessionStaff();

  const estConnecte = !!utilisateur && utilisateur.role_code !== 'staff_operationnel';
  const staffId = !estConnecte ? (session?.utilisateur.utilisateur_id ?? session?.utilisateur.id ?? null) : null;
  const listeParcs: ParcBlesse[] = estConnecte
    ? (parcs ?? []).map((p) => ({ id: p.id as string, code: p.code as string, nom: p.nom as string }))
    : session?.parc
      ? [session.parc]
      : [];
  const referent = estConnecte
    ? `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim()
    : `${session?.utilisateur.prenom ?? ''} ${session?.utilisateur.nom ?? ''}`.trim();

  const interdit = utilisateur?.role_code === 'technicien' || (!estConnecte && !staffId);

  return (
    <div className="min-h-screen bg-transparent text-text p-4 md:p-6 max-w-[820px] mx-auto flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="text-nikito-cyan text-sm self-start min-h-[44px]">
        ‹ Retour
      </button>
      <div>
        <h1 className="text-[22px] font-semibold m-0">🩹 Formulaire d'accident</h1>
        <p className="text-[13px] text-dim mt-1">Déclaration d’un blessé. Les champs marqués * sont obligatoires.</p>
      </div>
      {interdit ? (
        <div className="text-dim text-sm bg-bg-card rounded-xl p-4 border border-white/[0.06]">
          Connecte-toi avec ton code pour déclarer un blessé.
        </div>
      ) : (
        <FormulaireBlesse
          parcs={listeParcs}
          parcInitial={session?.parc?.id ?? null}
          staffId={staffId}
          referentInitial={referent}
          onAnnuler={() => navigate(-1)}
          onEnregistre={(numero) => {
            toast.success(`Déclaration ${numero} envoyée. Merci.`);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}
