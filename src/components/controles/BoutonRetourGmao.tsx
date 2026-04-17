import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function BoutonRetourGmao() {
  const navigate = useNavigate();
  const { utilisateur, signOut } = useAuth();
  const role = utilisateur?.role_code;

  const peutRetourGmao = role === 'direction' || role === 'chef_maintenance';

  if (peutRetourGmao) {
    return (
      <button
        onClick={() => navigate('/gmao')}
        className="text-[12px] text-dim hover:text-text transition-colors whitespace-nowrap"
      >
        &lsaquo; Retour GMAO
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        signOut();
        navigate('/');
      }}
      className="text-[12px] text-dim hover:text-text transition-colors whitespace-nowrap"
    >
      Se deconnecter
    </button>
  );
}
