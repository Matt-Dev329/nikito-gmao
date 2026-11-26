/** Écran de chargement : logo Nikito Maintenance sur le fond étoilé */
export function EcranChargement() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-5 px-4">
      <img src="/logo-nikito-maintenance.jpg" alt="Nikito Maintenance" className="w-[min(78vw,420px)] rounded-3xl" />
      <div className="text-dim text-sm animate-pulse">Chargement…</div>
    </div>
  );
}
