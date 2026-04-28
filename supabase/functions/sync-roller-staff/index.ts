import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RollerStaffMember {
  id: number;
  uniqueId?: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  role?: string | null;
  roleName?: string | null;
  isActive?: boolean;
  status?: string;
  venues?: Array<{ id: number; name: string }>;
}

interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    roller_id: string;
    name: string;
    action: string;
    role?: string;
  }>;
}

const VENUE_SECRET_KEYS: Record<string, string> = {
  FRA: "FRA",
  ALF: "ALF",
  SGB: "SGB",
  DOM: "ROSNY",
};

async function getAccessToken(
  apiUrl: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(tokenUrl || `${apiUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Auth Roller echouee (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchRollerStaff(
  apiUrl: string,
  token: string,
): Promise<RollerStaffMember[]> {
  const allStaff: RollerStaffMember[] = [];
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json;charset=UTF-8",
  };

  // The Roller REST API staff endpoint is POST /staff (confirmed: GET returns 405)
  // It requires the "staff" scope to be enabled on the API key (Roller support request)
  const endpoints = [
    { url: `${apiUrl}/staff`, method: "POST", body: "{}" },
    { url: `${apiUrl}/staff`, method: "GET", body: undefined },
    { url: `${apiUrl}/data/staff`, method: "GET", body: undefined },
  ];

  let response: Response | null = null;
  let usedEndpoint = "";
  const tried: string[] = [];

  for (const ep of endpoints) {
    try {
      const fetchOpts: RequestInit = { method: ep.method, headers };
      if (ep.body) fetchOpts.body = ep.body;
      const res = await fetch(ep.url, fetchOpts);
      const status = res.status;
      tried.push(`${ep.method} ${ep.url} -> ${status}`);
      console.log(`[sync-roller-staff] ${ep.method} ${ep.url} -> ${status}`);

      if (res.ok) {
        response = res;
        usedEndpoint = ep.url;
        break;
      }
      if (status === 403) {
        const body403 = await res.text().catch(() => "");
        throw new Error(
          `Endpoint ${ep.url} retourne 403 Forbidden. ` +
          `Le scope "staff" n'est probablement pas active pour cette cle API Roller. ` +
          `Contactez le support Roller pour activer l'acces staff. Detail: ${body403}`,
        );
      }
      // Consume body to free connection
      await res.text().catch(() => {});
    } catch (e) {
      if (e instanceof Error && e.message.includes("403")) throw e;
      tried.push(`${ep.method} ${ep.url} -> ERROR: ${e}`);
      continue;
    }
  }

  if (!response) {
    throw new Error(
      `Aucun endpoint staff Roller accessible. Essais: ${tried.join(" | ")}`,
    );
  }

  const body = await response.json();
  console.log(
    `[sync-roller-staff] Endpoint ${usedEndpoint} OK, response keys: ${Object.keys(body)}`,
  );

  // Handle different response shapes
  const staffList: RollerStaffMember[] = Array.isArray(body)
    ? body
    : body.data || body.staff || body.items || body.results || [];

  for (const s of staffList) {
    allStaff.push({
      id: s.id,
      uniqueId: s.uniqueId || String(s.id),
      firstName: s.firstName || s.first_name || "",
      lastName: s.lastName || s.last_name || "",
      email: s.email || s.emailAddress || null,
      phone: s.phone || s.mobile || s.phoneNumber || s.mobileNumber || null,
      role: s.role || s.roleName || s.role_name || null,
      isActive: s.isActive !== undefined ? s.isActive : s.status !== "inactive",
    });
  }

  // Handle pagination if present
  let nextPage = body.nextPageUrl || body.next || null;
  let pageCount = 1;
  while (nextPage && pageCount < 50) {
    const pageRes = await fetch(nextPage, { headers });
    if (!pageRes.ok) break;
    const pageBody = await pageRes.json();
    const pageList = Array.isArray(pageBody)
      ? pageBody
      : pageBody.data || pageBody.staff || pageBody.items || [];
    for (const s of pageList) {
      allStaff.push({
        id: s.id,
        uniqueId: s.uniqueId || String(s.id),
        firstName: s.firstName || s.first_name || "",
        lastName: s.lastName || s.last_name || "",
        email: s.email || s.emailAddress || null,
        phone: s.phone || s.mobile || s.phoneNumber || s.mobileNumber || null,
        role: s.role || s.roleName || s.role_name || null,
        isActive:
          s.isActive !== undefined ? s.isActive : s.status !== "inactive",
      });
    }
    nextPage = pageBody.nextPageUrl || pageBody.next || null;
    pageCount++;
  }

  return allStaff;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parcCode: string = body.parc_code || "FRA";
    const dryRun: boolean = body.dry_run === true;

    const venueKey = VENUE_SECRET_KEYS[parcCode];
    if (!venueKey) {
      return new Response(
        JSON.stringify({
          error: `Parc inconnu: ${parcCode}. Parcs supportes: ${Object.keys(VENUE_SECRET_KEYS).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const clientId = Deno.env.get(`ROLLER_${venueKey}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`ROLLER_${venueKey}_CLIENT_SECRET`);
    const apiUrl = Deno.env.get("ROLLER_API_URL") || "https://api.roller.app";
    const tokenUrl = Deno.env.get("ROLLER_TOKEN_URL") || `${apiUrl}/token`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: `Secrets ROLLER_${venueKey}_CLIENT_ID / ROLLER_${venueKey}_CLIENT_SECRET manquants`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Auth Roller
    const accessToken = await getAccessToken(
      apiUrl,
      tokenUrl,
      clientId,
      clientSecret,
    );

    // 2. Fetch staff from Roller
    const rollerStaff = await fetchRollerStaff(apiUrl, accessToken);
    console.log(
      `[sync-roller-staff] ${parcCode}: ${rollerStaff.length} staff membres recuperes de Roller`,
    );

    // 3. Init Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. Get parc info
    const { data: parcData, error: parcErr } = await supabase
      .from("parcs")
      .select("id, code, nom")
      .eq("code", parcCode)
      .maybeSingle();

    if (parcErr || !parcData) {
      return new Response(
        JSON.stringify({
          error: `Parc ${parcCode} introuvable en base`,
          detail: parcErr?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Get role mapping
    const { data: roleMappings } = await supabase
      .from("roller_role_mapping")
      .select("roller_role_name, role_code");

    const roleMap = new Map<string, string>();
    for (const rm of roleMappings || []) {
      roleMap.set(rm.roller_role_name.toLowerCase(), rm.role_code);
    }

    // 6. Get roles table for role_id lookup
    const { data: rolesData } = await supabase.from("roles").select("id, code");
    const roleIdByCode = new Map<string, string>();
    for (const r of rolesData || []) {
      roleIdByCode.set(r.code, r.id);
    }

    // 7. Get existing roller-synced users for this parc
    const { data: existingUsers } = await supabase
      .from("utilisateurs")
      .select(
        "id, roller_unique_id, prenom, nom, email, role_id, actif, last_synced_at",
      )
      .not("roller_unique_id", "is", null);

    const existingByRollerId = new Map<
      string,
      (typeof existingUsers)[0]
    >();
    for (const u of existingUsers || []) {
      if (u.roller_unique_id) {
        existingByRollerId.set(u.roller_unique_id, u);
      }
    }

    // 8. Process each Roller staff member
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    const rollerIds = new Set<string>();

    for (const staff of rollerStaff) {
      const rollerId = staff.uniqueId || String(staff.id);
      rollerIds.add(rollerId);

      const rollerRoleName = staff.role || "";
      const albaRoleCode =
        roleMap.get(rollerRoleName.toLowerCase()) || "staff_operationnel";
      const albaRoleId = roleIdByCode.get(albaRoleCode);

      if (!albaRoleId) {
        result.errors.push(
          `Role ${albaRoleCode} introuvable pour ${staff.firstName} ${staff.lastName} (roller role: ${rollerRoleName})`,
        );
        result.skipped++;
        continue;
      }

      const existing = existingByRollerId.get(rollerId);
      const isActive = staff.isActive !== false;

      if (existing) {
        // Update existing user
        if (dryRun) {
          result.details.push({
            roller_id: rollerId,
            name: `${staff.firstName} ${staff.lastName}`,
            action: "UPDATE (dry_run)",
            role: `${rollerRoleName} -> ${albaRoleCode}`,
          });
          result.updated++;
          continue;
        }

        const { error: updateErr } = await supabase
          .from("utilisateurs")
          .update({
            prenom: staff.firstName,
            nom: staff.lastName,
            email: staff.email || existing.email,
            role_id: albaRoleId,
            actif: isActive,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateErr) {
          result.errors.push(
            `Update ${staff.firstName} ${staff.lastName}: ${updateErr.message}`,
          );
        } else {
          // Ensure parc association
          await supabase
            .from("parcs_utilisateurs")
            .upsert(
              {
                utilisateur_id: existing.id,
                parc_id: parcData.id,
                est_manager: false,
              },
              { onConflict: "utilisateur_id,parc_id" },
            );

          result.details.push({
            roller_id: rollerId,
            name: `${staff.firstName} ${staff.lastName}`,
            action: isActive ? "UPDATED" : "DEACTIVATED",
            role: `${rollerRoleName} -> ${albaRoleCode}`,
          });
          result.updated++;
        }
      } else {
        // Create new user
        if (!isActive) {
          result.skipped++;
          result.details.push({
            roller_id: rollerId,
            name: `${staff.firstName} ${staff.lastName}`,
            action: "SKIPPED (inactive in Roller)",
          });
          continue;
        }

        if (dryRun) {
          result.details.push({
            roller_id: rollerId,
            name: `${staff.firstName} ${staff.lastName}`,
            action: "CREATE (dry_run)",
            role: `${rollerRoleName} -> ${albaRoleCode}`,
          });
          result.created++;
          continue;
        }

        const authMode =
          albaRoleCode === "staff_operationnel" ? "pin_seul" : "email_password";

        const { data: newUser, error: insertErr } = await supabase
          .from("utilisateurs")
          .insert({
            prenom: staff.firstName,
            nom: staff.lastName,
            email: staff.email || null,
            telephone: staff.phone || null,
            role_id: albaRoleId,
            auth_mode: authMode,
            statut_validation: "valide",
            actif: true,
            roller_unique_id: rollerId,
            last_synced_at: new Date().toISOString(),
            pin_must_change: true,
          })
          .select("id")
          .single();

        if (insertErr) {
          if (
            insertErr.message?.includes("duplicate") ||
            insertErr.message?.includes("unique")
          ) {
            result.skipped++;
            result.details.push({
              roller_id: rollerId,
              name: `${staff.firstName} ${staff.lastName}`,
              action: "SKIPPED (doublon roller_unique_id)",
            });
          } else {
            result.errors.push(
              `Insert ${staff.firstName} ${staff.lastName}: ${insertErr.message}`,
            );
          }
          continue;
        }

        // Associate to parc
        if (newUser) {
          await supabase
            .from("parcs_utilisateurs")
            .upsert(
              {
                utilisateur_id: newUser.id,
                parc_id: parcData.id,
                est_manager: false,
              },
              { onConflict: "utilisateur_id,parc_id" },
            );
        }

        result.details.push({
          roller_id: rollerId,
          name: `${staff.firstName} ${staff.lastName}`,
          action: "CREATED",
          role: `${rollerRoleName} -> ${albaRoleCode}`,
        });
        result.created++;
      }
    }

    // 9. Deactivate users in ALBA that are no longer in Roller for this parc
    if (!dryRun) {
      const { data: parcUsers } = await supabase
        .from("parcs_utilisateurs")
        .select("utilisateur_id")
        .eq("parc_id", parcData.id);

      const parcUserIds = new Set(
        (parcUsers || []).map((pu) => pu.utilisateur_id),
      );

      for (const [rollerId, user] of existingByRollerId) {
        if (!rollerIds.has(rollerId) && parcUserIds.has(user.id) && user.actif) {
          const { error: deacErr } = await supabase
            .from("utilisateurs")
            .update({
              actif: false,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          if (!deacErr) {
            result.deactivated++;
            result.details.push({
              roller_id: rollerId,
              name: `${user.prenom} ${user.nom}`,
              action: "DEACTIVATED (absent de Roller)",
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        parc: parcCode,
        parc_nom: parcData.nom,
        roller_staff_count: rollerStaff.length,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-roller-staff] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
