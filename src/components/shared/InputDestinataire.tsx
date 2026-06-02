import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUtilisateursActifs } from '@/hooks/queries/useUtilisateurs';

interface Props {
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
}

export function InputDestinataire({ value, onChange, placeholder = 'email@exemple.com' }: Props) {
  const { data: utilisateurs } = useUtilisateursActifs();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = (utilisateurs ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.nom.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-bg-card border border-white/[0.08] rounded-xl shadow-2xl max-h-[200px] overflow-y-auto">
          {filtered.slice(0, 20).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange(u.email);
                setSearch(u.email);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left px-3.5 py-2.5 hover:bg-white/[0.04] transition-colors flex items-center gap-2.5',
                'border-b border-white/[0.04] last:border-b-0'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-nikito-cyan/20 text-nikito-cyan flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {u.prenom[0]}{u.nom[0]}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-text truncate">{u.prenom} {u.nom}</div>
                <div className="text-[11px] text-dim truncate">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
