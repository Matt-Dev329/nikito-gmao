import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TabletLayout } from '@/components/layout/TabletLayout';
import { RouteProtegee } from '@/components/auth/RouteProtegee';
import { Login } from '@/pages/auth/Login';
import { useAuth } from '@/hooks/useAuth';
import { rattacherAbonnementPush } from '@/lib/push';
import { useEffectiveRole } from '@/hooks/useViewAs';

// Helper : lazy-load d'un export nommé
function page<T extends Record<string, unknown>>(factory: () => Promise<T>, name: keyof T) {
  return lazy(() => factory().then((m) => ({ default: m[name] as unknown as React.ComponentType })));
}

const ResetPassword = page(() => import('@/pages/auth/ResetPassword'), 'ResetPassword');
const AcceptationInvitation = page(() => import('@/pages/auth/AcceptationInvitation'), 'AcceptationInvitation');
const SelectParcPage = page(() => import('@/pages/auth/SelectParcPage'), 'SelectParcPage');
const TableauDeBord = page(() => import('@/pages/direction/TableauDeBord'), 'TableauDeBord');
const Recurrences = page(() => import('@/pages/ryad/Recurrences'), 'Recurrences');
const Operations = page(() => import('@/pages/technicien/Operations'), 'Operations');
const PagePlans = page(() => import('@/pages/documentation/PageDocumentsTechniques'), 'PagePlans');
const PageManuels = page(() => import('@/pages/documentation/PageDocumentsTechniques'), 'PageManuels');
const PageRapportsPrestataires = page(() => import('@/pages/documentation/PageDocumentsTechniques'), 'PageRapportsPrestataires');
const PageAnalysesPrestataires = page(() => import('@/pages/documentation/PageAnalysesPrestataires'), 'PageAnalysesPrestataires');
const PageBonsIntervention = page(() => import('@/pages/interventions/PageBonsIntervention'), 'PageBonsIntervention');
const PageControles = page(() => import('@/pages/controles/PageControles'), 'PageControles');
const PageRapportsReparation = page(() => import('@/pages/interventions/PageRapportsReparation'), 'PageRapportsReparation');
const Intervention = page(() => import('@/pages/technicien/Intervention'), 'Intervention');
const ControleHebdo = page(() => import('@/pages/technicien/ControleHebdo'), 'ControleHebdo');
const ControleMensuel = page(() => import('@/pages/technicien/ControleMensuel'), 'ControleMensuel');
const LoginStaff = page(() => import('@/pages/staff/LoginStaff'), 'LoginStaff');
const ControleOuverture = page(() => import('@/pages/staff/ControleOuverture'), 'ControleOuverture');
const ControleHebdoStaff = lazy(() =>
  import('@/pages/staff/ControleOuverture').then((m) => ({
    default: () => <m.ControleOuverture typeControle="hebdo" />,
  })),
);
const ListeParcs = page(() => import('@/pages/admin/ListeParcs'), 'ListeParcs');
const CreationParcWizard = page(() => import('@/pages/admin/CreationParcWizard'), 'CreationParcWizard');
const UtilisateursAdmin = page(() => import('@/pages/admin/UtilisateursAdmin'), 'UtilisateursAdmin');
const PageFournisseursAdmin = page(() => import('@/pages/admin/PageFournisseursAdmin'), 'PageFournisseursAdmin');
const PageITAdmin = page(() => import('@/pages/admin/PageITAdmin'), 'PageITAdmin');
const PageHistoriqueControles = page(() => import('@/pages/controles/PageHistoriqueControles'), 'PageHistoriqueControles');
const FicheParc = page(() => import('@/pages/parc/FicheParc'), 'FicheParc');
const AttractionsParc = page(() => import('@/pages/parc/AttractionsParc'), 'AttractionsParc');
const PersonnaliserPointsParc = page(() => import('@/pages/parc/PersonnaliserPointsParc'), 'PersonnaliserPointsParc');
const PageEquipements = page(() => import('@/pages/equipements/PageEquipements'), 'PageEquipements');
const PageStock = page(() => import('@/pages/stock/PageStock'), 'PageStock');
const PageCommander = page(() => import('@/pages/commandes/PageCommander'), 'PageCommander');
const PageBibliotheque = page(() => import('@/pages/bibliotheque/PageBibliotheque'), 'PageBibliotheque');
const FicheCinqPourquoi = page(() => import('@/pages/cinq-pourquoi/FicheCinqPourquoi'), 'FicheCinqPourquoi');
const ListeCinqPourquoi = page(() => import('@/pages/cinq-pourquoi/ListeCinqPourquoi'), 'ListeCinqPourquoi');
const PagePreventif = page(() => import('@/pages/preventif/PagePreventif'), 'PagePreventif');
const PageCertifications = page(() => import('@/pages/certifications/PageCertifications'), 'PageCertifications');
const VueManagerParc = page(() => import('@/pages/parc/VueManagerParc'), 'VueManagerParc');
const PageProfil = page(() => import('@/pages/profil/PageProfil'), 'PageProfil');
const MesSignalements = page(() => import('@/pages/staff/MesSignalements'), 'MesSignalements');
const PageAide = page(() => import('@/pages/aide/PageAide'), 'PageAide');
const PageFormation = page(() => import('@/pages/formation/PageFormation'), 'PageFormation');
const LayoutConformite = page(() => import('@/pages/conformite/LayoutConformite'), 'LayoutConformite');
const PageConformite = page(() => import('@/pages/conformite/PageConformite'), 'PageConformite');
const PageReserves = page(() => import('@/pages/conformite/PageReserves'), 'PageReserves');
const PageCommissions = page(() => import('@/pages/conformite/PageCommissions'), 'PageCommissions');
const PageDocuments = page(() => import('@/pages/conformite/PageDocuments'), 'PageDocuments');
const PageActeurs = page(() => import('@/pages/conformite/PageActeurs'), 'PageActeurs');
const PageExtractionRevue = page(() => import('@/pages/conformite/PageExtractionRevue'), 'PageExtractionRevue');

