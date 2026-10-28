import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useParcCourant } from '@/hooks/useParcCourant';
import { SelectionParc } from '@/components/controles/SelectionParc';

export function SelectParcPage() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const setParc = useParcCourant((s) => s.setParc);
  const setTous = useParcCourant((s) => s.setTous);

  if (!utilisateur) return null;

  return (
    <SelectionParc
      titre="Choisir votre parc"
      onSelect={(parc) => {
        setParc(parc);
        navigate('/gmao', { replace: true });
      }}
      onSelectTous={
        utilisateur.parc_ids.length > 1
          ? () => {
              setTous();
              navigate('/gmao', { replace: true });
            }
          : undefined
      }
    />
  );
}
