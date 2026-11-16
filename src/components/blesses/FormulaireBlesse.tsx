import { useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { aujourdhuiParis } from '@/lib/dates';
import { ACTIVITES_PAR_PARC, EMPLACEMENTS, NIVEAUX_BLESSURE } from '@/lib/blesses';

export interface ParcBlesse {
  id: string;
  code: string;
  nom: string;
}

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 min-h-[44px] text-[14px] text-text outline-none focus:border-nikito-cyan';

function heureActuelle(): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
}

function Question({ n, titre, obligatoire = true, children }: { n: number; titre: ReactNode; obligatoire?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-semibold">
        <span className="text-dim mr-1.5">{n}.</span>
        {titre}
        {obligatoire && <span className="text-red ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

function Choix<T extends string | number | boolean>({
  options,
  valeur,
  onChange,
  vertical = false,
}: {
  options: { v: T; label: ReactNode }[];
  valeur: T | null;
  onChange: (v: T) => void;
  vertical?: boolean;
}) {
  return (
    <div className={cn('flex gap-2', vertical ? 'flex-col' : 'flex-wrap')}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'px-4 min-h-[44px] rounded-[10px] text-[13px] border text-left',
            valeur === o.v
              ? 'bg-nikito-cyan/15 border-nikito-cyan text-nikito-cyan font-semibold'
              : 'bg-bg-deep border-white/[0.08] text-text'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06] flex flex-col gap-5">
      <div className="text-[15px] font-semibold text-nikito-cyan">{titre}</div>
      {children}
    </div>
  );
}

/**
 * Formulaire d'accident (déclaration de blessé), reprise du formulaire Nikito.
 * Utilisé par le staff (tablette, connexion par code : staffId) et par les
 * comptes internes hors techniciens. Enregistrement : RPC declarer_blesse.
 */
export function FormulaireBlesse({
  parcs,
  parcInitial,
  staffId,
  referentInitial,
  onEnregistre,
  onAnnuler,
}: {
  parcs: ParcBlesse[];
  parcInitial?: string | null;
  staffId?: string | null;
  referentInitial?: string;
  onEnregistre: (numero: string) => void;
  onAnnuler?: () => void;
}) {
  const [parcId, setParcId] = useState<string | null>(parcInitial ?? (parcs.length === 1 ? parcs[0].id : null));
  const parc = parcs.find((p) => p.id === parcId) ?? null;

  const [deplacer, setDeplacer] = useState<boolean | null>(null);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [naissance, setNaissance] = useState('');
  const [adresse, setAdresse] = useState('');
  const [cpVille, setCpVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [niveau, setNiveau] = useState<number | null>(null);
  const [blessure, setBlessure] = useState('');
  const [date, setDate] = useState(aujourdhuiParis());
  const [heure, setHeure] = useState(heureActuelle());
  const [activite, setActivite] = useState<string | null>(null);
  const [emplacement, setEmplacement] = useState<string | null>(null);
  const [emplacementAutre, setEmplacementAutre] = useState('');
  const [secouristes, setSecouristes] = useState<boolean | null>(null);
  const [heureSecouristes, setHeureSecouristes] = useState('');
  const [referent, setReferent] = useState(referentInitial ?? '');
  const [details, setDetails] = useState('');
  const [managerInforme, setManagerInforme] = useState<boolean | null>(null);
  const [managerPrenom, setManagerPrenom] = useState('');

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const activites = parc ? (ACTIVITES_PAR_PARC[parc.code] ?? ['Trampoline']) : [];
  const listeEmplacements = parc && activite ? EMPLACEMENTS[`${parc.code}|${activite}`] : undefined;
  const emplacementFinal = listeEmplacements
    ? emplacement === 'Autre'
      ? emplacementAutre.trim() ? `Autre : ${emplacementAutre.trim()}` : ''
      : emplacement ?? ''
    : emplacementAutre.trim();

  const manquants = useMemo(() => {
    const m: string[] = [];
    if (!parc) m.push('parc');
    if (deplacer === null) m.push('capacité à se déplacer');
    if (!nom.trim()) m.push('nom');
    if (!prenom.trim()) m.push('prénom');
    if (!naissance) m.push('date de naissance');
    if (!adresse.trim()) m.push('adresse');
    if (!cpVille.trim()) m.push('code postal et ville');
    if (!telephone.trim()) m.push('téléphone');
    if (!niveau) m.push('niveau de blessure');
    if (!blessure.trim()) m.push('type et localisation de la blessure');
    if (!date || !heure) m.push('date et heure de l’accident');
    if (!activite) m.push('activité');
    if (!emplacementFinal) m.push('emplacement');
    if (secouristes === null) m.push('intervention des secouristes');
    if (secouristes && !heureSecouristes) m.push('heure de prise en charge des secouristes');
    if (!referent.trim()) m.push('staff référent');
    if (managerInforme === null) m.push('manager au courant');
    if (managerInforme && !managerPrenom.trim()) m.push('prénom du manager');
    return m;
  }, [parc, deplacer, nom, prenom, naissance, adresse, cpVille, telephone, niveau, blessure, date, heure, activite, emplacementFinal, secouristes, heureSecouristes, referent, managerInforme, managerPrenom]);

  const envoyer = async () => {
    if (manquants.length || !parc) {
      setErreur(`À compléter : ${manquants.join(', ')}.`);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.rpc('declarer_blesse', {
        p_parc_id: parc.id,
        p_staff_id: staffId ?? null,
        p_donnees: {
          peut_se_deplacer: deplacer,
          victime_nom: nom,
          victime_prenom: prenom,
          victime_date_naissance: naissance,
          victime_adresse: adresse,
          victime_cp_ville: cpVille,
          contact_telephone: telephone,
          niveau,
          blessure,
          survenu_le: new Date(`${date}T${heure}`).toISOString(),
          activite,
          emplacement: emplacementFinal,
          secouristes,
          secouristes_heure: secouristes ? heureSecouristes : null,
          staff_referent: referent,
          circonstances: details,
          manager_informe: managerInforme,
          manager_prenom: managerInforme ? managerPrenom : null,
        },
      });
      if (error) throw error;
      onEnregistre(data as string);
    } catch (e) {
      setErreur((e as { message?: string })?.message ?? 'Enregistrement impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {parcs.length > 1 && (
        <Section titre="Parc">
          <Choix
            options={parcs.map((p) => ({ v: p.id, label: p.nom }))}
            valeur={parcId}
            onChange={(v) => {
              setParcId(v);
              setActivite(null);
              setEmplacement(null);
            }}
          />
        </Section>
      )}

      <Section titre="Coordonnées du blessé">
        <Question n={1} titre="Capacité à se déplacer seul">
          <Choix
            options={[
              { v: true, label: 'Oui' },
              { v: false, label: 'Non, intervention directement sur la structure' },
            ]}
            valeur={deplacer}
            onChange={setDeplacer}
          />
        </Question>
        <Question n={2} titre="Nom">
          <input value={nom} onChange={(e) => setNom(e.target.value)} className={champ} autoComplete="off" />
        </Question>
        <Question n={3} titre="Prénom">
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className={champ} autoComplete="off" />
        </Question>
        <Question n={4} titre="Date de naissance">
          <input type="date" value={naissance} max={aujourdhuiParis()} onChange={(e) => setNaissance(e.target.value)} className={champ} />
        </Question>
        <Question n={5} titre="Adresse">
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={champ} autoComplete="off" />
        </Question>
        <Question n={6} titre="Code postal et ville">
          <input value={cpVille} onChange={(e) => setCpVille(e.target.value)} className={champ} autoComplete="off" />
        </Question>
        <Question n={7} titre="Numéro de téléphone">
          <input type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={champ} autoComplete="off" />
        </Question>
      </Section>

      <Section titre="Informations sur l'accident">
        <Question n={8} titre="Niveau de blessure">
          <Choix
            vertical
            options={NIVEAUX_BLESSURE.map((n) => ({
              v: n.niveau as number,
              label: (
                <span>
                  <strong>{n.titre}</strong> — <span className="font-normal">{n.detail}</span>
                </span>
              ),
            }))}
            valeur={niveau}
            onChange={setNiveau}
          />
        </Question>
        <Question n={9} titre="Type et localisation de la blessure (exemple : entorse de la cheville)">
          <input value={blessure} onChange={(e) => setBlessure(e.target.value)} className={champ} />
        </Question>
        <div className="grid grid-cols-2 gap-3">
          <Question n={10} titre="Date de l'accident">
            <input type="date" value={date} max={aujourdhuiParis()} onChange={(e) => setDate(e.target.value)} className={champ} />
          </Question>
          <Question n={11} titre="Heure de l'accident">
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} />
          </Question>
        </div>
        <Question n={12} titre={`Activité${parc ? ` · ${parc.nom}` : ''}`}>
          {parc ? (
            <Choix
              options={activites.map((a) => ({ v: a, label: a }))}
              valeur={activite}
              onChange={(v) => {
                setActivite(v);
                setEmplacement(null);
                setEmplacementAutre('');
              }}
            />
          ) : (
            <div className="text-[12px] text-dim">Choisis d’abord le parc.</div>
          )}
        </Question>
        {activite && (
          <Question n={13} titre="Emplacement">
            {listeEmplacements ? (
              <>
                <Choix
                  vertical
                  options={[...listeEmplacements, 'Autre'].map((e) => ({ v: e, label: e }))}
                  valeur={emplacement}
                  onChange={setEmplacement}
                />
                {emplacement === 'Autre' && (
                  <input
                    value={emplacementAutre}
                    onChange={(e) => setEmplacementAutre(e.target.value)}
                    placeholder="Préciser l’emplacement"
                    className={champ}
                  />
                )}
              </>
            ) : (
              <input
                value={emplacementAutre}
                onChange={(e) => setEmplacementAutre(e.target.value)}
                placeholder="Ex. : zone trampoline, toboggan…"
                className={champ}
              />
            )}
          </Question>
        )}
        <Question n={14} titre="Intervention des secouristes">
          <Choix
            options={[
              { v: true, label: 'Oui' },
              { v: false, label: 'Non' },
            ]}
            valeur={secouristes}
            onChange={setSecouristes}
          />
        </Question>
        {secouristes && (
          <Question n={15} titre="Heure de prise en charge des secouristes">
            <input type="time" value={heureSecouristes} onChange={(e) => setHeureSecouristes(e.target.value)} className={champ} />
          </Question>
        )}
        <Question n={16} titre="Staff référent de l'incident">
          <input value={referent} onChange={(e) => setReferent(e.target.value)} className={champ} />
        </Question>
        <Question n={17} titre="Détails ou informations complémentaires (détailler autant que possible)" obligatoire={false}>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2 text-[14px] text-text outline-none focus:border-nikito-cyan"
          />
        </Question>
        <Question n={18} titre="Manager au courant ?">
          <Choix
            options={[
              { v: true, label: 'Oui' },
              { v: false, label: 'Non' },
            ]}
            valeur={managerInforme}
            onChange={setManagerInforme}
          />
        </Question>
        {managerInforme && (
          <Question n={19} titre="Prénom du manager">
            <input value={managerPrenom} onChange={(e) => setManagerPrenom(e.target.value)} className={champ} />
          </Question>
        )}
      </Section>

      {erreur && <div className="text-[13px] text-red bg-red/10 border border-red/30 rounded-lg p-3">{erreur}</div>}

      <div className="flex gap-2 justify-end pb-[env(safe-area-inset-bottom)]">
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} className="px-4 min-h-[48px] rounded-[10px] text-[13px] text-dim">
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={envoyer}
          disabled={envoi}
          className="px-6 min-h-[48px] rounded-[10px] text-[14px] font-bold bg-gradient-cta text-text disabled:opacity-50"
        >
          {envoi ? 'Enregistrement…' : 'Envoyer la déclaration'}
        </button>
      </div>
    </div>
  );
}
