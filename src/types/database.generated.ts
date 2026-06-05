// Types générés automatiquement depuis Supabase — NE PAS éditer à la main.
// Régénérer via le MCP Supabase generate_typescript_types
// (ou `supabase gen types typescript --project-id xhpykmhbahiikqbzwfkc`).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acteurs_chantier: {
        Row: {
          contact_email: string | null
          contact_nom: string | null
          contact_tel: string | null
          cree_le: string | null
          cree_par_id: string | null
          date_debut_mission: string | null
          date_fin_mission: string | null
          id: string
          modifie_le: string | null
          modifie_par_id: string | null
          nom_societe: string
          notes: string | null
          parc_id: string
          type_acteur: string
        }
        Insert: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_debut_mission?: string | null
          date_fin_mission?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          nom_societe: string
          notes?: string | null
          parc_id: string
          type_acteur: string
        }
        Update: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_debut_mission?: string | null
          date_fin_mission?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          nom_societe?: string
          notes?: string | null
          parc_id?: string
          type_acteur?: string
        }
        Relationships: [
          {
            foreignKeyName: "acteurs_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acteurs_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "acteurs_chantier_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acteurs_chantier_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "acteurs_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acteurs_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "acteurs_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "acteurs_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      archives_pdf: {
        Row: {
          conservation_jusqua: string
          controle_id: string | null
          cree_le: string | null
          date_generation: string | null
          id: string
          intervention_id: string | null
          parc_id: string | null
          signature_sha256: string | null
          taille_octets: number | null
          type: string
          url_storage: string
        }
        Insert: {
          conservation_jusqua: string
          controle_id?: string | null
          cree_le?: string | null
          date_generation?: string | null
          id?: string
          intervention_id?: string | null
          parc_id?: string | null
          signature_sha256?: string | null
          taille_octets?: number | null
          type: string
          url_storage: string
        }
        Update: {
          conservation_jusqua?: string
          controle_id?: string | null
          cree_le?: string | null
          date_generation?: string | null
          id?: string
          intervention_id?: string | null
          parc_id?: string | null
          signature_sha256?: string | null
          taille_octets?: number | null
          type?: string
          url_storage?: string
        }
        Relationships: [
          {
            foreignKeyName: "archives_pdf_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archives_pdf_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "vue_avancement_hebdo"
            referencedColumns: ["controle_id"]
          },
          {
            foreignKeyName: "archives_pdf_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archives_pdf_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archives_pdf_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "archives_pdf_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "archives_pdf_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      bibliotheque_points: {
        Row: {
          actif: boolean | null
          assigne_a: string | null
          bloquant_si_ko: boolean | null
          categorie_id: string
          cree_le: string | null
          description: string | null
          id: string
          libelle: string
          modifie_le: string | null
          norme_associee: string | null
          obligation_constructeur: boolean | null
          ordre: number
          photo_obligatoire: boolean | null
          type_controle: Database["public"]["Enums"]["type_controle"]
          verrouille: boolean | null
        }
        Insert: {
          actif?: boolean | null
          assigne_a?: string | null
          bloquant_si_ko?: boolean | null
          categorie_id: string
          cree_le?: string | null
          description?: string | null
          id?: string
          libelle: string
          modifie_le?: string | null
          norme_associee?: string | null
          obligation_constructeur?: boolean | null
          ordre?: number
          photo_obligatoire?: boolean | null
          type_controle: Database["public"]["Enums"]["type_controle"]
          verrouille?: boolean | null
        }
        Update: {
          actif?: boolean | null
          assigne_a?: string | null
          bloquant_si_ko?: boolean | null
          categorie_id?: string
          cree_le?: string | null
          description?: string | null
          id?: string
          libelle?: string
          modifie_le?: string | null
          norme_associee?: string | null
          obligation_constructeur?: boolean | null
          ordre?: number
          photo_obligatoire?: boolean | null
          type_controle?: Database["public"]["Enums"]["type_controle"]
          verrouille?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bibliotheque_points_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_equipement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bibliotheque_points_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_categories_equipement_suggestions"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "bibliotheque_points_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["categorie_id"]
          },
        ]
      }
      categories_equipement: {
        Row: {
          cree_le: string | null
          criticite_defaut: string | null
          description: string | null
          fournisseur_principal_id: string | null
          id: string
          nom: string
          norme_associee: string | null
        }
        Insert: {
          cree_le?: string | null
          criticite_defaut?: string | null
          description?: string | null
          fournisseur_principal_id?: string | null
          id?: string
          nom: string
          norme_associee?: string | null
        }
        Update: {
          cree_le?: string | null
          criticite_defaut?: string | null
          description?: string | null
          fournisseur_principal_id?: string | null
          id?: string
          nom?: string
          norme_associee?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cat_fournisseur"
            columns: ["fournisseur_principal_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          cree_le: string | null
          date_certif: string
          document_pdf_url: string | null
          equipement_id: string
          est_formation: boolean
          id: string
          modifie_le: string | null
          norme: string
          notes: string | null
          numero_certificat: string | null
          organisme_certificateur: string | null
          prochaine_echeance: string
        }
        Insert: {
          cree_le?: string | null
          date_certif: string
          document_pdf_url?: string | null
          equipement_id: string
          est_formation?: boolean
          id?: string
          modifie_le?: string | null
          norme: string
          notes?: string | null
          numero_certificat?: string | null
          organisme_certificateur?: string | null
          prochaine_echeance: string
        }
        Update: {
          cree_le?: string | null
          date_certif?: string
          document_pdf_url?: string | null
          equipement_id?: string
          est_formation?: boolean
          id?: string
          modifie_le?: string | null
          norme?: string
          notes?: string | null
          numero_certificat?: string | null
          organisme_certificateur?: string | null
          prochaine_echeance?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "certifications_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
        ]
      }
      codes_2fa: {
        Row: {
          code: string
          cree_le: string | null
          email: string
          expire_le: string
          id: string
          tentatives: number | null
          utilise: boolean | null
        }
        Insert: {
          code: string
          cree_le?: string | null
          email: string
          expire_le?: string
          id?: string
          tentatives?: number | null
          utilise?: boolean | null
        }
        Update: {
          code?: string
          cree_le?: string | null
          email?: string
          expire_le?: string
          id?: string
          tentatives?: number | null
          utilise?: boolean | null
        }
        Relationships: []
      }
      commissions_securite: {
        Row: {
          cree_le: string | null
          cree_par_id: string | null
          date_pv: string | null
          date_visite: string
          id: string
          modifie_le: string | null
          modifie_par_id: string | null
          notes: string | null
          numero_pv: string | null
          parc_id: string
          presents_externes: Json | null
          presents_internes: string[] | null
          president_commission: string | null
          prochaine_visite_prevue: string | null
          pv_url: string | null
          resultat: string | null
          type_commission: string
        }
        Insert: {
          cree_le?: string | null
          cree_par_id?: string | null
          date_pv?: string | null
          date_visite: string
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          notes?: string | null
          numero_pv?: string | null
          parc_id: string
          presents_externes?: Json | null
          presents_internes?: string[] | null
          president_commission?: string | null
          prochaine_visite_prevue?: string | null
          pv_url?: string | null
          resultat?: string | null
          type_commission: string
        }
        Update: {
          cree_le?: string | null
          cree_par_id?: string | null
          date_pv?: string | null
          date_visite?: string
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          notes?: string | null
          numero_pv?: string | null
          parc_id?: string
          presents_externes?: Json | null
          presents_internes?: string[] | null
          president_commission?: string | null
          prochaine_visite_prevue?: string | null
          pv_url?: string | null
          resultat?: string | null
          type_commission?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_securite_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_securite_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "commissions_securite_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_securite_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "commissions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "commissions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "commissions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      config_globale: {
        Row: {
          cle: string
          description: string | null
          modifie_le: string | null
          valeur: string
        }
        Insert: {
          cle: string
          description?: string | null
          modifie_le?: string | null
          valeur: string
        }
        Update: {
          cle?: string
          description?: string | null
          modifie_le?: string | null
          valeur?: string
        }
        Relationships: []
      }
      controle_items: {
        Row: {
          commentaire: string | null
          controle_id: string
          equipement_id: string | null
          est_formation: boolean
          etat: Database["public"]["Enums"]["etat_controle_item"]
          id: string
          incident_genere_id: string | null
          photo_url: string | null
          point_categorie_snapshot: string | null
          point_id: string
          point_libelle_snapshot: string | null
          point_type_controle_snapshot: string | null
          saisi_le: string | null
          saisi_par_id: string | null
          signataires: string[] | null
        }
        Insert: {
          commentaire?: string | null
          controle_id: string
          equipement_id?: string | null
          est_formation?: boolean
          etat: Database["public"]["Enums"]["etat_controle_item"]
          id?: string
          incident_genere_id?: string | null
          photo_url?: string | null
          point_categorie_snapshot?: string | null
          point_id: string
          point_libelle_snapshot?: string | null
          point_type_controle_snapshot?: string | null
          saisi_le?: string | null
          saisi_par_id?: string | null
          signataires?: string[] | null
        }
        Update: {
          commentaire?: string | null
          controle_id?: string
          equipement_id?: string | null
          est_formation?: boolean
          etat?: Database["public"]["Enums"]["etat_controle_item"]
          id?: string
          incident_genere_id?: string | null
          photo_url?: string | null
          point_categorie_snapshot?: string | null
          point_id?: string
          point_libelle_snapshot?: string | null
          point_type_controle_snapshot?: string | null
          saisi_le?: string | null
          saisi_par_id?: string | null
          signataires?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "controle_items_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_items_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "vue_avancement_hebdo"
            referencedColumns: ["controle_id"]
          },
          {
            foreignKeyName: "controle_items_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_items_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "controle_items_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "controle_items_incident_genere_id_fkey"
            columns: ["incident_genere_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_items_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "bibliotheque_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_items_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["point_id"]
          },
        ]
      }
      controles: {
        Row: {
          cree_le: string | null
          date_demarrage: string | null
          date_planifiee: string
          date_validation: string | null
          est_formation: boolean
          gps_latitude: number | null
          gps_longitude: number | null
          hash_integrite: string | null
          id: string
          meta: Json | null
          modifie_le: string | null
          motif_correction: string | null
          parc_id: string
          pdf_signe_url: string | null
          realise_par_id: string | null
          realise_par_nom: string | null
          realise_par_role: string | null
          remplace_id: string | null
          signature_at: string | null
          signature_ip: string | null
          signature_url: string | null
          signature_user_agent: string | null
          statut: Database["public"]["Enums"]["statut_controle"] | null
          type: Database["public"]["Enums"]["type_controle"]
          valide_par_id: string | null
        }
        Insert: {
          cree_le?: string | null
          date_demarrage?: string | null
          date_planifiee: string
          date_validation?: string | null
          est_formation?: boolean
          gps_latitude?: number | null
          gps_longitude?: number | null
          hash_integrite?: string | null
          id?: string
          meta?: Json | null
          modifie_le?: string | null
          motif_correction?: string | null
          parc_id: string
          pdf_signe_url?: string | null
          realise_par_id?: string | null
          realise_par_nom?: string | null
          realise_par_role?: string | null
          remplace_id?: string | null
          signature_at?: string | null
          signature_ip?: string | null
          signature_url?: string | null
          signature_user_agent?: string | null
          statut?: Database["public"]["Enums"]["statut_controle"] | null
          type: Database["public"]["Enums"]["type_controle"]
          valide_par_id?: string | null
        }
        Update: {
          cree_le?: string | null
          date_demarrage?: string | null
          date_planifiee?: string
          date_validation?: string | null
          est_formation?: boolean
          gps_latitude?: number | null
          gps_longitude?: number | null
          hash_integrite?: string | null
          id?: string
          meta?: Json | null
          modifie_le?: string | null
          motif_correction?: string | null
          parc_id?: string
          pdf_signe_url?: string | null
          realise_par_id?: string | null
          realise_par_nom?: string | null
          realise_par_role?: string | null
          remplace_id?: string | null
          signature_at?: string | null
          signature_ip?: string | null
          signature_url?: string | null
          signature_user_agent?: string | null
          statut?: Database["public"]["Enums"]["statut_controle"] | null
          type?: Database["public"]["Enums"]["type_controle"]
          valide_par_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "controles_remplace_id_fkey"
            columns: ["remplace_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_remplace_id_fkey"
            columns: ["remplace_id"]
            isOneToOne: false
            referencedRelation: "vue_avancement_hebdo"
            referencedColumns: ["controle_id"]
          },
        ]
      }
      controles_audit_log: {
        Row: {
          action: string
          controle_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip: string | null
          user_agent: string | null
          utilisateur_id: string | null
          utilisateur_nom: string | null
          utilisateur_role: string | null
        }
        Insert: {
          action: string
          controle_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          utilisateur_id?: string | null
          utilisateur_nom?: string | null
          utilisateur_role?: string | null
        }
        Update: {
          action?: string
          controle_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          utilisateur_id?: string | null
          utilisateur_nom?: string | null
          utilisateur_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_audit_log_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_audit_log_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "vue_avancement_hebdo"
            referencedColumns: ["controle_id"]
          },
          {
            foreignKeyName: "controles_audit_log_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_audit_log_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      devices_reconnus: {
        Row: {
          actif: boolean | null
          cree_le: string | null
          derniere_connexion: string | null
          device_hash: string
          expire_le: string | null
          id: string
          ip: string | null
          navigateur: string | null
          nom_device: string | null
          utilisateur_id: string
        }
        Insert: {
          actif?: boolean | null
          cree_le?: string | null
          derniere_connexion?: string | null
          device_hash: string
          expire_le?: string | null
          id?: string
          ip?: string | null
          navigateur?: string | null
          nom_device?: string | null
          utilisateur_id: string
        }
        Update: {
          actif?: boolean | null
          cree_le?: string | null
          derniere_connexion?: string | null
          device_hash?: string
          expire_le?: string | null
          id?: string
          ip?: string | null
          navigateur?: string | null
          nom_device?: string | null
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_reconnus_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_reconnus_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      documents_chantier: {
        Row: {
          categorie: string
          commission_id: string | null
          cree_le: string | null
          cree_par_id: string | null
          date_document: string | null
          emis_par: string | null
          est_obligatoire_ouverture: boolean | null
          fichier_url: string
          id: string
          intitule: string
          modifie_le: string | null
          modifie_par_id: string | null
          parc_id: string
          prescription_id: string | null
        }
        Insert: {
          categorie: string
          commission_id?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_document?: string | null
          emis_par?: string | null
          est_obligatoire_ouverture?: boolean | null
          fichier_url: string
          id?: string
          intitule: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          parc_id: string
          prescription_id?: string | null
        }
        Update: {
          categorie?: string
          commission_id?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_document?: string | null
          emis_par?: string | null
          est_obligatoire_ouverture?: boolean | null
          fichier_url?: string
          id?: string
          intitule?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          parc_id?: string
          prescription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_chantier_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions_securite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "documents_chantier_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_chantier_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "documents_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "documents_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "documents_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "documents_chantier_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions_securite"
            referencedColumns: ["id"]
          },
        ]
      }
      equipements: {
        Row: {
          a_surveiller: boolean | null
          categorie_id: string
          code: string
          code_zone: string | null
          commande: string | null
          cree_le: string | null
          cree_par_id: string | null
          date_fin_garantie: string | null
          date_mise_service: string | null
          est_formation: boolean
          id: string
          libelle: string
          meta: Json | null
          modifie_le: string | null
          modifie_par_id: string | null
          numero_reader: string | null
          numero_serie: string | null
          numero_unite: number | null
          parc_id: string
          photo_url: string | null
          revenu_journalier_estime: number | null
          statut: string | null
          type_attraction: string | null
          zone_id: string | null
        }
        Insert: {
          a_surveiller?: boolean | null
          categorie_id: string
          code: string
          code_zone?: string | null
          commande?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_fin_garantie?: string | null
          date_mise_service?: string | null
          est_formation?: boolean
          id?: string
          libelle: string
          meta?: Json | null
          modifie_le?: string | null
          modifie_par_id?: string | null
          numero_reader?: string | null
          numero_serie?: string | null
          numero_unite?: number | null
          parc_id: string
          photo_url?: string | null
          revenu_journalier_estime?: number | null
          statut?: string | null
          type_attraction?: string | null
          zone_id?: string | null
        }
        Update: {
          a_surveiller?: boolean | null
          categorie_id?: string
          code?: string
          code_zone?: string | null
          commande?: string | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_fin_garantie?: string | null
          date_mise_service?: string | null
          est_formation?: boolean
          id?: string
          libelle?: string
          meta?: Json | null
          modifie_le?: string | null
          modifie_par_id?: string | null
          numero_reader?: string | null
          numero_serie?: string | null
          numero_unite?: number | null
          parc_id?: string
          photo_url?: string | null
          revenu_journalier_estime?: number | null
          statut?: string | null
          type_attraction?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_equipement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_categories_equipement_suggestions"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "equipements_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "equipements_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "equipements_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      extractions_pv: {
        Row: {
          commission_id: string
          cout_estime: number | null
          cree_le: string | null
          cree_par_id: string | null
          document_id: string | null
          duree_traitement_ms: number | null
          erreur_message: string | null
          id: string
          nb_prescriptions_extraites: number | null
          nb_prescriptions_rejetees: number | null
          nb_prescriptions_validees: number | null
          parc_id: string
          pv_filename: string | null
          pv_url: string
          raw_response_claude: Json | null
          statut: string
          validee_le: string | null
        }
        Insert: {
          commission_id: string
          cout_estime?: number | null
          cree_le?: string | null
          cree_par_id?: string | null
          document_id?: string | null
          duree_traitement_ms?: number | null
          erreur_message?: string | null
          id?: string
          nb_prescriptions_extraites?: number | null
          nb_prescriptions_rejetees?: number | null
          nb_prescriptions_validees?: number | null
          parc_id: string
          pv_filename?: string | null
          pv_url: string
          raw_response_claude?: Json | null
          statut?: string
          validee_le?: string | null
        }
        Update: {
          commission_id?: string
          cout_estime?: number | null
          cree_le?: string | null
          cree_par_id?: string | null
          document_id?: string | null
          duree_traitement_ms?: number | null
          erreur_message?: string | null
          id?: string
          nb_prescriptions_extraites?: number | null
          nb_prescriptions_rejetees?: number | null
          nb_prescriptions_validees?: number | null
          parc_id?: string
          pv_filename?: string | null
          pv_url?: string
          raw_response_claude?: Json | null
          statut?: string
          validee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extractions_pv_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions_securite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extractions_pv_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extractions_pv_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "extractions_pv_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_chantier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extractions_pv_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extractions_pv_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "extractions_pv_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "extractions_pv_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          actif_global: boolean | null
          cree_le: string | null
          description: string | null
          feature_code: string
          feature_label: string
          id: string
          modifie_le: string | null
          ordre: number | null
          roles_autorises: string[] | null
        }
        Insert: {
          actif_global?: boolean | null
          cree_le?: string | null
          description?: string | null
          feature_code: string
          feature_label: string
          id?: string
          modifie_le?: string | null
          ordre?: number | null
          roles_autorises?: string[] | null
        }
        Update: {
          actif_global?: boolean | null
          cree_le?: string | null
          description?: string | null
          feature_code?: string
          feature_label?: string
          id?: string
          modifie_le?: string | null
          ordre?: number | null
          roles_autorises?: string[] | null
        }
        Relationships: []
      }
      fiches_5_pourquoi: {
        Row: {
          audit_90j_le: string | null
          audit_resultat: string | null
          cause_racine: string | null
          contre_mesure: string | null
          cree_le: string | null
          equipement_id: string
          est_formation: boolean
          id: string
          incident_id: string
          modifie_le: string | null
          ouvert_le: string | null
          ouvert_par_id: string
          q1: string | null
          q2: string | null
          q3: string | null
          q4: string | null
          q5: string | null
          statut: Database["public"]["Enums"]["statut_5_pourquoi"] | null
          type_action: Database["public"]["Enums"]["type_maintenance"] | null
          validee_le: string | null
          validee_par_id: string | null
        }
        Insert: {
          audit_90j_le?: string | null
          audit_resultat?: string | null
          cause_racine?: string | null
          contre_mesure?: string | null
          cree_le?: string | null
          equipement_id: string
          est_formation?: boolean
          id?: string
          incident_id: string
          modifie_le?: string | null
          ouvert_le?: string | null
          ouvert_par_id: string
          q1?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          statut?: Database["public"]["Enums"]["statut_5_pourquoi"] | null
          type_action?: Database["public"]["Enums"]["type_maintenance"] | null
          validee_le?: string | null
          validee_par_id?: string | null
        }
        Update: {
          audit_90j_le?: string | null
          audit_resultat?: string | null
          cause_racine?: string | null
          contre_mesure?: string | null
          cree_le?: string | null
          equipement_id?: string
          est_formation?: boolean
          id?: string
          incident_id?: string
          modifie_le?: string | null
          ouvert_le?: string | null
          ouvert_par_id?: string
          q1?: string | null
          q2?: string | null
          q3?: string | null
          q4?: string | null
          q5?: string | null
          statut?: Database["public"]["Enums"]["statut_5_pourquoi"] | null
          type_action?: Database["public"]["Enums"]["type_maintenance"] | null
          validee_le?: string | null
          validee_par_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiches_5_pourquoi_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiches_5_pourquoi_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "fiches_5_pourquoi_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "fiches_5_pourquoi_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures_lumiere: {
        Row: {
          adresse_dmx: number
          cree_le: string | null
          equipement_id: string
          fabricant: string | null
          id: string
          modele: string | null
          position_plan: Json | null
          puissance_w: number | null
          type_fixture: string | null
          univers_dmx: number
        }
        Insert: {
          adresse_dmx: number
          cree_le?: string | null
          equipement_id: string
          fabricant?: string | null
          id?: string
          modele?: string | null
          position_plan?: Json | null
          puissance_w?: number | null
          type_fixture?: string | null
          univers_dmx?: number
        }
        Update: {
          adresse_dmx?: number
          cree_le?: string | null
          equipement_id?: string
          fabricant?: string | null
          id?: string
          modele?: string | null
          position_plan?: Json | null
          puissance_w?: number | null
          type_fixture?: string | null
          univers_dmx?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_lumiere_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_lumiere_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "fixtures_lumiere_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          actif: boolean | null
          contact_email: string | null
          contact_nom: string | null
          contact_tel: string | null
          cree_le: string | null
          id: string
          metier_principal:
            | Database["public"]["Enums"]["metier_fournisseur"]
            | null
          metiers: Database["public"]["Enums"]["metier_fournisseur"][] | null
          nom: string
          notes: string | null
          numero_contrat: string | null
          sla_h: number | null
          type: string | null
        }
        Insert: {
          actif?: boolean | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          cree_le?: string | null
          id?: string
          metier_principal?:
            | Database["public"]["Enums"]["metier_fournisseur"]
            | null
          metiers?: Database["public"]["Enums"]["metier_fournisseur"][] | null
          nom: string
          notes?: string | null
          numero_contrat?: string | null
          sla_h?: number | null
          type?: string | null
        }
        Update: {
          actif?: boolean | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          cree_le?: string | null
          id?: string
          metier_principal?:
            | Database["public"]["Enums"]["metier_fournisseur"]
            | null
          metiers?: Database["public"]["Enums"]["metier_fournisseur"][] | null
          nom?: string
          notes?: string | null
          numero_contrat?: string | null
          sla_h?: number | null
          type?: string | null
        }
        Relationships: []
      }
      functions_security_policy: {
        Row: {
          comment: string | null
          expose_to_anon: boolean
          expose_to_authenticated: boolean
          function_args: string
          function_name: string
        }
        Insert: {
          comment?: string | null
          expose_to_anon?: boolean
          expose_to_authenticated?: boolean
          function_args: string
          function_name: string
        }
        Update: {
          comment?: string | null
          expose_to_anon?: boolean
          expose_to_authenticated?: boolean
          function_args?: string
          function_name?: string
        }
        Relationships: []
      }
      gps_positions: {
        Row: {
          capture_le: string | null
          id: string
          latitude: number
          longitude: number
          precision_m: number | null
          technicien_id: string
        }
        Insert: {
          capture_le?: string | null
          id?: string
          latitude: number
          longitude: number
          precision_m?: number | null
          technicien_id: string
        }
        Update: {
          capture_le?: string | null
          id?: string
          latitude?: number
          longitude?: number
          precision_m?: number | null
          technicien_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_positions_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_positions_technicien_id_fkey"
            columns: ["technicien_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      historique_decisions_ia: {
        Row: {
          action: string
          commentaire: string | null
          cree_le: string
          donnees_snapshot: Json
          hypothese_id: string
          id: string
          utilisateur_id: string
          utilisateur_nom: string
        }
        Insert: {
          action: string
          commentaire?: string | null
          cree_le?: string
          donnees_snapshot?: Json
          hypothese_id: string
          id?: string
          utilisateur_id: string
          utilisateur_nom?: string
        }
        Update: {
          action?: string
          commentaire?: string | null
          cree_le?: string
          donnees_snapshot?: Json
          hypothese_id?: string
          id?: string
          utilisateur_id?: string
          utilisateur_nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_decisions_ia_hypothese_id_fkey"
            columns: ["hypothese_id"]
            isOneToOne: false
            referencedRelation: "hypotheses_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_decisions_ia_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_decisions_ia_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      hypotheses_ia: {
        Row: {
          commentaire_validation: string | null
          cree_le: string
          description: string
          donnees: Json
          est_formation: boolean
          id: string
          priorite: string
          rapport_id: string
          resultat_commentaire: string | null
          resultat_evalue_le: string | null
          resultat_evalue_par_id: string | null
          resultat_reel: string | null
          statut: string
          titre: string
          type: string
          validee_le: string | null
          validee_par_id: string | null
        }
        Insert: {
          commentaire_validation?: string | null
          cree_le?: string
          description?: string
          donnees?: Json
          est_formation?: boolean
          id?: string
          priorite?: string
          rapport_id: string
          resultat_commentaire?: string | null
          resultat_evalue_le?: string | null
          resultat_evalue_par_id?: string | null
          resultat_reel?: string | null
          statut?: string
          titre: string
          type: string
          validee_le?: string | null
          validee_par_id?: string | null
        }
        Update: {
          commentaire_validation?: string | null
          cree_le?: string
          description?: string
          donnees?: Json
          est_formation?: boolean
          id?: string
          priorite?: string
          rapport_id?: string
          resultat_commentaire?: string | null
          resultat_evalue_le?: string | null
          resultat_evalue_par_id?: string | null
          resultat_reel?: string | null
          statut?: string
          titre?: string
          type?: string
          validee_le?: string | null
          validee_par_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hypotheses_ia_rapport_id_fkey"
            columns: ["rapport_id"]
            isOneToOne: false
            referencedRelation: "rapports_ia_hebdo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_ia_resultat_evalue_par_id_fkey"
            columns: ["resultat_evalue_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_ia_resultat_evalue_par_id_fkey"
            columns: ["resultat_evalue_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "hypotheses_ia_validee_par_id_fkey"
            columns: ["validee_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypotheses_ia_validee_par_id_fkey"
            columns: ["validee_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigne_a_id: string | null
          cree_le: string | null
          declare_le: string | null
          declare_par_id: string | null
          description: string | null
          echeance_sla: string | null
          equipement_id: string | null
          est_brouillon: boolean
          est_formation: boolean
          ferme_le: string | null
          id: string
          meta: Json | null
          modifie_le: string | null
          numero_bt: string
          pause_depuis: string | null
          pause_motif: string | null
          photos_urls: string[] | null
          priorite_id: string
          resolu_le: string | null
          resolu_par_id: string | null
          source: string | null
          statut: Database["public"]["Enums"]["statut_incident"]
          symptome: string | null
          titre: string
          type_maintenance: Database["public"]["Enums"]["type_maintenance"]
          validation_manager: string | null
          valide_le: string | null
          valide_par_manager_id: string | null
        }
        Insert: {
          assigne_a_id?: string | null
          cree_le?: string | null
          declare_le?: string | null
          declare_par_id?: string | null
          description?: string | null
          echeance_sla?: string | null
          equipement_id?: string | null
          est_brouillon?: boolean
          est_formation?: boolean
          ferme_le?: string | null
          id?: string
          meta?: Json | null
          modifie_le?: string | null
          numero_bt: string
          pause_depuis?: string | null
          pause_motif?: string | null
          photos_urls?: string[] | null
          priorite_id: string
          resolu_le?: string | null
          resolu_par_id?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["statut_incident"]
          symptome?: string | null
          titre: string
          type_maintenance?: Database["public"]["Enums"]["type_maintenance"]
          validation_manager?: string | null
          valide_le?: string | null
          valide_par_manager_id?: string | null
        }
        Update: {
          assigne_a_id?: string | null
          cree_le?: string | null
          declare_le?: string | null
          declare_par_id?: string | null
          description?: string | null
          echeance_sla?: string | null
          equipement_id?: string | null
          est_brouillon?: boolean
          est_formation?: boolean
          ferme_le?: string | null
          id?: string
          meta?: Json | null
          modifie_le?: string | null
          numero_bt?: string
          pause_depuis?: string | null
          pause_motif?: string | null
          photos_urls?: string[] | null
          priorite_id?: string
          resolu_le?: string | null
          resolu_par_id?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["statut_incident"]
          symptome?: string | null
          titre?: string
          type_maintenance?: Database["public"]["Enums"]["type_maintenance"]
          validation_manager?: string | null
          valide_le?: string | null
          valide_par_manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigne_a_id_fkey"
            columns: ["assigne_a_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigne_a_id_fkey"
            columns: ["assigne_a_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "incidents_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "incidents_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "incidents_priorite_id_fkey"
            columns: ["priorite_id"]
            isOneToOne: false
            referencedRelation: "niveaux_priorite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolu_par_id_fkey"
            columns: ["resolu_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolu_par_id_fkey"
            columns: ["resolu_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "incidents_valide_par_manager_id_fkey"
            columns: ["valide_par_manager_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_valide_par_manager_id_fkey"
            columns: ["valide_par_manager_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      interventions: {
        Row: {
          actions_realisees: string | null
          binome_id: string | null
          cree_le: string | null
          debut: string
          diagnostic: string | null
          est_formation: boolean
          fin: string | null
          id: string
          incident_id: string
          photos_apres: string[] | null
          photos_avant: string[] | null
          resolu_premier_coup: boolean | null
          signature_binome_url: string | null
          signature_url: string | null
          technicien_id: string
        }
        Insert: {
          actions_realisees?: string | null
          binome_id?: string | null
          cree_le?: string | null
          debut?: string
          diagnostic?: string | null
          est_formation?: boolean
          fin?: string | null
          id?: string
          incident_id: string
          photos_apres?: string[] | null
          photos_avant?: string[] | null
          resolu_premier_coup?: boolean | null
          signature_binome_url?: string | null
          signature_url?: string | null
          technicien_id: string
        }
        Update: {
          actions_realisees?: string | null
          binome_id?: string | null
          cree_le?: string | null
          debut?: string
          diagnostic?: string | null
          est_formation?: boolean
          fin?: string | null
          id?: string
          incident_id?: string
          photos_apres?: string[] | null
          photos_avant?: string[] | null
          resolu_premier_coup?: boolean | null
          signature_binome_url?: string | null
          signature_url?: string | null
          technicien_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          auth_mode: string
          email: string | null
          est_manager: boolean | null
          expire_le: string
          id: string
          invite_le: string | null
          invite_par_id: string
          nom: string | null
          notes: string | null
          parcs_assignes: string[] | null
          prenom: string | null
          role_id: string
          token: string
          utilisateur_cree_id: string | null
          utilise_le: string | null
        }
        Insert: {
          auth_mode: string
          email?: string | null
          est_manager?: boolean | null
          expire_le?: string
          id?: string
          invite_le?: string | null
          invite_par_id: string
          nom?: string | null
          notes?: string | null
          parcs_assignes?: string[] | null
          prenom?: string | null
          role_id: string
          token: string
          utilisateur_cree_id?: string | null
          utilise_le?: string | null
        }
        Update: {
          auth_mode?: string
          email?: string | null
          est_manager?: boolean | null
          expire_le?: string
          id?: string
          invite_le?: string | null
          invite_par_id?: string
          nom?: string | null
          notes?: string | null
          parcs_assignes?: string[] | null
          prenom?: string | null
          role_id?: string
          token?: string
          utilisateur_cree_id?: string | null
          utilise_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invite_par_id_fkey"
            columns: ["invite_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invite_par_id_fkey"
            columns: ["invite_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_utilisateur_cree_id_fkey"
            columns: ["utilisateur_cree_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_utilisateur_cree_id_fkey"
            columns: ["utilisateur_cree_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      maintenances_preventives: {
        Row: {
          actif: boolean | null
          cree_le: string | null
          derniere_execution: string | null
          description: string | null
          duree_min_estimee: number | null
          equipement_id: string
          est_formation: boolean
          fournisseur_id: string | null
          frequence_jours: number | null
          id: string
          libelle: string
          modifie_le: string | null
          prochaine_echeance: string
          type: Database["public"]["Enums"]["type_maintenance"]
        }
        Insert: {
          actif?: boolean | null
          cree_le?: string | null
          derniere_execution?: string | null
          description?: string | null
          duree_min_estimee?: number | null
          equipement_id: string
          est_formation?: boolean
          fournisseur_id?: string | null
          frequence_jours?: number | null
          id?: string
          libelle: string
          modifie_le?: string | null
          prochaine_echeance: string
          type?: Database["public"]["Enums"]["type_maintenance"]
        }
        Update: {
          actif?: boolean | null
          cree_le?: string | null
          derniere_execution?: string | null
          description?: string | null
          duree_min_estimee?: number | null
          equipement_id?: string
          est_formation?: boolean
          fournisseur_id?: string | null
          frequence_jours?: number | null
          id?: string
          libelle?: string
          modifie_le?: string | null
          prochaine_echeance?: string
          type?: Database["public"]["Enums"]["type_maintenance"]
        }
        Relationships: [
          {
            foreignKeyName: "maintenances_preventives_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenances_preventives_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "maintenances_preventives_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "maintenances_preventives_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      niveaux_priorite: {
        Row: {
          code: string
          couleur_hex: string
          id: string
          nom: string
          ordre: number
          sla_h: number
        }
        Insert: {
          code: string
          couleur_hex: string
          id?: string
          nom: string
          ordre: number
          sla_h: number
        }
        Update: {
          code?: string
          couleur_hex?: string
          id?: string
          nom?: string
          ordre?: number
          sla_h?: number
        }
        Relationships: []
      }
      notes_chantier: {
        Row: {
          categorie: Database["public"]["Enums"]["categorie_note_chantier"]
          contenu_md: string
          cree_le: string | null
          cree_par_id: string | null
          date_reunion: string
          decisions: string[] | null
          id: string
          modifie_le: string | null
          parc_id: string
          participants: string[] | null
          photo_url: string | null
          pieces_jointes: Json | null
          tags: string[] | null
          titre: string
        }
        Insert: {
          categorie?: Database["public"]["Enums"]["categorie_note_chantier"]
          contenu_md: string
          cree_le?: string | null
          cree_par_id?: string | null
          date_reunion: string
          decisions?: string[] | null
          id?: string
          modifie_le?: string | null
          parc_id: string
          participants?: string[] | null
          photo_url?: string | null
          pieces_jointes?: Json | null
          tags?: string[] | null
          titre: string
        }
        Update: {
          categorie?: Database["public"]["Enums"]["categorie_note_chantier"]
          contenu_md?: string
          cree_le?: string | null
          cree_par_id?: string | null
          date_reunion?: string
          decisions?: string[] | null
          id?: string
          modifie_le?: string | null
          parc_id?: string
          participants?: string[] | null
          photo_url?: string | null
          pieces_jointes?: Json | null
          tags?: string[] | null
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_chantier_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "notes_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notes_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notes_chantier_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      notifications_conformite: {
        Row: {
          commission_id: string | null
          cree_le: string | null
          destinataire_id: string
          email_envoye: boolean | null
          email_envoye_le: string | null
          id: string
          lu: boolean | null
          lu_le: string | null
          message: string | null
          parc_id: string | null
          prescription_id: string | null
          titre: string
          type_notification: string
        }
        Insert: {
          commission_id?: string | null
          cree_le?: string | null
          destinataire_id: string
          email_envoye?: boolean | null
          email_envoye_le?: string | null
          id?: string
          lu?: boolean | null
          lu_le?: string | null
          message?: string | null
          parc_id?: string | null
          prescription_id?: string | null
          titre: string
          type_notification: string
        }
        Update: {
          commission_id?: string | null
          cree_le?: string | null
          destinataire_id?: string
          email_envoye?: boolean | null
          email_envoye_le?: string | null
          id?: string
          lu?: boolean | null
          lu_le?: string | null
          message?: string | null
          parc_id?: string | null
          prescription_id?: string | null
          titre?: string
          type_notification?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conformite_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions_securite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conformite_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conformite_destinataire_id_fkey"
            columns: ["destinataire_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "notifications_conformite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conformite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_conformite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_conformite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_conformite_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions_securite"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_controle_manquant: {
        Row: {
          cree_le: string
          date_controle: string
          est_vacances: boolean
          heure_alerte: string
          heure_ouverture: string
          id: string
          parc_id: string
          sms_envoye: boolean
          type_alerte: string
        }
        Insert: {
          cree_le?: string
          date_controle?: string
          est_vacances?: boolean
          heure_alerte: string
          heure_ouverture: string
          id?: string
          parc_id: string
          sms_envoye?: boolean
          type_alerte: string
        }
        Update: {
          cree_le?: string
          date_controle?: string
          est_vacances?: boolean
          heure_alerte?: string
          heure_ouverture?: string
          id?: string
          parc_id?: string
          sms_envoye?: boolean
          type_alerte?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_controle_manquant_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_controle_manquant_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_controle_manquant_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_controle_manquant_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      notifications_interventions: {
        Row: {
          cree_le: string
          destinataire_role: string[]
          duree_minutes: number | null
          equipement_code: string | null
          id: string
          incident_id: string
          lien_page: string | null
          lue: boolean
          message: string
          parc_id: string
          technicien_nom: string | null
          titre: string
          type: string
        }
        Insert: {
          cree_le?: string
          destinataire_role?: string[]
          duree_minutes?: number | null
          equipement_code?: string | null
          id?: string
          incident_id: string
          lien_page?: string | null
          lue?: boolean
          message?: string
          parc_id: string
          technicien_nom?: string | null
          titre: string
          type?: string
        }
        Update: {
          cree_le?: string
          destinataire_role?: string[]
          duree_minutes?: number | null
          equipement_code?: string | null
          id?: string
          incident_id?: string
          lien_page?: string | null
          lue?: boolean
          message?: string
          parc_id?: string
          technicien_nom?: string | null
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_interventions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_interventions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_interventions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_interventions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "notifications_interventions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      parc_attendance: {
        Row: {
          attendances_count: number
          date_attendance: string
          heure_slot: number | null
          id: string
          meta: Json | null
          parc_id: string
          roller_attraction_code: string | null
          roller_catalogue_id: string | null
          synced_at: string
        }
        Insert: {
          attendances_count?: number
          date_attendance: string
          heure_slot?: number | null
          id?: string
          meta?: Json | null
          parc_id: string
          roller_attraction_code?: string | null
          roller_catalogue_id?: string | null
          synced_at?: string
        }
        Update: {
          attendances_count?: number
          date_attendance?: string
          heure_slot?: number | null
          id?: string
          meta?: Json | null
          parc_id?: string
          roller_attraction_code?: string | null
          roller_catalogue_id?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parc_attendance_attraction_id_fkey"
            columns: ["roller_catalogue_id"]
            isOneToOne: false
            referencedRelation: "roller_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_attendance_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_attendance_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_attendance_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_attendance_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      parc_attractions: {
        Row: {
          categorie_id: string
          id: string
          meta: Json | null
          parc_id: string
          quantite: number
        }
        Insert: {
          categorie_id: string
          id?: string
          meta?: Json | null
          parc_id: string
          quantite?: number
        }
        Update: {
          categorie_id?: string
          id?: string
          meta?: Json | null
          parc_id?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "parc_attractions_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_equipement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_attractions_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_categories_equipement_suggestions"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "parc_attractions_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "parc_attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      parc_points_actifs: {
        Row: {
          actif: boolean
          cree_le: string | null
          desactive_le: string | null
          desactive_par_id: string | null
          id: string
          modifie_le: string | null
          parc_id: string
          point_id: string
          raison: string | null
        }
        Insert: {
          actif?: boolean
          cree_le?: string | null
          desactive_le?: string | null
          desactive_par_id?: string | null
          id?: string
          modifie_le?: string | null
          parc_id: string
          point_id: string
          raison?: string | null
        }
        Update: {
          actif?: boolean
          cree_le?: string | null
          desactive_le?: string | null
          desactive_par_id?: string | null
          id?: string
          modifie_le?: string | null
          parc_id?: string
          point_id?: string
          raison?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parc_points_actifs_desactive_par_id_fkey"
            columns: ["desactive_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_points_actifs_desactive_par_id_fkey"
            columns: ["desactive_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "parc_points_actifs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_points_actifs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_points_actifs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_points_actifs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_points_actifs_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "bibliotheque_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_points_actifs_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["point_id"]
          },
        ]
      }
      parc_revenue: {
        Row: {
          booking_reference: string | null
          discount: number | null
          entry_type: string | null
          funds_received: number | null
          heure_slot: number | null
          id: string
          meta: Json | null
          net_revenue: number | null
          parc_id: string
          record_date: string
          roller_catalogue_id: string | null
          roller_entry_id: string | null
          roller_product_id: string | null
          synced_at: string
          tax_payable: number | null
          ticket_quantity: number | null
          transaction_value: number | null
        }
        Insert: {
          booking_reference?: string | null
          discount?: number | null
          entry_type?: string | null
          funds_received?: number | null
          heure_slot?: number | null
          id?: string
          meta?: Json | null
          net_revenue?: number | null
          parc_id: string
          record_date: string
          roller_catalogue_id?: string | null
          roller_entry_id?: string | null
          roller_product_id?: string | null
          synced_at?: string
          tax_payable?: number | null
          ticket_quantity?: number | null
          transaction_value?: number | null
        }
        Update: {
          booking_reference?: string | null
          discount?: number | null
          entry_type?: string | null
          funds_received?: number | null
          heure_slot?: number | null
          id?: string
          meta?: Json | null
          net_revenue?: number | null
          parc_id?: string
          record_date?: string
          roller_catalogue_id?: string | null
          roller_entry_id?: string | null
          roller_product_id?: string | null
          synced_at?: string
          tax_payable?: number | null
          ticket_quantity?: number | null
          transaction_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parc_revenue_attraction_id_fkey"
            columns: ["roller_catalogue_id"]
            isOneToOne: false
            referencedRelation: "roller_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_revenue_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parc_revenue_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_revenue_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parc_revenue_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      parcs: {
        Row: {
          actif: boolean | null
          adresse: string
          code: string
          code_postal: string
          cree_le: string | null
          date_mise_en_production: string | null
          en_production: boolean
          google_place_id: string | null
          horaires: Json | null
          id: string
          latitude: number
          longitude: number
          meta: Json | null
          mis_en_prod_par_id: string | null
          modifie_le: string | null
          nom: string
          ouvert_7j7: boolean | null
          roller_venue_code: string | null
          roller_venue_name: string | null
          surface_m2: number | null
          ville: string
        }
        Insert: {
          actif?: boolean | null
          adresse: string
          code: string
          code_postal: string
          cree_le?: string | null
          date_mise_en_production?: string | null
          en_production?: boolean
          google_place_id?: string | null
          horaires?: Json | null
          id?: string
          latitude: number
          longitude: number
          meta?: Json | null
          mis_en_prod_par_id?: string | null
          modifie_le?: string | null
          nom: string
          ouvert_7j7?: boolean | null
          roller_venue_code?: string | null
          roller_venue_name?: string | null
          surface_m2?: number | null
          ville: string
        }
        Update: {
          actif?: boolean | null
          adresse?: string
          code?: string
          code_postal?: string
          cree_le?: string | null
          date_mise_en_production?: string | null
          en_production?: boolean
          google_place_id?: string | null
          horaires?: Json | null
          id?: string
          latitude?: number
          longitude?: number
          meta?: Json | null
          mis_en_prod_par_id?: string | null
          modifie_le?: string | null
          nom?: string
          ouvert_7j7?: boolean | null
          roller_venue_code?: string | null
          roller_venue_name?: string | null
          surface_m2?: number | null
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcs_mis_en_prod_par_id_fkey"
            columns: ["mis_en_prod_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_mis_en_prod_par_id_fkey"
            columns: ["mis_en_prod_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      parcs_phases: {
        Row: {
          cree_le: string | null
          cree_par_id: string | null
          date_debut: string
          date_fin: string | null
          date_prevu: string | null
          id: string
          modifie_le: string | null
          modifie_par_id: string | null
          notes: string | null
          parc_id: string
          phase: string
        }
        Insert: {
          cree_le?: string | null
          cree_par_id?: string | null
          date_debut?: string
          date_fin?: string | null
          date_prevu?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          notes?: string | null
          parc_id: string
          phase: string
        }
        Update: {
          cree_le?: string | null
          cree_par_id?: string | null
          date_debut?: string
          date_fin?: string | null
          date_prevu?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          notes?: string | null
          parc_id?: string
          phase?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcs_phases_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_phases_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "parcs_phases_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_phases_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      parcs_utilisateurs: {
        Row: {
          cree_le: string | null
          est_manager: boolean | null
          id: string
          parc_id: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string | null
          est_manager?: boolean | null
          id?: string
          parc_id: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string | null
          est_manager?: boolean | null
          id?: string
          parc_id?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcs_utilisateurs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_utilisateurs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_utilisateurs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_utilisateurs_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_utilisateurs_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_utilisateurs_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      pieces_detachees: {
        Row: {
          cree_le: string | null
          delai_reappro_jours: number | null
          description: string | null
          emplacement: string | null
          est_formation: boolean
          fournisseur_id: string | null
          id: string
          modifie_le: string | null
          nom: string
          prix_unitaire_ht: number | null
          reference: string
          stock_actuel: number
          stock_min: number
        }
        Insert: {
          cree_le?: string | null
          delai_reappro_jours?: number | null
          description?: string | null
          emplacement?: string | null
          est_formation?: boolean
          fournisseur_id?: string | null
          id?: string
          modifie_le?: string | null
          nom: string
          prix_unitaire_ht?: number | null
          reference: string
          stock_actuel?: number
          stock_min?: number
        }
        Update: {
          cree_le?: string | null
          delai_reappro_jours?: number | null
          description?: string | null
          emplacement?: string | null
          est_formation?: boolean
          fournisseur_id?: string | null
          id?: string
          modifie_le?: string | null
          nom?: string
          prix_unitaire_ht?: number | null
          reference?: string
          stock_actuel?: number
          stock_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "pieces_detachees_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces_utilisees: {
        Row: {
          cree_le: string | null
          id: string
          intervention_id: string
          piece_id: string
          quantite: number
        }
        Insert: {
          cree_le?: string | null
          id?: string
          intervention_id: string
          piece_id: string
          quantite: number
        }
        Update: {
          cree_le?: string | null
          id?: string
          intervention_id?: string
          piece_id?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "pieces_utilisees_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pieces_utilisees_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces_detachees"
            referencedColumns: ["id"]
          },
        ]
      }
      plaintes_clients: {
        Row: {
          canal: string | null
          categorie: string | null
          client_email: string | null
          client_nom: string | null
          client_telephone: string | null
          commentaire: string | null
          cree_le: string | null
          date_visite: string | null
          declare_le: string | null
          equipement_id: string | null
          est_formation: boolean
          id: string
          incident_cree_id: string | null
          motif_qualification: string | null
          note_globale: number | null
          parc_id: string
          photo_url: string | null
          priorite: string | null
          qualifie_le: string | null
          qualifie_par_id: string | null
          saisi_par_id: string | null
          source: string | null
          source_externe_id: string | null
          statut: string | null
          ticket_genere_id: string | null
        }
        Insert: {
          canal?: string | null
          categorie?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commentaire?: string | null
          cree_le?: string | null
          date_visite?: string | null
          declare_le?: string | null
          equipement_id?: string | null
          est_formation?: boolean
          id?: string
          incident_cree_id?: string | null
          motif_qualification?: string | null
          note_globale?: number | null
          parc_id: string
          photo_url?: string | null
          priorite?: string | null
          qualifie_le?: string | null
          qualifie_par_id?: string | null
          saisi_par_id?: string | null
          source?: string | null
          source_externe_id?: string | null
          statut?: string | null
          ticket_genere_id?: string | null
        }
        Update: {
          canal?: string | null
          categorie?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commentaire?: string | null
          cree_le?: string | null
          date_visite?: string | null
          declare_le?: string | null
          equipement_id?: string | null
          est_formation?: boolean
          id?: string
          incident_cree_id?: string | null
          motif_qualification?: string | null
          note_globale?: number | null
          parc_id?: string
          photo_url?: string | null
          priorite?: string | null
          qualifie_le?: string | null
          qualifie_par_id?: string | null
          saisi_par_id?: string | null
          source?: string | null
          source_externe_id?: string | null
          statut?: string | null
          ticket_genere_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaintes_clients_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaintes_clients_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "v_equipement_contexte_roller"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "plaintes_clients_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["equipement_id"]
          },
          {
            foreignKeyName: "plaintes_clients_incident_cree_id_fkey"
            columns: ["incident_cree_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "plaintes_clients_qualifie_par_id_fkey"
            columns: ["qualifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaintes_clients_qualifie_par_id_fkey"
            columns: ["qualifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "plaintes_clients_ticket_genere_id_fkey"
            columns: ["ticket_genere_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions_securite: {
        Row: {
          categorie: string
          commission_id: string
          confiance_extraction: number | null
          cout_estime: number | null
          cout_reel: number | null
          cree_le: string | null
          cree_par_id: string | null
          date_levee_effective: string | null
          delai_levee: string | null
          description: string | null
          extraction_id: string | null
          extrait_par_ia: boolean | null
          gravite: string
          id: string
          intitule: string
          modifie_le: string | null
          modifie_par_id: string | null
          numero_prescription: string | null
          parc_id: string
          photo_url: string | null
          preuve_levee_notes: string | null
          preuve_levee_url: string | null
          reglement_applicable: string | null
          responsable_id: string | null
          statut: string
          validee_par_commission_id: string | null
        }
        Insert: {
          categorie: string
          commission_id: string
          confiance_extraction?: number | null
          cout_estime?: number | null
          cout_reel?: number | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_levee_effective?: string | null
          delai_levee?: string | null
          description?: string | null
          extraction_id?: string | null
          extrait_par_ia?: boolean | null
          gravite: string
          id?: string
          intitule: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          numero_prescription?: string | null
          parc_id: string
          photo_url?: string | null
          preuve_levee_notes?: string | null
          preuve_levee_url?: string | null
          reglement_applicable?: string | null
          responsable_id?: string | null
          statut?: string
          validee_par_commission_id?: string | null
        }
        Update: {
          categorie?: string
          commission_id?: string
          confiance_extraction?: number | null
          cout_estime?: number | null
          cout_reel?: number | null
          cree_le?: string | null
          cree_par_id?: string | null
          date_levee_effective?: string | null
          delai_levee?: string | null
          description?: string | null
          extraction_id?: string | null
          extrait_par_ia?: boolean | null
          gravite?: string
          id?: string
          intitule?: string
          modifie_le?: string | null
          modifie_par_id?: string | null
          numero_prescription?: string | null
          parc_id?: string
          photo_url?: string | null
          preuve_levee_notes?: string | null
          preuve_levee_url?: string | null
          reglement_applicable?: string | null
          responsable_id?: string | null
          statut?: string
          validee_par_commission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_securite_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions_securite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_securite_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_securite_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_securite_modifie_par_id_fkey"
            columns: ["modifie_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_securite_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "prescriptions_securite_validee_par_commission_id_fkey"
            columns: ["validee_par_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions_securite"
            referencedColumns: ["id"]
          },
        ]
      }
      rapports_ia_hebdo: {
        Row: {
          cree_le: string
          donnees_analyse: Json
          est_formation: boolean
          genere_le: string
          id: string
          score_sante: number
          semaine_iso: string
          tendance: string
        }
        Insert: {
          cree_le?: string
          donnees_analyse?: Json
          est_formation?: boolean
          genere_le?: string
          id?: string
          score_sante?: number
          semaine_iso: string
          tendance?: string
        }
        Update: {
          cree_le?: string
          donnees_analyse?: Json
          est_formation?: boolean
          genere_le?: string
          id?: string
          score_sante?: number
          semaine_iso?: string
          tendance?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          code: Database["public"]["Enums"]["role_utilisateur"]
          id: string
          nom: string
          ordre: number
          permissions: Json | null
        }
        Insert: {
          code: Database["public"]["Enums"]["role_utilisateur"]
          id?: string
          nom: string
          ordre: number
          permissions?: Json | null
        }
        Update: {
          code?: Database["public"]["Enums"]["role_utilisateur"]
          id?: string
          nom?: string
          ordre?: number
          permissions?: Json | null
        }
        Relationships: []
      }
      roller_catalogue: {
        Row: {
          a_surveiller: boolean
          capacite_simultanee: number | null
          code: string
          cree_le: string
          date_mise_service: string | null
          duree_moyenne_minutes: number | null
          est_formation: boolean
          fournisseur_id: string | null
          id: string
          libelle: string
          marque: string | null
          meta: Json | null
          modele: string | null
          modifie_le: string
          nb_sous_unites: number | null
          numero_serie: string | null
          parc_id: string
          photo_url: string | null
          roller_default_price: number | null
          roller_product_id: string | null
          roller_product_subtype: string | null
          roller_product_type: string | null
          source: string | null
          statut: string
          type_attraction: string | null
          zone_id: string | null
        }
        Insert: {
          a_surveiller?: boolean
          capacite_simultanee?: number | null
          code: string
          cree_le?: string
          date_mise_service?: string | null
          duree_moyenne_minutes?: number | null
          est_formation?: boolean
          fournisseur_id?: string | null
          id?: string
          libelle: string
          marque?: string | null
          meta?: Json | null
          modele?: string | null
          modifie_le?: string
          nb_sous_unites?: number | null
          numero_serie?: string | null
          parc_id: string
          photo_url?: string | null
          roller_default_price?: number | null
          roller_product_id?: string | null
          roller_product_subtype?: string | null
          roller_product_type?: string | null
          source?: string | null
          statut?: string
          type_attraction?: string | null
          zone_id?: string | null
        }
        Update: {
          a_surveiller?: boolean
          capacite_simultanee?: number | null
          code?: string
          cree_le?: string
          date_mise_service?: string | null
          duree_moyenne_minutes?: number | null
          est_formation?: boolean
          fournisseur_id?: string | null
          id?: string
          libelle?: string
          marque?: string | null
          meta?: Json | null
          modele?: string | null
          modifie_le?: string
          nb_sous_unites?: number | null
          numero_serie?: string | null
          parc_id?: string
          photo_url?: string | null
          roller_default_price?: number | null
          roller_product_id?: string | null
          roller_product_subtype?: string | null
          roller_product_type?: string | null
          source?: string | null
          statut?: string
          type_attraction?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attractions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "attractions_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "attractions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      roller_role_mapping: {
        Row: {
          cree_le: string | null
          role_code: Database["public"]["Enums"]["role_utilisateur"]
          roller_role_name: string
        }
        Insert: {
          cree_le?: string | null
          role_code: Database["public"]["Enums"]["role_utilisateur"]
          roller_role_name: string
        }
        Update: {
          cree_le?: string | null
          role_code?: Database["public"]["Enums"]["role_utilisateur"]
          roller_role_name?: string
        }
        Relationships: []
      }
      roller_sync_log: {
        Row: {
          end_date: string | null
          endpoint: string
          error_message: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          items_inserted: number | null
          items_received: number | null
          items_skipped: number | null
          items_updated: number | null
          meta: Json | null
          start_date: string | null
          started_at: string
          status: string
          sync_type: string
          venue_code: string
        }
        Insert: {
          end_date?: string | null
          endpoint: string
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          items_inserted?: number | null
          items_received?: number | null
          items_skipped?: number | null
          items_updated?: number | null
          meta?: Json | null
          start_date?: string | null
          started_at?: string
          status?: string
          sync_type: string
          venue_code: string
        }
        Update: {
          end_date?: string | null
          endpoint?: string
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          items_inserted?: number | null
          items_received?: number | null
          items_skipped?: number | null
          items_updated?: number | null
          meta?: Json | null
          start_date?: string | null
          started_at?: string
          status?: string
          sync_type?: string
          venue_code?: string
        }
        Relationships: []
      }
      roller_tokens: {
        Row: {
          access_token: string
          expires_at: string
          updated_at: string
          venue_code: string
        }
        Insert: {
          access_token: string
          expires_at: string
          updated_at?: string
          venue_code: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          updated_at?: string
          venue_code?: string
        }
        Relationships: []
      }
      standards_evolutifs: {
        Row: {
          ancien_assigne_a: string | null
          ancien_libelle: string | null
          fiche_5pq_id: string | null
          id: string
          modifie_le: string | null
          modifie_par_id: string
          motif: string | null
          nouveau_assigne_a: string | null
          nouveau_libelle: string
          point_id: string
        }
        Insert: {
          ancien_assigne_a?: string | null
          ancien_libelle?: string | null
          fiche_5pq_id?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id: string
          motif?: string | null
          nouveau_assigne_a?: string | null
          nouveau_libelle: string
          point_id: string
        }
        Update: {
          ancien_assigne_a?: string | null
          ancien_libelle?: string | null
          fiche_5pq_id?: string | null
          id?: string
          modifie_le?: string | null
          modifie_par_id?: string
          motif?: string | null
          nouveau_assigne_a?: string | null
          nouveau_libelle?: string
          point_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_evolutifs_fiche_5pq_id_fkey"
            columns: ["fiche_5pq_id"]
            isOneToOne: false
            referencedRelation: "fiches_5_pourquoi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standards_evolutifs_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "bibliotheque_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standards_evolutifs_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["point_id"]
          },
        ]
      }
      symptomes: {
        Row: {
          actif: boolean | null
          categorie_id: string
          cree_le: string | null
          icone: string | null
          id: string
          libelle: string
          ordre: number | null
        }
        Insert: {
          actif?: boolean | null
          categorie_id: string
          cree_le?: string | null
          icone?: string | null
          id?: string
          libelle: string
          ordre?: number | null
        }
        Update: {
          actif?: boolean | null
          categorie_id?: string
          cree_le?: string | null
          icone?: string | null
          id?: string
          libelle?: string
          ordre?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "symptomes_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_equipement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptomes_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_categories_equipement_suggestions"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "symptomes_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["categorie_id"]
          },
        ]
      }
      trackers_sync_log: {
        Row: {
          demarre_le: string
          duree_ms: number | null
          http_status: number | null
          id: string
          message_erreur: string | null
          nb_positions: number | null
          nb_trackers: number | null
          payload_debug: Json | null
          provider: string
          statut: string
          termine_le: string | null
          type_sync: string
        }
        Insert: {
          demarre_le?: string
          duree_ms?: number | null
          http_status?: number | null
          id?: string
          message_erreur?: string | null
          nb_positions?: number | null
          nb_trackers?: number | null
          payload_debug?: Json | null
          provider?: string
          statut: string
          termine_le?: string | null
          type_sync: string
        }
        Update: {
          demarre_le?: string
          duree_ms?: number | null
          http_status?: number | null
          id?: string
          message_erreur?: string | null
          nb_positions?: number | null
          nb_trackers?: number | null
          payload_debug?: Json | null
          provider?: string
          statut?: string
          termine_le?: string | null
          type_sync?: string
        }
        Relationships: []
      }
      user_role_cache: {
        Row: {
          auth_user_id: string
          role_code: Database["public"]["Enums"]["role_utilisateur"]
          utilisateur_id: string | null
        }
        Insert: {
          auth_user_id: string
          role_code: Database["public"]["Enums"]["role_utilisateur"]
          utilisateur_id?: string | null
        }
        Update: {
          auth_user_id?: string
          role_code?: Database["public"]["Enums"]["role_utilisateur"]
          utilisateur_id?: string | null
        }
        Relationships: []
      }
      utilisateurs: {
        Row: {
          actif: boolean | null
          auth_mode: string | null
          auth_user_id: string | null
          code_pin_genere_le: string | null
          code_pin_hash: string | null
          consentement_gps: boolean | null
          consentement_gps_le: string | null
          cree_le: string | null
          email: string | null
          id: string
          last_synced_at: string | null
          modifie_le: string | null
          nom: string
          photo_url: string | null
          pin_failed_attempts: number
          pin_locked_until: string | null
          pin_must_change: boolean | null
          prenom: string
          role_id: string
          roller_unique_id: string | null
          statut_validation: string | null
          telephone: string | null
          tour_vu: boolean | null
          trigramme: string | null
          valide_le: string | null
          valide_par_id: string | null
        }
        Insert: {
          actif?: boolean | null
          auth_mode?: string | null
          auth_user_id?: string | null
          code_pin_genere_le?: string | null
          code_pin_hash?: string | null
          consentement_gps?: boolean | null
          consentement_gps_le?: string | null
          cree_le?: string | null
          email?: string | null
          id?: string
          last_synced_at?: string | null
          modifie_le?: string | null
          nom: string
          photo_url?: string | null
          pin_failed_attempts?: number
          pin_locked_until?: string | null
          pin_must_change?: boolean | null
          prenom: string
          role_id: string
          roller_unique_id?: string | null
          statut_validation?: string | null
          telephone?: string | null
          tour_vu?: boolean | null
          trigramme?: string | null
          valide_le?: string | null
          valide_par_id?: string | null
        }
        Update: {
          actif?: boolean | null
          auth_mode?: string | null
          auth_user_id?: string | null
          code_pin_genere_le?: string | null
          code_pin_hash?: string | null
          consentement_gps?: boolean | null
          consentement_gps_le?: string | null
          cree_le?: string | null
          email?: string | null
          id?: string
          last_synced_at?: string | null
          modifie_le?: string | null
          nom?: string
          photo_url?: string | null
          pin_failed_attempts?: number
          pin_locked_until?: string | null
          pin_must_change?: boolean | null
          prenom?: string
          role_id?: string
          roller_unique_id?: string | null
          statut_validation?: string | null
          telephone?: string | null
          tour_vu?: boolean | null
          trigramme?: string | null
          valide_le?: string | null
          valide_par_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utilisateurs_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utilisateurs_valide_par_id_fkey"
            columns: ["valide_par_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utilisateurs_valide_par_id_fkey"
            columns: ["valide_par_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      vehicules: {
        Row: {
          assigne_a_id: string | null
          code: string
          cree_le: string | null
          date_derniere_revision: string | null
          date_prochaine_revision: string | null
          id: string
          immatriculation: string | null
          km_actuel: number | null
          libelle: string
          marque: string | null
          modele: string | null
          modifie_le: string | null
          parc_id: string | null
          photo_url: string | null
          statut: string | null
          tracker_id: string | null
          tracker_type: string | null
        }
        Insert: {
          assigne_a_id?: string | null
          code: string
          cree_le?: string | null
          date_derniere_revision?: string | null
          date_prochaine_revision?: string | null
          id?: string
          immatriculation?: string | null
          km_actuel?: number | null
          libelle: string
          marque?: string | null
          modele?: string | null
          modifie_le?: string | null
          parc_id?: string | null
          photo_url?: string | null
          statut?: string | null
          tracker_id?: string | null
          tracker_type?: string | null
        }
        Update: {
          assigne_a_id?: string | null
          code?: string
          cree_le?: string | null
          date_derniere_revision?: string | null
          date_prochaine_revision?: string | null
          id?: string
          immatriculation?: string | null
          km_actuel?: number | null
          libelle?: string
          marque?: string | null
          modele?: string | null
          modifie_le?: string | null
          parc_id?: string | null
          photo_url?: string | null
          statut?: string | null
          tracker_id?: string | null
          tracker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicules_assigne_a_id_fkey"
            columns: ["assigne_a_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_assigne_a_id_fkey"
            columns: ["assigne_a_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
          {
            foreignKeyName: "vehicules_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "vehicules_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "vehicules_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vehicules_positions: {
        Row: {
          adresse: string | null
          altitude: number | null
          batterie_tracker: number | null
          cap: number | null
          enregistre_le: string | null
          id: string
          latitude: number
          longitude: number
          moteur_allume: boolean | null
          vehicule_id: string
          vitesse: number | null
        }
        Insert: {
          adresse?: string | null
          altitude?: number | null
          batterie_tracker?: number | null
          cap?: number | null
          enregistre_le?: string | null
          id?: string
          latitude: number
          longitude: number
          moteur_allume?: boolean | null
          vehicule_id: string
          vitesse?: number | null
        }
        Update: {
          adresse?: string | null
          altitude?: number | null
          batterie_tracker?: number | null
          cap?: number | null
          enregistre_le?: string | null
          id?: string
          latitude?: number
          longitude?: number
          moteur_allume?: boolean | null
          vehicule_id?: string
          vitesse?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicules_positions_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          email: string | null
          expire_le: string
          id: string
          type: string
          utilisateur_id: string | null
          utilise: boolean
        }
        Insert: {
          challenge: string
          email?: string | null
          expire_le?: string
          id?: string
          type: string
          utilisateur_id?: string | null
          utilise?: boolean
        }
        Update: {
          challenge?: string
          email?: string | null
          expire_le?: string
          id?: string
          type?: string
          utilisateur_id?: string | null
          utilise?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webauthn_challenges_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          actif: boolean
          counter: number
          credential_id: string
          cree_le: string
          derniere_utilisation: string | null
          device_name: string
          id: string
          public_key: string
          transports: string[] | null
          utilisateur_id: string
        }
        Insert: {
          actif?: boolean
          counter?: number
          credential_id: string
          cree_le?: string
          derniere_utilisation?: string | null
          device_name?: string
          id?: string
          public_key: string
          transports?: string[] | null
          utilisateur_id: string
        }
        Update: {
          actif?: boolean
          counter?: number
          credential_id?: string
          cree_le?: string
          derniere_utilisation?: string | null
          device_name?: string
          id?: string
          public_key?: string
          transports?: string[] | null
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webauthn_credentials_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "vue_perf_technicien_30j"
            referencedColumns: ["technicien_id"]
          },
        ]
      }
      zones: {
        Row: {
          coordonnees_plan: Json | null
          cree_le: string | null
          id: string
          nom: string
          ordre: number
          parc_id: string
        }
        Insert: {
          coordonnees_plan?: Json | null
          cree_le?: string | null
          id?: string
          nom: string
          ordre: number
          parc_id: string
        }
        Update: {
          coordonnees_plan?: Json | null
          cree_le?: string | null
          id?: string
          nom?: string
          ordre?: number
          parc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "zones_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "zones_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
    }
    Views: {
      v_categories_equipement_suggestions: {
        Row: {
          categorie_id: string | null
          categorie_nom: string | null
          nb_equipements_existants: number | null
          types_attraction_utilises: string[] | null
        }
        Relationships: []
      }
      v_equipement_contexte_roller: {
        Row: {
          ca_moyen_jour_30j: number | null
          equipement_code: string | null
          equipement_id: string | null
          equipement_libelle: string | null
          frequentation_moyenne_jour_30j: number | null
          parc_code: string | null
          parc_id: string | null
          roller_venue_code: string | null
          type_attraction: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      v_parcs_phase_actuelle: {
        Row: {
          date_debut: string | null
          date_fin: string | null
          date_prevu: string | null
          parc_id: string | null
          phase: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "parcs_phases_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      v_points_applicables_par_parc: {
        Row: {
          actif_pour_parc: boolean | null
          assigne_a: string | null
          bloquant: boolean | null
          categorie_id: string | null
          categorie_nom: string | null
          ordre: number | null
          parc_code: string | null
          parc_id: string | null
          parc_nom: string | null
          photo_obligatoire: boolean | null
          point_id: string | null
          point_libelle: string | null
          type_controle: Database["public"]["Enums"]["type_controle"] | null
        }
        Relationships: []
      }
      v_roller_cron_status: {
        Row: {
          active: boolean | null
          jobname: string | null
          last_run: string | null
          last_status: string | null
          runs_7j: number | null
          schedule: string | null
          success_7j: number | null
        }
        Insert: {
          active?: boolean | null
          jobname?: string | null
          last_run?: never
          last_status?: never
          runs_7j?: never
          schedule?: string | null
          success_7j?: never
        }
        Update: {
          active?: boolean | null
          jobname?: string | null
          last_run?: never
          last_status?: never
          runs_7j?: never
          schedule?: string | null
          success_7j?: never
        }
        Relationships: []
      }
      v_vehicules_dernieres_positions: {
        Row: {
          adresse: string | null
          altitude: number | null
          batterie_tracker: number | null
          cap: number | null
          enregistre_le: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          moteur_allume: boolean | null
          vehicule_id: string | null
          vitesse: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicules_positions_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_avancement_hebdo: {
        Row: {
          avancement_pct: number | null
          controle_id: string | null
          est_formation: boolean | null
          items_alerte: number | null
          items_ok: number | null
          items_saisis: number | null
          parc_id: string | null
          parc_nom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "controles_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vue_kpi_mtbf: {
        Row: {
          est_formation: boolean | null
          mtbf_jours: number | null
          parc_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vue_kpi_mttr: {
        Row: {
          est_formation: boolean | null
          mttr_minutes: number | null
          parc_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vue_kpi_performance: {
        Row: {
          est_formation: boolean | null
          parc_id: string | null
          parc_nom: string | null
          performance_pct: number | null
        }
        Relationships: []
      }
      vue_kpi_plaintes: {
        Row: {
          est_formation: boolean | null
          parc_id: string | null
          plaintes_7j: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "plaintes_clients_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vue_kpi_premier_coup: {
        Row: {
          est_formation: boolean | null
          parc_id: string | null
          premier_coup_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "parcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "v_points_applicables_par_parc"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_kpi_performance"
            referencedColumns: ["parc_id"]
          },
          {
            foreignKeyName: "equipements_parc_id_fkey"
            columns: ["parc_id"]
            isOneToOne: false
            referencedRelation: "vue_recurrences_actives"
            referencedColumns: ["parc_id"]
          },
        ]
      }
      vue_perf_technicien_30j: {
        Row: {
          bt_clos: number | null
          est_formation: boolean | null
          mttr_minutes_perso: number | null
          nom: string | null
          pieces_utilisees: number | null
          premier_coup_pct: number | null
          prenom: string | null
          technicien_id: string | null
          trigramme: string | null
        }
        Relationships: []
      }
      vue_recurrences_actives: {
        Row: {
          a_5_pourquoi: boolean | null
          a_surveiller: boolean | null
          code: string | null
          equipement_id: string | null
          est_formation: boolean | null
          libelle: string | null
          pannes_30j: number | null
          pannes_90j: number | null
          parc_id: string | null
          parc_nom: string | null
          plaintes_7j: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accepter_invitation: {
        Args: {
          p_auth_user_id?: string
          p_nom?: string
          p_photo_url?: string
          p_pin_clair?: string
          p_prenom?: string
          p_telephone?: string
          p_token: string
        }
        Returns: string
      }
      apply_function_security_policy: { Args: never; Returns: undefined }
      call_roller_sync: { Args: { function_name: string }; Returns: number }
      current_parc_ids: { Args: never; Returns: string[] }
      current_role_code: {
        Args: never
        Returns: Database["public"]["Enums"]["role_utilisateur"]
      }
      current_utilisateur_id: { Args: never; Returns: string }
      enregistrer_device: {
        Args: {
          p_device_hash: string
          p_navigateur: string
          p_nom_device: string
        }
        Returns: undefined
      }
      fn_destinataires_conformite: {
        Args: { p_parc_id: string }
        Returns: string[]
      }
      generer_controle_par_type: {
        Args: {
          p_date?: string
          p_parc_id: string
          p_type: Database["public"]["Enums"]["type_controle"]
        }
        Returns: string
      }
      generer_controle_quotidien: {
        Args: { p_date?: string; p_parc_id: string }
        Returns: string
      }
      generer_tous_controles_hebdo: {
        Args: { p_date?: string }
        Returns: {
          controle_id: string
          nb_points: number
          parc_code: string
        }[]
      }
      generer_tous_controles_mensuel: {
        Args: { p_date?: string }
        Returns: {
          controle_id: string
          nb_points: number
          parc_code: string
        }[]
      }
      generer_tous_controles_quotidiens: {
        Args: { p_date?: string }
        Returns: {
          controle_id: string
          nb_points: number
          parc_code: string
        }[]
      }
      get_parc_by_roller_venue: {
        Args: { p_venue_code: string }
        Returns: string
      }
      hash_and_set_pin: {
        Args: { p_pin_clair: string; p_utilisateur_id: string }
        Returns: undefined
      }
      is_parc_en_production: { Args: { p_parc_id: string }; Returns: boolean }
      mettre_en_pause_incident: {
        Args: { p_incident_id: string; p_motif?: string }
        Returns: undefined
      }
      modifier_utilisateur: {
        Args: {
          p_actif?: boolean
          p_est_manager?: boolean
          p_parc_ids: string[]
          p_role_id: string
          p_utilisateur_id: string
        }
        Returns: undefined
      }
      rafraichir_device: { Args: { p_device_hash: string }; Returns: undefined }
      reassigner_incident: {
        Args: { p_incident_id: string; p_nouveau_technicien_id: string }
        Returns: undefined
      }
      reprendre_incident: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
      saisir_point_controle: {
        Args: {
          p_commentaire?: string
          p_controle_id: string
          p_equipement_id?: string
          p_etat: Database["public"]["Enums"]["etat_controle_item"]
          p_photo_url?: string
          p_point_id: string
          p_saisi_par_id?: string
        }
        Returns: Json
      }
      set_pin_hash: {
        Args: { p_pin_clair: string; p_utilisateur_id: string }
        Returns: undefined
      }
      supprimer_devices_utilisateur_courant: { Args: never; Returns: undefined }
      valider_brouillon_incident: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
      valider_controle: {
        Args: {
          p_controle_id: string
          p_force?: boolean
          p_signature_ip?: string
          p_signature_url?: string
          p_signature_user_agent?: string
          p_valide_par_id: string
        }
        Returns: Json
      }
      valider_controle_staff: {
        Args: {
          p_date_planifiee: string
          p_items: Json
          p_parc_id: string
          p_realise_par_id: string
          p_realise_par_nom: string
          p_realise_par_role: string
          p_type: string
        }
        Returns: string
      }
      verifier_code_2fa: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
      verifier_device_reconnu: {
        Args: { p_device_hash: string; p_email: string }
        Returns: boolean
      }
      verifier_pin_staff: {
        Args: { p_parc_code: string; p_pin: string }
        Returns: {
          is_locked: boolean
          lock_remaining_seconds: number
          nom: string
          pin_must_change: boolean
          prenom: string
          role_code: Database["public"]["Enums"]["role_utilisateur"]
          trigramme: string
          utilisateur_id: string
        }[]
      }
    }
    Enums: {
      categorie_note_chantier:
        | "chantier_initial"
        | "travaux"
        | "audit"
        | "reunion_fournisseur"
        | "reglementaire"
        | "autre"
      etat_controle_item: "non_saisi" | "ok" | "degrade" | "hs"
      metier_fournisseur:
        | "plomberie"
        | "electricite"
        | "cvc_climatisation"
        | "maconnerie"
        | "menuiserie"
        | "vitrerie"
        | "serrurerie"
        | "ascenseur"
        | "securite_incendie"
        | "nettoyage"
        | "peinture"
        | "sol_revetement"
        | "karting"
        | "trampoline"
        | "bowling"
        | "arcade_jeux"
        | "laser_game"
        | "realite_virtuelle"
        | "multi_metiers"
        | "autre"
        | "ascenseur_escalateur"
        | "attractions_manages"
        | "gonflables"
        | "lumieres"
        | "ssi"
        | "sprinkler_ria"
        | "desenfumage_toiture"
        | "flocage_acoustique"
        | "courant_faible"
        | "cuisiniste"
        | "agencement"
        | "boissons_pression"
      role_utilisateur:
        | "direction"
        | "chef_maintenance"
        | "directeur_parc"
        | "manager_parc"
        | "technicien"
        | "staff_operationnel"
        | "admin_it"
      statut_5_pourquoi: "ouvert" | "valide" | "audit_en_cours" | "clos"
      statut_controle: "a_faire" | "en_cours" | "valide" | "echec" | "remplace"
      statut_incident:
        | "ouvert"
        | "assigne"
        | "en_cours"
        | "en_pause"
        | "resolu"
        | "ferme"
        | "annule"
      type_controle: "quotidien" | "hebdo" | "mensuel"
      type_maintenance:
        | "preventif_systematique"
        | "preventif_conditionnel"
        | "preventif_previsionnel"
        | "correctif_palliatif"
        | "correctif_curatif"
        | "reglementaire"
        | "amelioration"
        | "travaux_neufs"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      categorie_note_chantier: [
        "chantier_initial",
        "travaux",
        "audit",
        "reunion_fournisseur",
        "reglementaire",
        "autre",
      ],
      etat_controle_item: ["non_saisi", "ok", "degrade", "hs"],
      metier_fournisseur: [
        "plomberie",
        "electricite",
        "cvc_climatisation",
        "maconnerie",
        "menuiserie",
        "vitrerie",
        "serrurerie",
        "ascenseur",
        "securite_incendie",
        "nettoyage",
        "peinture",
        "sol_revetement",
        "karting",
        "trampoline",
        "bowling",
        "arcade_jeux",
        "laser_game",
        "realite_virtuelle",
        "multi_metiers",
        "autre",
        "ascenseur_escalateur",
        "attractions_manages",
        "gonflables",
        "lumieres",
        "ssi",
        "sprinkler_ria",
        "desenfumage_toiture",
        "flocage_acoustique",
        "courant_faible",
        "cuisiniste",
        "agencement",
        "boissons_pression",
      ],
      role_utilisateur: [
        "direction",
        "chef_maintenance",
        "directeur_parc",
        "manager_parc",
        "technicien",
        "staff_operationnel",
        "admin_it",
      ],
      statut_5_pourquoi: ["ouvert", "valide", "audit_en_cours", "clos"],
      statut_controle: ["a_faire", "en_cours", "valide", "echec", "remplace"],
      statut_incident: [
        "ouvert",
        "assigne",
        "en_cours",
        "en_pause",
        "resolu",
        "ferme",
        "annule",
      ],
      type_controle: ["quotidien", "hebdo", "mensuel"],
      type_maintenance: [
        "preventif_systematique",
        "preventif_conditionnel",
        "preventif_previsionnel",
        "correctif_palliatif",
        "correctif_curatif",
        "reglementaire",
        "amelioration",
        "travaux_neufs",
      ],
    },
  },
} as const
