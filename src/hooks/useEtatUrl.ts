import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Filtre d'une liste gardé dans l'adresse de la page (?cle=valeur) : en
 * revenant en arrière depuis une fiche, on retrouve la liste comme on l'avait
 * laissée (onglet, parc, activité…). `defaut` = valeur quand l'adresse n'en a
 * pas ; elle n'est pas écrite dans l'adresse.
 */
export function useEtatUrl<T extends string>(cle: string, defaut: T): [T, (v: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const valeur = (new URLSearchParams(location.search).get(cle) as T | null) ?? defaut;
  const changer = useCallback(
    (v: T) => {
      // Adresse actuelle relue à chaque appel : plusieurs filtres changés d'un coup s'additionnent
      const params = new URLSearchParams(window.location.search);
      if (v === defaut) params.delete(cle);
      else params.set(cle, v);
      const recherche = params.toString();
      navigate({ pathname: window.location.pathname, search: recherche ? `?${recherche}` : '' }, { replace: true });
    },
    [cle, defaut, navigate]
  );
  return [valeur, changer];
}