// Page d'accueil de /gmao selon le rôle (cohérent avec la Sidebar desktop)
function AccueilParRole() {
  const { utilisateur } = useAuth();
  const role = useEffectiveRole(utilisateur?.role_code ?? 'direction');
  if (role === 'manager_parc') return <Navigate to="/gmao/mon-parc" replace />;
  if (role === 'technicien') return <Navigate to="/gmao/operations" replace />;
  if (role === 'staff_operationnel') return <Navigate to="/staff/controle-ouverture" replace />;
  return <TableauDeBord />;
}

function ChargementPage() {
  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center">
      <div className="text-dim text-sm animate-pulse">Chargement…</div>
    </div>
  );
}

// Un appareil déjà abonné aux notifications est rattaché au compte connecté
function RattachementPush() {
  const { utilisateur } = useAuth();
  useEffect(() => {
    if (utilisateur?.id) rattacherAbonnementPush().catch(() => undefined);
  }, [utilisateur?.id]);
  return null;
}

export function App() {
  return (
    <Suspense fallback={<ChargementPage />}>
      <RattachementPush />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invitation/:token" element={<AcceptationInvitation />} />
        <Route path="/staff/login" element={<LoginStaff />} />

        <Route
          path="/gmao/select-parc"
          element={
            <RouteProtegee skipParcCheck>
              <SelectParcPage />
            </RouteProtegee>
          }
        />

        <Route
          path="/gmao"
          element={
            <RouteProtegee>
              <DashboardLayout />
            </RouteProtegee>
          }
        >
          <Route index element={<AccueilParRole />} />
          <Route path="operations" element={<Operations />} />
          <Route path="operations/:btNumero" element={<Intervention />} />
          <Route path="rapports" element={<PageRapportsReparation />} />
          <Route path="bons" element={<PageBonsIntervention />} />
          <Route path="controles" element={<PageControles />} />
          <Route path="plans" element={<PagePlans />} />
          <Route path="manuels" element={<PageManuels />} />
          <Route path="prestataires" element={<PageRapportsPrestataires />} />
          <Route path="analyses-prestataires" element={<PageAnalysesPrestataires />} />
          <Route path="equipements" element={<PageEquipements />} />
          <Route path="recurrences" element={<Recurrences />} />
          <Route path="cinq-pourquoi" element={<ListeCinqPourquoi />} />
          <Route path="cinq-pourquoi/:id" element={<FicheCinqPourquoi />} />
          <Route path="stock" element={<PageStock />} />
          <Route path="commander" element={<PageCommander />} />
          <Route path="preventif" element={<PagePreventif />} />
          <Route path="certifications" element={<PageCertifications />} />
          {/* Modules retirés (Flotte, Plaintes clients, IA prédictive) : retour à l'accueil */}
          <Route path="plaintes" element={<Navigate to="/gmao" replace />} />
          <Route path="profil" element={<PageProfil />} />
          <Route path="mon-parc" element={<VueManagerParc />} />
          <Route path="parcs" element={<ListeParcs />} />
          <Route path="parcs/nouveau" element={<CreationParcWizard />} />
          <Route path="parcs/:id" element={<FicheParc />} />
          <Route path="parcs/:id/attractions" element={<AttractionsParc />} />
          <Route path="parcs/:id/points/:categorieId" element={<PersonnaliserPointsParc />} />
          <Route path="utilisateurs" element={<UtilisateursAdmin />} />
          <Route path="bibliotheque" element={<PageBibliotheque />} />
          <Route path="fournisseurs" element={<PageFournisseursAdmin />} />
          <Route path="controles-historique" element={<PageHistoriqueControles />} />
          <Route path="ia-predictive" element={<Navigate to="/gmao" replace />} />
          <Route path="notifications-ia" element={<Navigate to="/gmao" replace />} />
          <Route path="flotte" element={<Navigate to="/gmao" replace />} />
          <Route path="conformite" element={<LayoutConformite />}>
            <Route index element={<PageConformite />} />
            <Route path="reserves" element={<PageReserves />} />
            <Route path="commissions" element={<PageCommissions />} />
            <Route path="documents" element={<PageDocuments />} />
            <Route path="acteurs" element={<PageActeurs />} />
            <Route path="extractions/:id" element={<PageExtractionRevue />} />
          </Route>
          <Route path="aide" element={<PageAide />} />
          <Route path="formation" element={<PageFormation />} />
          <Route path="it-admin" element={<PageITAdmin />} />
        </Route>

        <Route
          path="/tech"
          element={
            <RouteProtegee rolesAutorises={['technicien', 'chef_maintenance', 'directeur_parc', 'direction', 'admin_it']}>
              <TabletLayout />
            </RouteProtegee>
          }
        >
          <Route index element={<Navigate to="/tech/operations" replace />} />
          <Route path="operations" element={<Operations />} />
          <Route path="operations/:btNumero" element={<Intervention />} />
          <Route path="rapports" element={<PageRapportsReparation />} />
          <Route path="bons" element={<PageBonsIntervention />} />
          <Route path="controles" element={<PageControles />} />
          <Route path="plans" element={<PagePlans />} />
          <Route path="manuels" element={<PageManuels />} />
          <Route path="prestataires" element={<PageRapportsPrestataires />} />
          <Route path="analyses-prestataires" element={<PageAnalysesPrestataires />} />
          <Route path="controle-hebdo" element={<ControleHebdo />} />
          <Route path="controle-mensuel" element={<ControleMensuel />} />
          <Route path="stock" element={<PageStock />} />
        </Route>

        <Route path="/staff/controle-ouverture" element={<ControleOuverture />} />
        <Route path="/staff/controle-hebdo" element={<ControleHebdoStaff />} />
        <Route path="/staff/mes-signalements" element={<MesSignalements />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
