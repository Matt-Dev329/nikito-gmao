import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TabletLayout } from '@/components/layout/TabletLayout';
import { RouteProtegee } from '@/components/auth/RouteProtegee';
import { Login } from '@/pages/auth/Login';

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
const Intervention = page(() => import('@/pages/technicien/Intervention'), 'Intervention');
const ControleHebdo = page(() => import('@/pages/technicien/ControleHebdo'), 'ControleHebdo');
const ControleMensuel = page(() => import('@/pages/technicien/ControleMensuel'), 'ControleMensuel');
const LoginStaff = page(() => import('@/pages/staff/LoginStaff'), 'LoginStaff');
const ControleOuverture = page(() => import('@/pages/staff/ControleOuverture'), 'ControleOuverture');
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
const PageBibliotheque = page(() => import('@/pages/bibliotheque/PageBibliotheque'), 'PageBibliotheque');
const FicheCinqPourquoi = page(() => import('@/pages/cinq-pourquoi/FicheCinqPourquoi'), 'FicheCinqPourquoi');
const ListeCinqPourquoi = page(() => import('@/pages/cinq-pourquoi/ListeCinqPourquoi'), 'ListeCinqPourquoi');
const PagePlaintes = page(() => import('@/pages/plaintes/PagePlaintes'), 'PagePlaintes');
const PagePreventif = page(() => import('@/pages/preventif/PagePreventif'), 'PagePreventif');
const PageCertifications = page(() => import('@/pages/certifications/PageCertifications'), 'PageCertifications');
const VueManagerParc = page(() => import('@/pages/parc/VueManagerParc'), 'VueManagerParc');
const PageProfil = page(() => import('@/pages/profil/PageProfil'), 'PageProfil');
const MesSignalements = page(() => import('@/pages/_stubs'), 'MesSignalements');
const PageAide = page(() => import('@/pages/aide/PageAide'), 'PageAide');
const PageFormation = page(() => import('@/pages/formation/PageFormation'), 'PageFormation');
const PageIAPredictive = page(() => import('@/pages/ia-predictive/PageIAPredictive'), 'PageIAPredictive');
const PageNotificationsIA = page(() => import('@/pages/notifications/PageNotificationsIA'), 'PageNotificationsIA');
const PageFlotte = page(() => import('@/pages/flotte/PageFlotte'), 'PageFlotte');
const LayoutConformite = page(() => import('@/pages/conformite/LayoutConformite'), 'LayoutConformite');
const PageConformite = page(() => import('@/pages/conformite/PageConformite'), 'PageConformite');
const PageReserves = page(() => import('@/pages/conformite/PageReserves'), 'PageReserves');
const PageCommissions = page(() => import('@/pages/conformite/PageCommissions'), 'PageCommissions');
const PageDocuments = page(() => import('@/pages/conformite/PageDocuments'), 'PageDocuments');
const PageActeurs = page(() => import('@/pages/conformite/PageActeurs'), 'PageActeurs');
const PageExtractionRevue = page(() => import('@/pages/conformite/PageExtractionRevue'), 'PageExtractionRevue');

function ChargementPage() {
  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center">
      <div className="text-dim text-sm animate-pulse">Chargement…</div>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<ChargementPage />}>
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
          <Route index element={<TableauDeBord />} />
          <Route path="operations" element={<Operations />} />
          <Route path="operations/:btNumero" element={<Intervention />} />
          <Route path="equipements" element={<PageEquipements />} />
          <Route path="recurrences" element={<Recurrences />} />
          <Route path="cinq-pourquoi" element={<ListeCinqPourquoi />} />
          <Route path="cinq-pourquoi/:id" element={<FicheCinqPourquoi />} />
          <Route path="stock" element={<PageStock />} />
          <Route path="preventif" element={<PagePreventif />} />
          <Route path="certifications" element={<PageCertifications />} />
          <Route path="plaintes" element={<PagePlaintes />} />
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
          <Route path="ia-predictive" element={<PageIAPredictive />} />
          <Route path="notifications-ia" element={<PageNotificationsIA />} />
          <Route path="flotte" element={<PageFlotte />} />
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
          <Route path="controle-hebdo" element={<ControleHebdo />} />
          <Route path="controle-mensuel" element={<ControleMensuel />} />
          <Route path="stock" element={<PageStock />} />
        </Route>

        <Route path="/staff/controle-ouverture" element={<ControleOuverture />} />
        <Route path="/staff/mes-signalements" element={<MesSignalements />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
