import { KpiCard } from '@/components/kpi/KpiCard';
import { Card } from '@/components/ui/Card';
import { CritTag } from '@/components/ui/CritTag';

export function Recurrences() {
  return (
    <div className="p-6 px-7 overflow-hidden">
      <div className="flex justify-between items-start mb-[18px]">
        <div>
          <div className="text-[11px] text-dim tracking-[1.5px] uppercase mb-1">
            Boucle d'apprentissage Lean
          </div>
          <h1 className="text-[22px] font-semibold m-0">Récurrences actives · à arbitrer</h1>
        </div>
        <div className="flex gap-2">
          <button className="bg-bg-card border border-white/[0.08] text-text px-3.5 py-1.5 rounded-lg text-xs">
            ≥2 pannes/30j
          </button>
          <button className="bg-gradient-cta text-text px-3.5 py-1.5 rounded-lg text-xs font-medium">
            Tous parcs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-[22px]">
        <KpiCard label="Équipements à surveiller" valeur="4" couleur="red" />
        <KpiCard label="5 Pourquoi en cours" valeur="2" couleur="amber" />
        <KpiCard label="Audits 90j programmés" valeur="3" couleur="violet" />
        <KpiCard label="Standards évolutifs validés" valeur="11" couleur="green" />
      </div>

      <Card borderLeft="pink" className="mb-[18px]">
        <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
          <CritTag niveau="priorite_1" />
          <span className="text-[15px] font-semibold">Tilt · badgeuse RFID</span>
          <span className="bt-num">DOM-ARC-TLT-01</span>
          <span className="ml-auto text-[11px] text-dim">Rosny Domus · zone Arcade</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-3.5">
          <div className="bg-bg-deep rounded-lg p-3 px-3.5">
            <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Pannes 30j</div>
            <div className="text-xl font-semibold text-red">3</div>
          </div>
          <div className="bg-bg-deep rounded-lg p-3 px-3.5">
            <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Pannes 90j</div>
            <div className="text-xl font-semibold text-amber">7</div>
          </div>
          <div className="bg-bg-deep rounded-lg p-3 px-3.5">
            <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Plaintes 7j</div>
            <div className="text-xl font-semibold text-nikito-pink">2</div>
          </div>
        </div>

        <div className="bg-bg-deep rounded-[10px] p-3.5 px-4 mb-3.5">
          <div className="text-[11px] text-dim uppercase tracking-wider mb-2.5">
            Symptôme · 5 Pourquoi en cours
          </div>
          <div className="flex flex-col gap-2">
            <Pourquoi numero="P" texte="Symptôme : badgeuse ne reconnaît plus les bracelets RFID après 2-3h de fonctionnement" couleurNum="pink" />
            <Pourquoi numero="1" texte="Pourquoi ? Le firmware lecteur freeze après lectures intensives" couleurNum="violet" />
            <Pourquoi numero="2" texte="Pourquoi ? Pas de watchdog logiciel, pas de redémarrage auto programmé" couleurNum="violet" />
            <Pourquoi numero="3" texte="À renseigner..." couleurNum="violet" italic />
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <button className="flex-1 min-w-[200px] bg-gradient-cta text-text py-3 px-4 rounded-[10px] text-[13px] font-semibold">
            Continuer le 5 Pourquoi
          </button>
          <button className="bg-bg-deep border border-white/10 text-text py-3 px-4 rounded-[10px] text-[13px]">
            Voir historique pannes
          </button>
          <button className="bg-bg-deep border border-white/10 text-text py-3 px-4 rounded-[10px] text-[13px]">
            Plaintes liées
          </button>
        </div>
      </Card>

      <Card borderLeft="amber" className="mb-3 p-4 px-[18px]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <CritTag niveau="priorite_2" />
          <span className="text-sm font-semibold">Roof Top · badgeuse RFID</span>
          <span className="bt-num">DOM-ARC-RFT-01</span>
          <span className="bg-bg-deep text-nikito-pink px-2 py-0.5 rounded-md text-[11px]">
            même symptôme que Tilt
          </span>
          <span className="ml-auto text-[11px] text-dim">3 pannes/30j · 1 plainte/7j</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          <button className="bg-gradient-cta text-text py-2 px-3.5 rounded-lg text-xs font-medium">
            Ouvrir 5 Pourquoi
          </button>
          <button className="bg-bg-deep border border-white/10 text-dim py-2 px-3.5 rounded-lg text-xs">
            Lier au 5P Tilt
          </button>
        </div>
      </Card>

      <Card borderLeft="amber" className="mb-3 p-4 px-[18px]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <CritTag niveau="priorite_3" />
          <span className="text-sm font-semibold">Submarine · système</span>
          <span className="bt-num">DOM-ATR-SUB-01</span>
          <span className="ml-auto text-[11px] text-dim">3 pannes/30j</span>
        </div>
      </Card>

      <Card borderLeft="violet" className="mb-[18px] p-3.5 px-[18px] flex items-center gap-3.5 flex-wrap">
        <div className="bg-nikito-violet text-bg-app w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
          ⏱
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[13px] font-semibold">Audit 90j · Karting pack 3 · freins</div>
          <div className="text-[11px] text-dim mt-0.5">
            Contre-mesure validée le 16/01/2026 · audit programmé 16/04/2026 ·{' '}
            <span className="text-green">demain</span>
          </div>
        </div>
        <button className="bg-transparent border border-nikito-cyan text-nikito-cyan py-2 px-3.5 rounded-lg text-xs">
          Préparer audit
        </button>
      </Card>

      <div className="bg-bg-deep rounded-xl p-3.5 px-[18px] flex items-center gap-3.5 border border-dashed border-nikito-violet/30">
        <div className="text-[11px] text-dim leading-relaxed flex-1">
          <strong className="text-nikito-pink">Cycle PDCA strict :</strong> quand tu valides un 5
          Pourquoi, l'audit 90j est programmé automatiquement. Si une panne identique se reproduit
          dans cet intervalle, la contre-mesure est marquée "inefficace" et le 5 Pourquoi se
          rouvre.
        </div>
      </div>
    </div>
  );
}

function Pourquoi({
  numero,
  texte,
  couleurNum,
  italic,
}: {
  numero: string;
  texte: string;
  couleurNum: 'pink' | 'violet';
  italic?: boolean;
}) {
  const bg = couleurNum === 'pink' ? 'bg-nikito-pink' : 'bg-nikito-violet';
  return (
    <div className="flex gap-3 items-start">
      <div className={`${bg} text-bg-app w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0`}>
        {numero}
      </div>
      <div className={`text-[13px] leading-relaxed ${italic ? 'text-dim italic' : ''}`}>
        {texte}
      </div>
    </div>
  );
}
