import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useParc } from '@/hooks/queries/useReferentiel';
import { useAttractionsParc } from '@/hooks/queries/useAttractionsParc';
import { usePointsPourParc } from '@/hooks/queries/usePointsCategoriePourParc';
import { useAuth } from '@/hooks/useAuth';
import { NotesChantierParc } from './NotesChantierParc';
import { CarteHorairesParc } from '@/components/parc/CarteHorairesParc';
import { ToggleVacancesParc } from '@/components/parc/ToggleVacancesParc';
import { EditeurHorairesParc } from '@/components/parc/EditeurHorairesParc';
import { OngletConformiteParc } from '@/pages/conformite/OngletConformiteParc';
import type { Parc } from '@/types/database';

type Onglet = 'apercu' | 'configuration' | 'controles' | 'equipements' | 'equipe' | 'notes' | 'conformite';

const ROLES_EDIT_HORAIRES: string[] = ['direction', 'chef_maintenance', 'directeur_parc'];

export function FicheParc() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: parc } = useParc(id);
  const [onglet, setOnglet] = useState<Onglet>('apercu');

  return (
    <div>
      <header className="bg-bg-card border-b border-white/[0.06] px-4 md:px-7 pt-4 md:pt-5 pb-0">
        <button
          onClick={() => navigate('/gmao/parcs')}
          className="md:hidden flex items-center gap-1.5 text-[13px] text-dim min-h-[44px] mb-1"
        >
          &#8592; Parcs
        </button>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-dim mb-1">
          <button onClick={() => navigate('/gmao/parcs')} className="hover:text-nikito-cyan">
            Parcs
          </button>
          <span>&#8250;</span>
          <span className="text-nikito-cyan">{parc?.code ?? '...'}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-[22px] font-semibold m-0 truncate">
              {parc?.nom ?? 'Chargement...'}
            </h1>
            <div className="text-[13px] text-dim mt-1 truncate">
              {parc?.adresse} · {parc?.ville} ({parc?.code_postal})
            </div>
          </div>
          {parc?.ouvert_7j7 && (
            <span className="bg-amber/15 text-amber px-2.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ml-2">
              7J/7
            </span>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-px">
          <OngletButton actif={onglet === 'apercu'} onClick={() => setOnglet('apercu')}>
            Vue d'ensemble
          </OngletButton>
          <OngletButton
            actif={onglet === 'configuration'}
            onClick={() => setOnglet('configuration')}
          >
            Configuration
          </OngletButton>
          <OngletButton actif={onglet === 'controles'} onClick={() => setOnglet('controles')}>
            Contrôles
          </OngletButton>
          <OngletButton actif={onglet === 'equipements'} onClick={() => setOnglet('equipements')}>
            Équipements
          </OngletButton>
          <OngletButton actif={onglet === 'equipe'} onClick={() => setOnglet('equipe')}>
            Équipe
          </OngletButton>
          <OngletButton actif={onglet === 'notes'} onClick={() => setOnglet('notes')}>
            Notes chantier
          </OngletButton>
          <OngletButton actif={onglet === 'conformite'} onClick={() => setOnglet('conformite')}>
            Conformite
          </OngletButton>
        </div>
      </header>

      {onglet === 'apercu' && <OngletApercu parc={parc ?? null} />}
      {onglet === 'configuration' && <OngletConfiguration parc={parc ?? null} />}
      {onglet === 'controles' && <OngletControles parcId={id} />}
      {onglet === 'equipements' && <OngletEquipements parcId={id} />}
      {onglet === 'equipe' && <OngletEquipe parcId={id} />}
      {onglet === 'notes' && <NotesChantierParc />}
      {onglet === 'conformite' && <OngletConformiteParc parcId={id} />}
    </div>
  );
}

function OngletButton({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 md:px-4 py-2.5 text-[13px] whitespace-nowrap min-h-[44px]',
        actif ? 'text-text font-semibold border-b-2 border-nikito-pink' : 'text-dim'
      )}
    >
      {children}
    </button>
  );
}

