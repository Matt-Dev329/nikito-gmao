import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { SelectionParc } from '@/components/controles/SelectionParc';
import { BoutonRetourGmao } from '@/components/controles/BoutonRetourGmao';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { usePointsControle, useValiderControleMensuel } from '@/hooks/queries/useControles';
import { useUtilisateursActifs } from '@/hooks/queries/useUtilisateurs';
import type { EtatControleItem } from '@/types/database';

interface EtatPointMensuel {
  etat: EtatControleItem;
  commentaire: string;
  saisiPar: string;
}

function SignatureCanvas({
  label,
  onSignature,
  signatureData,
}: {
  label: string;
  onSignature: (dataUrl: string) => void;
  signatureData: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#5DE5FF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onSignature(canvas.toDataURL('image/png'));
  };

  const reset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignature('');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] text-dim uppercase tracking-wider">{label}</span>
        {signatureData && (
          <button onClick={reset} className="text-[11px] text-red">
            Effacer
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-[120px] bg-bg-deep border border-white/[0.08] rounded-[10px] cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}

export function ControleMensuel() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: allParcs } = useParcs();
  const { data: allUsers } = useUtilisateursActifs();

  const [parcChoisi, setParcChoisi] = useState<{ id: string; code: string; nom: string } | null>(null);
  const handleSelectParc = useCallback((p: { id: string; code: string; nom: string }) => {
    setParcChoisi(p);
  }, []);

  const parcId = parcChoisi?.id;
  const parc = parcChoisi ?? allParcs?.find((p) => p.id === parcId);

  const { data: pointsBruts, isLoading } = usePointsControle(parcId, 'mensuel');
  const validerMutation = useValiderControleMensuel();

  const [etats, setEtats] = useState<Record<string, EtatPointMensuel>>({});
  const [zoneActive, setZoneActive] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [validated, setValidated] = useState(false);

  const [binomeNom, setBinomeNom] = useState('');
  const [signatureControleur1, setSignatureControleur1] = useState('');
  const [signatureControleur2, setSignatureControleur2] = useState('');

  const techniciensDuParc = useMemo(() => {
    if (!allUsers || !parcId) return [];
    return allUsers.filter(
      (u) =>
        u.id !== utilisateur?.id &&
        (u.role_code === 'technicien' || u.role_code === 'chef_maintenance') &&
        u.parcs.some((p) => p.parc_id === parcId)
    );
  }, [allUsers, parcId, utilisateur?.id]);

  const zones = useMemo(() => {
    if (!pointsBruts?.length) return [];
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const p of pointsBruts) {
      const existing = map.get(p.categorie_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.categorie_id, { code: p.categorie_id, label: p.categorie_nom, count: 1 });
      }
    }
    return Array.from(map.values()).map((z) => ({
      ...z,
      fait: pointsBruts.filter((p) => p.categorie_id === z.code && etats[p.point_id]).length,
    }));
  }, [pointsBruts, etats]);

  const activeZone = zoneActive || zones[0]?.code || '';

  const pointsZoneActive = useMemo(() => {
    if (!pointsBruts) return [];
    return pointsBruts.filter((p) => p.categorie_id === activeZone);
  }, [pointsBruts, activeZone]);

  const trigramme = utilisateur?.trigramme ?? utilisateur?.prenom?.slice(0, 2).toUpperCase() ?? '??';

  const pointRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const firstNullIdx = pointsZoneActive.findIndex((pt) => !etats[pt.point_id]);

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setEtats((prev) => ({
      ...prev,
      [id]: { etat, commentaire: prev[id]?.commentaire ?? '', saisiPar: trigramme },
    }));
    setDirty(true);
    const currentIdx = pointsZoneActive.findIndex((p) => p.point_id === id);
    const nextUnfilled = pointsZoneActive.findIndex((p, i) => i > currentIdx && !etats[p.point_id]);
    if (nextUnfilled !== -1) {
      requestAnimationFrame(() => {
        const el = pointRefsMap.current.get(pointsZoneActive[nextUnfilled].point_id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const setCommentaire = (id: string, commentaire: string) => {
    setEtats((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, commentaire } };
    });
  };

  const retourDestination = utilisateur?.role_code === 'technicien' ? '/tech/operations' : '/gmao';

  const handleRetour = useCallback(() => {
    if (dirty) setShowModale(true);
    else navigate(retourDestination);
  }, [dirty, navigate, retourDestination]);

  const confirmerQuitter = () => {
    setShowModale(false);
    navigate(retourDestination);
  };

  const totalPoints = zones.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zones.reduce((sum, z) => sum + z.fait, 0);
  const pctAvancement = totalPoints > 0 ? Math.round((totalFaits / totalPoints) * 100) : 0;

  const allPointsRemplis = totalFaits === totalPoints && totalPoints > 0;
  const allCommentsOk = useMemo(() => {
    if (!pointsBruts) return false;
    return pointsBruts.every((p) => {
      const e = etats[p.point_id];
      if (!e) return false;
      return e.commentaire.trim().length > 0;
    });
  }, [pointsBruts, etats]);

  const binomeOk = binomeNom.trim().length > 0 && signatureControleur1.length > 0 && signatureControleur2.length > 0;
  const canValidate = allPointsRemplis && allCommentsOk && binomeOk && !validerMutation.isPending;

  const validationRaison = validerMutation.isPending
    ? 'Enregistrement en cours...'
    : !allPointsRemplis
      ? `${totalPoints - totalFaits} points restants`
      : !allCommentsOk
        ? 'Commentaire requis pour chaque point'
        : !binomeNom.trim()
          ? 'Nom du binome requis'
          : !signatureControleur1
            ? 'Signature controleur 1 requise'
            : !signatureControleur2
              ? 'Signature binome requise'
              : undefined;

  const handleValider = async () => {
    if (!parcId || !utilisateur || !pointsBruts || !canValidate) return;

    const now = new Date();
    const datePlanifiee = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const items = pointsBruts
      .filter((p) => etats[p.point_id])
      .map((p) => ({
        point_id: p.point_id,
        etat: etats[p.point_id].etat,
        commentaire: etats[p.point_id].commentaire || null,
        point_libelle_snapshot: p.libelle,
        point_categorie_snapshot: p.categorie_nom,
        point_type_controle_snapshot: 'mensuel',
      }));

    await validerMutation.mutateAsync({
      parc_id: parcId,
      date_planifiee: datePlanifiee,
      realise_par_id: utilisateur.id,
      realise_par_nom: `${utilisateur.prenom} ${utilisateur.nom}`,
      realise_par_role: utilisateur.role_code,
      signature_url: signatureControleur1,
      meta: {
        binome_nom: binomeNom.trim(),
        binome_signature_url: signatureControleur2,
      },
      items,
    });

    setValidated(true);
  };

  const moisLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (!parcChoisi) {
    return <SelectionParc titre="Controle mensuel" onSelect={handleSelectParc} />;
  }

  if (isLoading) {
    return <div className="p-6 text-dim text-sm">Chargement des points de controle...</div>;
  }

  if (!pointsBruts?.length) {
    return (
      <div className="p-6">
        <div className="text-dim text-sm">Aucun point de controle mensuel configure pour ce parc.</div>
        <button onClick={() => navigate(retourDestination)} className="text-nikito-cyan text-sm mt-3">
          Retour aux operations
        </button>
      </div>
    );
  }

  if (validated) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">OK</div>
        <div className="text-lg font-semibold mb-1">Controle mensuel valide</div>
        <div className="text-dim text-sm mb-1">{totalFaits} points controles - {moisLabel}</div>
        <div className="text-dim text-[12px] mb-4">Binome : {binomeNom}</div>
        <button
          onClick={() => navigate(retourDestination)}
          className="bg-gradient-cta text-text px-6 py-3 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          Retour aux operations
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-bg-app text-text">
        <header className="px-3 md:px-[18px] py-3 md:py-3.5 bg-bg-sidebar flex items-center gap-2.5 md:gap-3.5 border-b border-white/[0.06]">
          <button
            onClick={handleRetour}
            className="bg-bg-card border border-white/[0.08] min-w-[44px] min-h-[44px] md:w-[34px] md:h-[34px] md:min-w-0 md:min-h-0 rounded-[10px] text-base flex-shrink-0 flex items-center justify-center"
          >
            &#8249;
          </button>
          <div className="w-9 h-9 rounded-[10px] bg-gradient-logo flex items-center justify-center font-bold text-bg-app flex-shrink-0">
            N
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-dim tracking-[1.2px]">CONTROLE MENSUEL · {parc?.code ?? ''}</div>
            <div className="text-[15px] font-semibold truncate">{moisLabel} - Controle mensuel approfondi</div>
          </div>
          <div className="flex items-center gap-2 bg-bg-card px-3 py-1.5 rounded-pill">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nikito-pink to-nikito-violet flex items-center justify-center font-bold text-xs text-text">
              {trigramme}
            </div>
            <div className="text-xs font-medium">{utilisateur?.prenom ?? ''}</div>
          </div>
          <BoutonRetourGmao />
        </header>

        <div className="bg-bg-deep px-3 md:px-[18px] py-3 md:py-3.5 border-b border-white/[0.04]">
          <div className="flex justify-between mb-2">
            <div className="text-xs text-dim">Avancement controle</div>
            <div className="text-[13px] font-semibold">
              <span className="text-nikito-cyan">{totalFaits}</span> / {totalPoints} points ·{' '}
              <span className="text-green">{pctAvancement}%</span>
            </div>
          </div>
          <div className="h-2 bg-bg-app rounded-full overflow-hidden flex">
            <div className="bg-gradient-to-r from-green to-lime" style={{ width: `${pctAvancement}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-dim">
            <span>{zones.filter((z) => z.fait === z.count).length} zones terminees</span>
            <span>{totalPoints - totalFaits} restants</span>
          </div>
        </div>

        <div className="bg-bg-deep px-3 md:px-[18px] pb-3.5 flex gap-1.5 overflow-x-auto border-b border-white/[0.04]">
          {zones.map((z) => {
            const fait = z.fait === z.count;
            const enCours = activeZone === z.code;
            const pasCommence = z.fait === 0 && !enCours;
            return (
              <button
                key={z.code}
                onClick={() => setZoneActive(z.code)}
                className={cn(
                  'px-3.5 py-2.5 md:py-2 rounded-[14px] text-[12px] md:text-[11px] font-semibold whitespace-nowrap min-h-[44px]',
                  fait && !enCours && 'bg-green text-bg-app',
                  enCours && 'bg-gradient-cta text-text',
                  pasCommence && 'bg-bg-card border border-white/[0.08] text-dim'
                )}
              >
                {fait ? '✓ ' : enCours ? '⏵ ' : '○ '}
                {z.label}
                <span className={cn('ml-1.5 px-1.5 py-px rounded-lg text-[10px]', enCours ? 'bg-white/25' : 'bg-bg-app/30')}>
                  {z.fait}/{z.count}
                </span>
              </button>
            );
          })}
        </div>

        <main className="p-3 px-3 md:p-3.5 md:px-[18px] flex flex-col gap-2.5">
          <div className="bg-bg-card rounded-xl p-3.5 px-4">
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm font-semibold">
                Zone {zones.find((z) => z.code === activeZone)?.label}
              </div>
              <span className="bt-num">{pointsZoneActive.length} points</span>
            </div>
            <div className="text-[11px] text-dim mb-3">
              Commentaire obligatoire pour chaque point
            </div>

            <div className="flex flex-col gap-2">
              {pointsZoneActive.map((p, idx) => {
                const e = etats[p.point_id];
                const isOK = e?.etat === 'ok';
                const isDeg = e?.etat === 'degrade';
                const isHS = e?.etat === 'hs';
                const aRepondre = !e;
                const isActive = idx === firstNullIdx;
                const isVerrouille = aRepondre && idx > firstNullIdx && firstNullIdx !== -1;

                return (
                  <div
                    key={p.point_id}
                    ref={(el) => { if (el) pointRefsMap.current.set(p.point_id, el); else pointRefsMap.current.delete(p.point_id); }}
                    className={cn(
                      'rounded-lg overflow-hidden transition-all duration-200',
                      isOK && 'bg-green/[0.06] border border-green/20',
                      isDeg && 'bg-amber/[0.06] border border-amber/30',
                      isHS && 'bg-red/[0.06] border border-red/30',
                      isActive && aRepondre && 'bg-nikito-cyan/[0.04] border-2 border-nikito-cyan animate-pulse-subtle',
                      isVerrouille && 'bg-bg-deep opacity-40 cursor-not-allowed',
                      !isOK && !isDeg && !isHS && !isActive && !isVerrouille && 'bg-bg-deep',
                    )}
                  >
                    <div className="flex items-center gap-2.5 p-2.5 px-3.5">
                      <span
                        className={cn(
                          'w-[26px] h-[26px] rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0',
                          isOK && 'bg-green text-bg-app',
                          isDeg && 'bg-amber text-bg-app',
                          isHS && 'bg-red text-bg-app',
                          isActive && aRepondre && 'bg-nikito-cyan text-bg-app',
                          isVerrouille && 'bg-[#2A2A5A] text-faint',
                          !isOK && !isDeg && !isHS && !isActive && !isVerrouille && aRepondre && 'bg-[#2A2A5A] text-dim',
                        )}
                      >
                        {isOK ? '✓' : isDeg ? '!' : isHS ? '×' : isVerrouille ? '🔒' : isActive ? '▸' : '○'}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          'text-xs',
                          (isOK || isDeg || isHS) && 'text-text',
                          isActive && aRepondre && 'text-[13px] font-semibold text-text',
                          isVerrouille && 'text-faint',
                          !isOK && !isDeg && !isHS && !isActive && !isVerrouille && aRepondre && 'text-dim',
                        )}>
                          {p.libelle}
                        </div>
                        {(isHS || isDeg) && (
                          <div className={cn('text-[10px] mt-0.5', isHS ? 'text-red' : 'text-amber')}>Photo + commentaire requis</div>
                        )}
                      </div>

                      {e?.saisiPar && (
                        <span className="bg-bg-deep text-nikito-cyan px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0">
                          {e.saisiPar}
                        </span>
                      )}

                      {e ? (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0',
                            isOK && 'bg-green text-bg-app',
                            isDeg && 'bg-amber text-bg-app',
                            isHS && 'bg-red text-bg-app',
                          )}
                        >
                          {isOK ? 'OK' : isDeg ? 'DEG' : 'HS'}
                        </span>
                      ) : isActive ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => setEtatPoint(p.point_id, 'ok')} className="bg-green text-bg-app px-4 py-2 rounded-lg text-[13px] font-bold min-h-[44px] min-w-[48px]">OK</button>
                          <button onClick={() => setEtatPoint(p.point_id, 'degrade')} className="bg-transparent border border-amber text-amber px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] min-w-[48px]">DEG</button>
                          <button onClick={() => setEtatPoint(p.point_id, 'hs')} className="bg-transparent border border-red text-red px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] min-w-[48px]">HS</button>
                        </div>
                      ) : null}
                    </div>

                    {e && (
                      <div className="px-3.5 pb-3 pt-1">
                        <textarea
                          value={e.commentaire}
                          onChange={(ev) => setCommentaire(p.point_id, ev.target.value)}
                          placeholder="Commentaire detaille (obligatoire)..."
                          rows={2}
                          className={cn(
                            'w-full bg-bg-app border rounded-[8px] p-2 text-[12px] text-text outline-none resize-y min-h-[40px] placeholder:text-faint',
                            e.commentaire.trim() ? 'border-white/[0.08]' : 'border-red/40',
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-bg-card rounded-xl p-4 border border-nikito-cyan/20">
            <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-nikito-cyan" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 17v-1a4 4 0 00-3-3.87M13 3.13a4 4 0 010 7.75M10 17v-1a4 4 0 00-4-4H4a4 4 0 00-4 4v1" />
                <circle cx="6" cy="7" r="4" />
              </svg>
              Validation binome
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                  Controleur 1 (vous)
                </label>
                <div className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text">
                  {utilisateur?.prenom} {utilisateur?.nom}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                  Controleur 2 (binome)
                </label>
                {techniciensDuParc.length > 0 ? (
                  <select
                    value={binomeNom}
                    onChange={(e) => setBinomeNom(e.target.value)}
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-nikito-cyan appearance-none"
                  >
                    <option value="">Selectionner le binome...</option>
                    {techniciensDuParc.map((u) => (
                      <option key={u.id} value={`${u.prenom} ${u.nom}`}>
                        {u.prenom} {u.nom}
                      </option>
                    ))}
                    <option value="__libre">Saisie libre...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={binomeNom}
                    onChange={(e) => setBinomeNom(e.target.value)}
                    placeholder="Nom du binome..."
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-nikito-cyan placeholder:text-faint"
                  />
                )}
                {binomeNom === '__libre' && (
                  <input
                    type="text"
                    onChange={(e) => setBinomeNom(e.target.value === '' ? '__libre' : e.target.value)}
                    placeholder="Nom du binome en saisie libre..."
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-nikito-cyan placeholder:text-faint mt-2"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SignatureCanvas
                  label={`Signature - ${utilisateur?.prenom ?? 'Controleur 1'}`}
                  signatureData={signatureControleur1}
                  onSignature={setSignatureControleur1}
                />
                <SignatureCanvas
                  label={`Signature - ${binomeNom && binomeNom !== '__libre' ? binomeNom : 'Binome'}`}
                  signatureData={signatureControleur2}
                  onSignature={setSignatureControleur2}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleValider}
            disabled={!canValidate}
            className={cn(
              'bg-gradient-cta text-text py-4 rounded-2xl text-[15px] font-bold mt-1 min-h-[56px]',
              !canValidate && 'opacity-50 cursor-not-allowed'
            )}
          >
            Valider le controle mensuel · double signature
            {validationRaison && (
              <span className="block mt-0.5 text-[11px] font-normal opacity-80">{validationRaison}</span>
            )}
          </button>
        </main>
      </div>

      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />
    </>
  );
}
