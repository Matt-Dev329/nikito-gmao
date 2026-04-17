// ============================================================
// Page stubs · à compléter par Bolt
// Chaque page a sa structure de base, ses queries, son routing
// Bolt n'a qu'à remplir le contenu UI
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useStock, useStockBas, useFiches5Pourquoi } from '@/hooks/queries/useTickets';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';

export { PageEquipements } from '@/pages/equipements/PageEquipements';

// ------------------------------------------------------------
// STOCK pièces détachées
// ------------------------------------------------------------
export function PageStock() {
  const { data: stock } = useStock();
  const { data: stockBas } = useStockBas();

  return (
    <div className="p-6 px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Stock pièces détachées</h1>
          <div className="text-[13px] text-dim mt-1">
            {stock?.length ?? 0} références ·{' '}
            <span className="text-red font-medium">{stockBas?.length ?? 0} en rupture</span>
          </div>
        </div>
        <button className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[13px] font-bold">
          + Nouvelle pièce
        </button>
      </div>
      {/* TODO Bolt · table stock + alertes + commande fournisseur */}
    </div>
  );
}

export { PageBibliotheque } from '@/pages/bibliotheque/PageBibliotheque';

// ------------------------------------------------------------
// CONTROLE MENSUEL (validation binôme)
// ------------------------------------------------------------
export function ControleMensuel() {
  return (
    <div>
      {/* TODO Bolt · réutiliser ControleEcran avec type='mensuel' + écran double signature à la fin */}
      Contrôle mensuel · à venir (validation binôme requise)
    </div>
  );
}

// ------------------------------------------------------------
// 5 POURQUOI · saisie complète
// ------------------------------------------------------------
export function FicheCinqPourquoi() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Fiche 5 Pourquoi</h1>
      {/* TODO Bolt · formulaire 5 questions + cause racine + contre-mesure + audit 90j auto */}
    </div>
  );
}

export function ListeCinqPourquoi() {
  const { data: fiches } = useFiches5Pourquoi();
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">5 Pourquoi · {fiches?.length ?? 0} fiches</h1>
      {/* TODO Bolt · liste filtrée par statut */}
    </div>
  );
}

// ------------------------------------------------------------
// PLAINTES CLIENTS
// ------------------------------------------------------------
export function PagePlaintes() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Plaintes clients</h1>
      {/* TODO Bolt · saisie + historique · trigger SQL crée ticket prévisionnel à 3 plaintes/7j */}
    </div>
  );
}

// ------------------------------------------------------------
// PREVENTIF (planning)
// ------------------------------------------------------------
export function PagePreventif() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Maintenance préventive</h1>
      {/* TODO Bolt · calendrier maintenances_preventives + génération auto BT */}
    </div>
  );
}

// ------------------------------------------------------------
// CERTIFICATIONS
// ------------------------------------------------------------
export function PageCertifications() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Certifications & normes</h1>
      {/* TODO Bolt · liste certifications avec alertes échéances */}
    </div>
  );
}

// ------------------------------------------------------------
// UTILISATEURS (admin)
// ------------------------------------------------------------
export function PageUtilisateurs() {
  return (
    <div className="p-6 px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Utilisateurs</h1>
          <div className="text-[13px] text-dim mt-1">
            Gestion des comptes · rôles · attribution parcs · PIN staff
          </div>
        </div>
        <button className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[13px] font-bold">
          + Inviter un utilisateur
        </button>
      </div>
      {/* TODO Bolt · table utilisateurs + filtres rôle + génération PIN */}
    </div>
  );
}

// ------------------------------------------------------------
// FOURNISSEURS (admin)
// ------------------------------------------------------------
export function PageFournisseurs() {
  const { data: fournisseurs } = useFournisseurs();
  return (
    <div className="p-6 px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Fournisseurs</h1>
          <div className="text-[13px] text-dim mt-1">{fournisseurs?.length ?? 0} fournisseurs</div>
        </div>
      </div>
      {/* TODO Bolt · CRUD fournisseurs + contrats + SLA */}
    </div>
  );
}

// ------------------------------------------------------------
// MANAGER PARC (vue dédiée)
// ------------------------------------------------------------
export function VueManagerParc() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Mon parc · vue manager</h1>
      {/* TODO Bolt · KPI parc + alertes + équipe + contrôles du jour */}
    </div>
  );
}

// ------------------------------------------------------------
// PROFIL utilisateur (RGPD GPS)
// ------------------------------------------------------------
export function PageProfil() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Mon profil</h1>
      {/* TODO Bolt · infos perso + consentement GPS RGPD + changement mot de passe */}
    </div>
  );
}

// ------------------------------------------------------------
// TECH STOCK (vue terrain)
// ------------------------------------------------------------
export function PageTechStock() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Stock</h1>
      <div className="text-[13px] text-dim mt-1">
        Vue stock terrain — bientôt disponible
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// TECH SIGNALER (incident terrain)
// ------------------------------------------------------------
export function PageTechSignaler() {
  return (
    <div className="p-6 px-7">
      <h1 className="text-[22px] font-semibold m-0">Signaler</h1>
      <div className="text-[13px] text-dim mt-1">
        Signalement d'incident — bientôt disponible
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MES SIGNALEMENTS (staff)
// ------------------------------------------------------------
export function MesSignalements() {
  const navigate = useNavigate();
  return (
    <div className="p-6 px-7">
      <button onClick={() => navigate(-1)} className="text-nikito-cyan text-sm mb-3">
        ‹ Retour
      </button>
      <h1 className="text-[22px] font-semibold m-0">Mes signalements du jour</h1>
      {/* TODO Bolt · liste incidents source='staff_caisse' du user courant */}
    </div>
  );
}
