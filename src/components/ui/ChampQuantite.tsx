import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min'> & {
  valeur: number;
  onChange: (q: number) => void;
  min?: number;
};

/**
 * Champ numérique entier qui laisse vider le champ pendant la saisie
 * (sinon effacer pour retaper « 5 » donnait « 15 » ou supprimait la ligne).
 * La valeur n'est transmise que si elle est valide ; au blur, un champ vide
 * ou invalide reprend la dernière valeur valide.
 */
export function ChampQuantite({ valeur, onChange, min = 1, onBlur, ...rest }: Props) {
  const [texte, setTexte] = useState(String(valeur));

  useEffect(() => {
    setTexte((t) => (parseInt(t, 10) === valeur ? t : String(valeur)));
  }, [valeur]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      value={texte}
      onChange={(e) => {
        setTexte(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n) && n >= min) onChange(n);
      }}
      onBlur={(e) => {
        const n = parseInt(texte, 10);
        if (Number.isNaN(n) || n < min) setTexte(String(valeur));
        onBlur?.(e);
      }}
    />
  );
}
