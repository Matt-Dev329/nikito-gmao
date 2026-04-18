import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFormation } from '@/hooks/useFormation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeviceHash } from '@/lib/deviceFingerprint';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  direction: 'Direction',
  chef_maintenance: 'Chef maintenance',
  manager_parc: 'Manager parc',
  technicien: 'Technicien',
  staff_operationnel: 'Staff opérationnel',
};

export function PageProfil() {
  const { utilisateur } = useAuth();

  const { data: parcsUser } = useQuery({
    queryKey: ['parcs_user_profil', utilisateur?.id],
    queryFn: async () => {
      if (!utilisateur?.parc_ids.length) return [];
      const { data, error } = await supabase
        .from('parcs')
        .select('id, code, nom')
        .in('id', utilisateur.parc_ids)
        .neq('code', 'ECO')
        .order('code');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!utilisateur?.parc_ids.length,
  });

  if (!utilisateur) {
    return (
      <div className="p-4 md:p-6 md:px-7">
        <div className="text-dim text-sm">Chargement du profil...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7 max-w-[640px] mx-auto">
      <h1 className="text-xl md:text-[22px] font-semibold mb-1">Mon profil</h1>
      <p className="text-[13px] text-dim mb-6">Informations personnelles et preferences</p>

      <div className="bg-bg-card rounded-2xl p-5 md:p-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-nikito-cyan to-nikito-pink flex items-center justify-center text-xl font-bold text-bg-app flex-shrink-0">
            {utilisateur.prenom[0]}{utilisateur.nom[0]}
          </div>
          <div>
            <div className="text-lg font-semibold">{utilisateur.prenom} {utilisateur.nom}</div>
            <div className="text-[13px] text-dim">{utilisateur.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Role" value={roleLabels[utilisateur.role_code] ?? utilisateur.role_code} />
          {utilisateur.trigramme && <InfoRow label="Trigramme" value={utilisateur.trigramme} />}
          <div className="sm:col-span-2">
            <div className="text-[11px] text-dim uppercase tracking-wider mb-1.5">Parcs assignes</div>
            <div className="flex flex-wrap gap-1.5">
              {parcsUser && parcsUser.length > 0 ? (
                parcsUser.map((p) => (
                  <span
                    key={p.id}
                    className="bg-nikito-cyan/15 text-nikito-cyan px-2.5 py-1 rounded-lg text-xs font-medium"
                  >
                    {p.code} - {p.nom}
                  </span>
                ))
              ) : (
                <span className="text-sm text-faint">Aucun parc assigne</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <SectionGPS utilisateurId={utilisateur.id} initial={utilisateur.consentement_gps} />
      <SectionAppareils utilisateurId={utilisateur.id} />
      <SectionFormation />
      <SectionMotDePasse />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-dim uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function SectionGPS({ utilisateurId, initial }: { utilisateurId: string; initial: boolean }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(initial);

  const mutation = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase
        .from('utilisateurs')
        .update({
          consentement_gps: val,
          consentement_gps_le: new Date().toISOString(),
        })
        .eq('id', utilisateurId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utilisateur'] });
    },
  });

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    mutation.mutate(next);
  };

  return (
    <div className="bg-bg-card rounded-2xl p-5 md:p-6 mb-4">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Consentement GPS</div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Localisation pendant les controles</div>
          <div className="text-[12px] text-dim mt-0.5">
            Permet d'enregistrer votre position lors de la validation d'un controle
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={mutation.isPending}
          className={cn(
            'w-12 h-7 rounded-full relative transition-colors flex-shrink-0',
            enabled ? 'bg-nikito-cyan' : 'bg-white/15'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
      {mutation.isError && (
        <div className="text-red text-xs mt-2">Erreur lors de la mise a jour</div>
      )}
    </div>
  );
}

function SectionFormation() {
  const { active, toggle } = useFormation();

  return (
    <div className="bg-bg-card rounded-2xl p-5 md:p-6 mb-4">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Formation</div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-[#7C3AED]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L1 7l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Mode Formation
          </div>
          <div className="text-[12px] text-dim mt-0.5">
            Activez pour vous entrainer sur des cas pratiques sans affecter les vraies donnees.
          </div>
        </div>
        <button
          onClick={toggle}
          className={cn(
            'w-12 h-7 rounded-full relative transition-colors flex-shrink-0',
            active ? 'bg-[#7C3AED]' : 'bg-white/15'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
              active ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  );
}

function SectionAppareils({ utilisateurId }: { utilisateurId: string }) {
  const queryClient = useQueryClient();
  const currentHash = getDeviceHash();

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices_reconnus', utilisateurId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices_reconnus')
        .select('id, device_hash, navigateur, derniere_connexion, expire_le, actif')
        .eq('utilisateur_id', utilisateurId)
        .eq('actif', true)
        .order('derniere_connexion', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('devices_reconnus')
        .update({ actif: false })
        .eq('id', deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices_reconnus'] });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('devices_reconnus')
        .update({ actif: false })
        .eq('utilisateur_id', utilisateurId)
        .neq('device_hash', currentHash);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices_reconnus'] });
    },
  });

  const formatRelativeDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "a l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  const formatExpiry = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const browserIcon = (nav: string | null) => {
    const n = (nav || '').toLowerCase();
    if (n.includes('chrome')) return 'Ch';
    if (n.includes('firefox')) return 'Ff';
    if (n.includes('safari')) return 'Sa';
    if (n.includes('edge')) return 'Ed';
    return 'Nv';
  };

  return (
    <div className="bg-bg-card rounded-2xl p-5 md:p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-dim uppercase tracking-wider">Appareils reconnus</div>
        {devices && devices.length > 1 && (
          <button
            onClick={() => revokeAllMutation.mutate()}
            disabled={revokeAllMutation.isPending}
            className="text-[11px] text-red hover:text-red/80 transition-colors"
          >
            Revoquer tous les autres
          </button>
        )}
      </div>

      {isLoading && <div className="text-dim text-xs">Chargement...</div>}

      {devices && devices.length === 0 && (
        <div className="text-dim text-[13px]">Aucun appareil reconnu</div>
      )}

      <div className="flex flex-col gap-2.5">
        {devices?.map((d) => {
          const isCurrent = d.device_hash === currentHash;
          return (
            <div
              key={d.id}
              className={cn(
                'flex items-center gap-3 bg-bg-deep rounded-xl p-3 px-3.5',
                isCurrent && 'border border-nikito-cyan/20'
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-bg-card flex items-center justify-center text-[11px] font-bold text-nikito-cyan flex-shrink-0">
                {browserIcon(d.navigateur)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{d.navigateur || 'Navigateur inconnu'}</span>
                  {isCurrent && (
                    <span className="bg-nikito-cyan/15 text-nikito-cyan px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0">
                      Cet appareil
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-dim">
                  {formatRelativeDate(d.derniere_connexion)} · Expire le {formatExpiry(d.expire_le)}
                </div>
              </div>
              {!isCurrent && (
                <button
                  onClick={() => revokeMutation.mutate(d.id)}
                  disabled={revokeMutation.isPending}
                  className="text-[11px] text-red hover:text-red/80 transition-colors flex-shrink-0"
                >
                  Revoquer
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionMotDePasse() {
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirm.length > 0 && newPwd !== confirm;
  const tooShort = newPwd.length > 0 && newPwd.length < 6;
  const canSubmit = newPwd.length >= 6 && newPwd === confirm && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSubmitting(false);
    if (error) {
      setMsg({ type: 'err', text: error.message });
    } else {
      setMsg({ type: 'ok', text: 'Mot de passe mis a jour' });
      setNewPwd('');
      setConfirm('');
    }
  };

  return (
    <div className="bg-bg-card rounded-2xl p-5 md:p-6">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Changer mon mot de passe</div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-1.5">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="6 caracteres minimum"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
          />
          {tooShort && <div className="text-amber text-[11px] mt-1">6 caracteres minimum</div>}
        </div>
        <div>
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-1.5">
            Confirmer
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Retapez le mot de passe"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
          />
          {mismatch && <div className="text-red text-[11px] mt-1">Les mots de passe ne correspondent pas</div>}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px] self-start',
            !canSubmit && 'opacity-40 cursor-not-allowed'
          )}
        >
          {submitting ? 'Mise a jour...' : 'Modifier le mot de passe'}
        </button>
        {msg && (
          <div className={cn('text-xs', msg.type === 'ok' ? 'text-green' : 'text-red')}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
