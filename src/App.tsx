import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TabletLayout } from '@/components/layout/TabletLayout';
import { RouteProtegee } from '@/components/auth/RouteProtegee';

import { Login } from '@/pages/auth/Login';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { AcceptationInvitation } from '@/pages/auth/AcceptationInvitation';

import { TableauDeBord } from '@/pages/direction/TableauDeBord';

import { Recurrences } from '@/pages/ryad/Recurrences';

import { Operations } from '@/pages/technicien/Operations';
import { Intervention } from '@/pages/technicien/Intervention';
import { ControleHebdo } from '@/pages/technicien/ControleHebdo';

import { LoginStaff } from '@/pages/staff/LoginStaff';
import { ControleOuverture } from '@/pages/staff/ControleOuverture';
import { PageSignaler } from '@/pages/signaler/PageSignaler';

import { ListeParcs } from '@/pages/admin/ListeParcs';
import { CreationParcWizard } from '@/pages/admin/CreationParcWizard';
import { UtilisateursAdmin } from '@/pages/admin/UtilisateursAdmin';
import { PageFournisseursAdmin } from '@/pages/admin/PageFournisseursAdmin';
import { PageITAdmin } from '@/pages/admin/PageITAdmin';

import { PageHistoriqueControles } from '@/pages/controles/PageHistoriqueControles';

import { FicheParc } from '@/pages/parc/FicheParc';
import { AttractionsParc } from '@/pages/parc/AttractionsParc';
import { PersonnaliserPointsParc } from '@/pages/parc/PersonnaliserPointsParc';

import {
  PageEquipements,
  PageStock,
  PageBibliotheque,
  ControleMensuel,
  FicheCinqPourquoi,
  ListeCinqPourquoi,
  PagePlaintes,
  PagePreventif,
  PageCertifications,
  VueManagerParc,
  PageProfil,
  MesSignalements,
  PageTechStock,
} from '@/pages/_stubs';

import { PageAide } from '@/pages/aide/PageAide';
import { PageFormation } from '@/pages/formation/PageFormation';
import { PageIAPredictive } from '@/pages/ia-predictive/PageIAPredictive';
import { PageNotificationsIA } from '@/pages/notifications/PageNotificationsIA';
import { PageFlotte } from '@/pages/flotte/PageFlotte';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invitation/:token" element={<AcceptationInvitation />} />
      <Route path="/staff/login" element={<LoginStaff />} />

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
        <Route path="aide" element={<PageAide />} />
        <Route path="formation" element={<PageFormation />} />
        <Route path="signaler" element={<PageSignaler />} />
        <Route path="it-admin" element={<PageITAdmin />} />
      </Route>

      <Route
        path="/tech"
        element={
          <RouteProtegee rolesAutorises={['technicien', 'chef_maintenance', 'direction']}>
            <TabletLayout />
          </RouteProtegee>
        }
      >
        <Route index element={<Navigate to="/tech/operations" replace />} />
        <Route path="operations" element={<Operations />} />
        <Route path="operations/:btNumero" element={<Intervention />} />
        <Route path="controle-hebdo" element={<ControleHebdo />} />
        <Route path="controle-mensuel" element={<ControleMensuel />} />
        <Route path="stock" element={<PageTechStock />} />
        <Route path="signaler" element={<PageSignaler />} />
      </Route>

      <Route path="/staff/controle-ouverture" element={<ControleOuverture />} />
      <Route path="/staff/signaler" element={<PageSignaler />} />
      <Route path="/staff/mes-signalements" element={<MesSignalements />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
