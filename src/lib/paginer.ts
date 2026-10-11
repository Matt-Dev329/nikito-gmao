/**
 * L'API Supabase renvoie au plus 1 000 lignes par requête : charge toutes
 * les pages d'une requête triée. `page(debut, fin)` doit construire la
 * requête complète (filtres + tri stable) et appliquer `.range(debut, fin)`.
 */
export async function chargerToutesLesPages<T>(
  page: (debut: number, fin: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  taille = 1000
): Promise<T[]> {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += taille) {
    const { data, error } = await page(debut, debut + taille - 1);
    if (error) throw error;
    lignes.push(...((data ?? []) as T[]));
    if (!data || data.length < taille) break;
  }
  return lignes;
}
