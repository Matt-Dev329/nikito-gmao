-- Stock : chaque parc ne voit que ses pièces (et le stock commun, sans parc).
-- Direction, chef d'équipe et admin IT (gestion du stock) voient tout via
-- pieces_ecriture_gestionnaires.
ALTER POLICY pieces_lecture_authentifies ON public.pieces_detachees
  USING (parc_id IS NULL OR parc_id = ANY (current_parc_ids()) OR (SELECT peut_entrer_stock()));
