import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Tu es un assistant de debug expert pour ALBA, une application GMAO (Gestion de Maintenance Assistée par Ordinateur) développée pour Nikito Group (parcs de loisirs indoor).

Stack technique :
- Frontend : React 18 + TypeScript + Vite + Tailwind CSS + React Router v6
- Backend : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- State : Zustand + React Query (TanStack)
- UI : Design system custom dark theme, responsive mobile-first
- Auth : Supabase email/password + PIN pour staff opérationnel
- Rôles : direction, chef_maintenance, manager_parc, technicien, staff_operationnel, admin_it

Tables principales : parcs, equipements, incidents, interventions, controles, controle_items, utilisateurs, roles, config_globale, pieces_detachees, maintenances_preventives, plaintes, fournisseurs, categories_equipement, points_controle, niveaux_priorite

Edge Functions déployées : analyse-ia-predictive, check-controles-manquants, send-code-2fa, send-invitation-email, send-rapport-controles, send-rapport-ia, send-recap-manager, send-support-email, notify-arcade-incident, generer-rapport-ia-hebdo, sync-roller-gxs, debug-assistant

Sécurité : Row Level Security (RLS) sur toutes les tables, politiques par rôle via current_role_code()

Quand on te décrit un problème :
1. Analyse le contexte système fourni (santé DB, edge functions, erreurs récentes)
2. Identifie les causes probables par ordre de probabilité
3. Propose des étapes de diagnostic concrètes
4. Donne des solutions ou contournements
5. Si c'est un problème de code, indique les fichiers probablement concernés

Réponds en français, de manière structurée et concise. Utilise des listes à puces.
Ne génère pas de code sauf si explicitement demandé.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configurée" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, system_context, history } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Message requis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contextBlock = system_context
      ? `\n\nContexte système actuel :\n${JSON.stringify(system_context, null, 2)}`
      : "";

    const messages = [];

    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({
      role: "user",
      content: `${message}${contextBlock}`,
    });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erreur API Claude (${anthropicRes.status})`,
          detail: errBody,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({ success: true, reply: text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