function OngletApercu({ parc }: { parc: Parc | null }) {
  if (!parc) {
    return (
      <div className="p-4 md:p-7">
        <div className="bg-bg-card rounded-xl h-32 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7 flex flex-col gap-4">
      <CarteHorairesParc parc={parc} />
    </div>
  );
}

function OngletConfiguration({ parc }: { parc: Parc | null }) {
  const { utilisateur } = useAuth();
  const canEdit = ROLES_EDIT_HORAIRES.includes(utilisateur?.role_code ?? '');

  if (!parc) {
    return (
      <div className="p-4 md:p-7">
        <div className="bg-bg-card rounded-xl h-32 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7 flex flex-col gap-4">
      <ToggleVacancesParc parc={parc} disabled={!canEdit} />
      <EditeurHorairesParc parc={parc} disabled={!canEdit} />
      {!canEdit && (
        <p className="text-[11px] text-dim text-center">
          Seuls les rôles Direction et Chef maintenance peuvent modifier les horaires
        </p>
      )}
    </div>
  );
}

function OngletControles({ parcId }: { parcId: string | undefined }) {
  const { data: attractions, isLoading: loadingAttr, error } = useAttractionsParc(parcId);
  const { data: points, isLoading: loadingPts } = usePointsPourParc(parcId);

  console.log('[Debug] attractions data:', attractions);
  console.log('[Debug] attractions error:', error);
  console.log('[Debug] attractions isLoading:', loadingAttr);

  const statsParType = useMemo(() => {
    if (!points) return { quotidien: 0, hebdo: 0, mensuel: 0 };
    const actifs = points.filter((p) => p.actif_pour_parc);
    return {
      quotidien: actifs.filter((p) => p.type_controle === 'quotidien').length,
      hebdo: actifs.filter((p) => p.type_controle === 'hebdo').length,
      mensuel: actifs.filter((p) => p.type_controle === 'mensuel').length,
    };
  }, [points]);

  const isLoading = loadingAttr || loadingPts;

  if (isLoading) {
    return (
      <div className="p-4 md:p-7 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-7">
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6">
        <div className="bg-bg-card rounded-xl p-3 md:p-4 border border-white/[0.06]">
          <div className="text-[10px] md:text-[11px] text-dim uppercase tracking-wider mb-1">Quotidien</div>
          <div className="text-xl md:text-2xl font-bold text-nikito-cyan">{statsParType.quotidien}</div>
          <div className="text-[10px] md:text-[11px] text-dim">points actifs</div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 md:p-4 border border-white/[0.06]">
          <div className="text-[10px] md:text-[11px] text-dim uppercase tracking-wider mb-1">Hebdo</div>
          <div className="text-xl md:text-2xl font-bold text-nikito-pink">{statsParType.hebdo}</div>
          <div className="text-[10px] md:text-[11px] text-dim">points actifs</div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 md:p-4 border border-white/[0.06]">
          <div className="text-[10px] md:text-[11px] text-dim uppercase tracking-wider mb-1">Mensuel</div>
          <div className="text-xl md:text-2xl font-bold text-amber">{statsParType.mensuel}</div>
          <div className="text-[10px] md:text-[11px] text-dim">points actifs</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-[15px] font-semibold">
          Attractions configurées ({attractions?.length ?? 0})
        </h3>
        <Link
          to={`/gmao/parcs/${parcId}/attractions`}
          className="text-nikito-cyan text-[12px] hover:underline whitespace-nowrap"
        >
          Gérer les attractions
        </Link>
      </div>

      {!attractions || attractions.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-6 md:p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm mb-3">Aucune attraction configurée</p>
          <Link
            to={`/gmao/parcs/${parcId}/attractions`}
            className="inline-block bg-gradient-cta text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] leading-[44px]"
          >
            Configurer
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {attractions.map((a: any) => {
            const cat = a.categorie;
            const pts = points?.filter((p) => p.categorie_id === a.categorie_id) ?? [];
            const actifs = pts.filter((p) => p.actif_pour_parc).length;

            return (
              <Link
                key={a.id}
                to={`/gmao/parcs/${parcId}/points/${a.categorie_id}`}
                className="bg-bg-card rounded-xl p-3 px-4 md:p-3.5 md:px-5 border border-white/[0.06] flex items-center gap-3 md:gap-4 hover:border-nikito-cyan/30 transition-colors min-h-[56px]"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium">{cat?.nom ?? '—'}</span>
                  <span className="text-[11px] text-dim ml-2">x{a.quantite}</span>
                </div>
                <span className="text-[12px] text-dim whitespace-nowrap">{actifs}/{pts.length} pts</span>
                <span className="text-dim text-sm">&#8250;</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OngletEquipements({ parcId }: { parcId: string | undefined }) {
  const { data: equipements, isLoading } = useQuery({
    queryKey: ['equipements_parc_fiche', parcId],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('equipements')
        .select('id, code, libelle, statut, categories_equipement(nom), zones(nom)')
        .eq('parc_id', parcId)
        .eq('est_formation', false)
        .order('code');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parcId,
  });

  const grouped = useMemo(() => {
    if (!equipements) return [];
    const map = new Map<string, typeof equipements>();
    for (const eq of equipements) {
      const cat = (eq.categories_equipement as unknown as { nom: string } | null)?.nom ?? 'Sans categorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(eq);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [equipements]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-7 flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="bg-bg-card rounded-xl h-14 animate-pulse" />)}
      </div>
    );
  }

  if (!equipements || equipements.length === 0) {
    return (
      <div className="p-4 md:p-7">
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">Aucun equipement configure pour ce parc</p>
        </div>
      </div>
    );
  }

  const statutColor: Record<string, string> = {
    actif: 'text-green bg-green/10',
    en_panne: 'text-red bg-red/10',
    maintenance: 'text-amber bg-amber/10',
    hors_service: 'text-red bg-red/10',
    a_installer: 'text-dim bg-white/[0.06]',
  };

  return (
    <div className="p-4 md:p-7 flex flex-col gap-5">
      <div className="text-[13px] text-dim">{equipements.length} equipement{equipements.length > 1 ? 's' : ''}</div>
      {grouped.map(([cat, items]) => (
        <div key={cat}>
          <div className="text-[11px] text-dim uppercase tracking-wider mb-2">{cat} ({items.length})</div>
          <div className="flex flex-col gap-1.5">
            {items.map((eq) => {
              const zone = (eq.zones as unknown as { nom: string } | null)?.nom;
              return (
                <div
                  key={eq.id}
                  className="bg-bg-card rounded-xl px-4 py-3 border border-white/[0.06] flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-nikito-cyan font-bold">{eq.code}</span>
                      <span className="text-[13px] font-medium truncate">{eq.libelle}</span>
                    </div>
                    {zone && <div className="text-[11px] text-dim mt-0.5">{zone}</div>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0 ${statutColor[eq.statut] ?? 'text-dim bg-white/[0.06]'}`}>
                    {eq.statut.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MembreEquipe {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
  role_code: string;
  role_nom: string;
}

function useEquipeParc(parcId: string | undefined) {
  return useQuery({
    queryKey: ['equipe_parc', parcId],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('parcs_utilisateurs')
        .select('utilisateurs!inner(id, nom, prenom, email, actif, roles!inner(code, nom))')
        .eq('parc_id', parcId);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const u = row.utilisateurs as Record<string, unknown>;
        const r = u.roles as { code: string; nom: string };
        return {
          id: u.id as string,
          nom: u.nom as string,
          prenom: u.prenom as string,
          email: u.email as string,
          actif: u.actif as boolean,
          role_code: r.code,
          role_nom: r.nom,
        } as MembreEquipe;
      });
    },
    enabled: !!parcId,
  });
}

const ROLE_ORDER: Record<string, number> = {
  direction: 1,
  chef_maintenance: 2,
  directeur_parc: 3,
  admin_it: 4,
  manager_parc: 5,
  technicien: 6,
  staff_operationnel: 7,
};

function OngletEquipe({ parcId }: { parcId: string | undefined }) {
  const { data: membres, isLoading } = useEquipeParc(parcId);
  const { utilisateur } = useAuth();
  const isDirection = utilisateur?.role_code === 'direction' || utilisateur?.role_code === 'admin_it';
  const [recherche, setRecherche] = useState('');

  const membresFiltres = useMemo(() => {
    if (!membres) return [];
    if (!recherche.trim()) return membres;
    const q = recherche.toLowerCase().trim();
    return membres.filter((m) =>
      m.prenom.toLowerCase().includes(q) ||
      m.nom.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  }, [membres, recherche]);

  const grouped = useMemo(() => {
    const sorted = [...membresFiltres].sort((a, b) => (ROLE_ORDER[a.role_code] ?? 9) - (ROLE_ORDER[b.role_code] ?? 9) || a.nom.localeCompare(b.nom));
    const groups: { role: string; membres: MembreEquipe[] }[] = [];
    for (const m of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.role === m.role_nom) {
        last.membres.push(m);
      } else {
        groups.push({ role: m.role_nom, membres: [m] });
      }
    }
    return groups;
  }, [membresFiltres]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-7 flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="bg-bg-card rounded-xl h-14 animate-pulse" />)}
      </div>
    );
  }

  if (!membres || membres.length === 0) {
    return (
      <div className="p-4 md:p-7">
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">Aucun utilisateur assigne a ce parc</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-7 flex flex-col gap-5">
      {isDirection && membres && membres.length > 5 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un membre..."
            className="w-full bg-bg-card border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-text outline-none focus:border-nikito-cyan/50 min-h-[44px] placeholder:text-dim"
          />
        </div>
      )}
      <div className="text-[13px] text-dim">
        {recherche.trim()
          ? `${membresFiltres.length} resultat${membresFiltres.length > 1 ? 's' : ''} sur ${membres!.length}`
          : `${membres!.length} membre${membres!.length > 1 ? 's' : ''} dans l'equipe`}
      </div>
      {grouped.map((g) => (
        <div key={g.role}>
          <div className="text-[11px] text-dim uppercase tracking-wider mb-2">{g.role} ({g.membres.length})</div>
          <div className="flex flex-col gap-1.5">
            {g.membres.map((m) => (
              <div
                key={m.id}
                className="bg-bg-card rounded-xl px-4 py-3 border border-white/[0.06] flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-nikito-cyan/10 text-nikito-cyan flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {m.prenom[0]}{m.nom[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.prenom} {m.nom}</div>
                  <div className="text-[11px] text-dim truncate">{m.email}</div>
                </div>
                {!m.actif && (
                  <span className="text-[10px] text-amber bg-amber/10 px-2 py-0.5 rounded flex-shrink-0">Inactif</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
