import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TabletLayout } from '@/components/layout/TabletLayout';

// Auth
import { Login } from '@/pages/auth/Login';
import { AcceptationInvitation } from '@/pages/auth/AcceptationInvitation';

// Direction
import { TableauDeBord } from '@/pages/direction/TableauDeBord';

// Ryad chef d'équipe
import { Recurrences } from '@/pages/ryad/Recurrences';

// Technicien
import { Operations } from '@/pages/technicien/Operations';
import { Intervention } from '@/pages/technicien/Intervention';
import { ControleHebdo } from '@/pages/technicien/ControleHebdo';

// Staff opérationnel
import { LoginStaff } from '@/pages/staff/LoginStaff';
import { ControleOuverture } from '@/pages/staff/ControleOuverture';

// Admin
import { ListeParcs } from '@/pages/admin/ListeParcs';
import { CreationParcWizard } from '@/pages/admin/CreationParcWizard';
import { UtilisateursAdmin } from '@/pages/admin/UtilisateursAdmin';
import { PageFournisseursAdmin } from '@/pages/admin/PageFournisseursAdmin';

// Parc (fiche détail)
import { FicheParc } from '@/pages/parc/FicheParc';

// Stubs
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
} from '@/pages/_stubs';

export function App() {
  return (
    <Routes>
      {/* Auth (pas de layout) */}
      <Route path="/login" element={<Login />} />
      <Route path="/invitation/:token" element={<AcceptationInvitation />} />

      {/* Layout sidebar · Direction, Ryad, Manager, Admin */}
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/tableau-de-bord" replace />} />

        {/* Pilotage commun */}
        <Route path="/tableau-de-bord" element={<TableauDeBord />} />
        <Route path="/recurrences" element={<Recurrences />} />
        <Route path="/cinq-pourquoi" element={<ListeCinqPourquoi />} />
        <Route path="/cinq-pourquoi/:id" element={<FicheCinqPourquoi />} />
        <Route path="/equipements" element={<PageEquipements />} />
        <Route path="/stock" element={<PageStock />} />
        <Route path="/preventif" element={<PagePreventif />} />
        <Route path="/certifications" element={<PageCertifications />} />
        <Route path="/plaintes" element={<PagePlaintes />} />
        <Route path="/profil" element={<PageProfil />} />

        {/* Manager parc */}
        <Route path="/mon-parc" element={<VueManagerParc />} />

        {/* Admin · Parcs */}
        <Route path="/admin/parcs" element={<ListeParcs />} />
        <Route path="/admin/parcs/nouveau" element={<CreationParcWizard />} />
        <Route path="/admin/parcs/:id" element={<FicheParc />} />

        {/* Admin · Utilisateurs et fournisseurs */}
        <Route path="/admin/utilisateurs" element={<UtilisateursAdmin />} />
        <Route path="/admin/bibliotheque" element={<PageBibliotheque />} />
        <Route path="/admin/fournisseurs" element={<PageFournisseursAdmin />} />
      </Route>

      {/* Layout tablette plein écran · Technicien */}
      <Route element={<TabletLayout />}>
        <Route path="/operations" element={<Operations />} />
        <Route path="/operations/:btNumero" element={<Intervention />} />
        <Route path="/controle-hebdo" element={<ControleHebdo />} />
        <Route path="/controle-mensuel" element={<ControleMensuel />} />
      </Route>

      {/* Pages plein écran · Staff opérationnel (tablette parc) */}
      <Route path="/staff" element={<LoginStaff />} />
      <Route path="/staff/controle-ouverture" element={<ControleOuverture />} />
      <Route path="/staff/mes-signalements" element={<MesSignalements />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
