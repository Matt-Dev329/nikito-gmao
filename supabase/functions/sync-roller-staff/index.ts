import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ──────────────────────────────────────────────

interface RollerStaff {
  staffId: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string | null;
  isLocked: boolean;
}

interface PinEntry {
  prenom: string;
  nom: string;
  email: string | null;
  pin: string;
  email_sent: boolean;
  email_error?: string;
}

// ── Constants ──────────────────────────────────────────

const VENUE_SECRET_KEYS: Record<string, string> = {
  FRA: "FRA",
  ALF: "ALF",
  SGB: "SGB",
  DOM: "ROSNY",
};

const SYSTEM_ACCOUNTS_TO_EXCLUDE = [
  "ROLLER Administrator",
  "Billing Contact",
  "team si",
  "Franconville_All Manager",
];

const TRIVIAL_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444",
  "555555", "666666", "777777", "888888", "999999",
  "123456", "654321", "012345", "543210", "121212",
  "123123", "000123", "111222",
]);

// ── Helpers ────────────────────────────────────────────

function isSystemAccount(staff: RollerStaff): boolean {
  const fullName = `${staff.firstName} ${staff.lastName}`.trim();
  return SYSTEM_ACCOUNTS_TO_EXCLUDE.includes(fullName);
}

function generateSecurePin6(): string {
  let pin: string;
  do {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    pin = Array.from(buf, (b) => (b % 10).toString()).join("");
  } while (TRIVIAL_PINS.has(pin));
  return pin;
}

function isNoEmailPlaceholder(email: string | null): boolean {
  if (!email) return true;
  return email.includes("@noemail.com") || email.includes("@no-email.");
}

// ── Roller API ─────────────────────────────────────────

async function getAccessToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Auth Roller echouee (${res.status}): ${detail}`);
  }
  return (await res.json()).access_token;
}

async function fetchAllPages(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;
  while (page <= 100) {
    const url = page === 1 ? baseUrl : `${baseUrl}?pageNumber=${page}`;
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      if (page === 1) {
        const detail = await res.text();
        throw new Error(`GET ${baseUrl} -> ${res.status}: ${detail}`);
      }
      break;
    }
    const body = await res.json();
    const items = Array.isArray(body)
      ? body
      : body.items || body.data || [];
    all.push(...items);
    const totalPages = body.totalPages || 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

// ── Email ──────────────────────────────────────────────

function buildPinEmailHtml(
  prenom: string,
  pin: string,
  parcNom: string,
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 32px 0;">
        <span style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;">
          <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
        </span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:20px;">
            Bonjour ${prenom},
          </td></tr>
          <tr><td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:12px;">
            Bienvenue sur <strong style="color:#ffffff;">ALBA</strong>, l'application de gestion maintenance NIKITO.
            Votre compte vient d'&ecirc;tre cr&eacute;&eacute; pour le parc <strong style="color:#5DE5FF;">${parcNom}</strong>.
          </td></tr>
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:linear-gradient(135deg,#0a0e27 0%,#1a1f4e 100%);color:white;padding:24px 40px;border-radius:12px;text-align:center;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.6;margin-bottom:8px;">Votre code PIN</div>
                <div style="font-size:42px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace;">${pin}</div>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:14px;color:#92400e;">
            <strong>Important :</strong> M&eacute;morisez ce code. &Agrave; votre premi&egrave;re connexion, vous devrez le changer pour un PIN personnel. Ne le partagez avec personne.
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;line-height:22px;padding-top:20px;">
            Pour vous connecter : rendez-vous sur la tablette Alba du parc, s&eacute;lectionnez votre nom, tapez ce PIN, puis choisissez votre nouveau PIN personnel.
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;padding-top:12px;">
            En cas de probl&egrave;me, contactez votre manager.
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 0 0 0;text-align:center;">
        <div style="font-size:11px;color:#8b92b8;line-height:20px;">Cet email a &eacute;t&eacute; envoy&eacute; automatiquement, ne pas r&eacute;pondre.</div>
        <div style="font-size:10px;color:#6E6E96;padding-top:16px;">&copy; Nikito Group &middot; ALBA</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendPinEmail(
  resendApiKey: string,
  email: string,
  prenom: string,
  pin: string,
  parcNom: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [email],
        subject: "Bienvenue sur ALBA - Votre code PIN",
        html: buildPinEmailHtml(prenom, pin, parcNom),
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${errBody}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

// ── Main ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const reqBody = await req.json().catch(() => ({}));
    const parcCode: string = reqBody.venue_code || reqBody.parc_code || "FRA";
    const dryRun: boolean = reqBody.dry_run === true;

    const venueKey = VENUE_SECRET_KEYS[parcCode];
    if (!venueKey) {
      return new Response(
        JSON.stringify({
          error: `Parc inconnu: ${parcCode}. Supportes: ${Object.keys(VENUE_SECRET_KEYS).join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientId = Deno.env.get(`ROLLER_${venueKey}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`ROLLER_${venueKey}_CLIENT_SECRET`);
    const apiUrl = Deno.env.get("ROLLER_API_URL") || "https://api.roller.app";
    const tokenUrl = Deno.env.get("ROLLER_TOKEN_URL") || `${apiUrl}/token`;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: `Secrets ROLLER_${venueKey}_CLIENT_ID/SECRET manquants` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Auth Roller ───────────────────────────────
    const accessToken = await getAccessToken(tokenUrl, clientId, clientSecret);
    const rollerHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json;charset=UTF-8",
    };

    // ── 2. Fetch Roller roles (ID -> name mapping) ──
    console.log("[sync-roller-staff] Fetching Roller roles...");
    const rawRoles = await fetchAllPages(`${apiUrl}/data/roles`, rollerHeaders);
    const rollerRoleIdToName = new Map<string, string>();
    for (const r of rawRoles as Array<{ roleId: number | string; roleName: string }>) {
      rollerRoleIdToName.set(String(r.roleId), r.roleName);
    }
    console.log(`[sync-roller-staff] ${rollerRoleIdToName.size} Roller roles loaded`);

    // ── 3. Fetch Roller staff ────────────────────────
    console.log("[sync-roller-staff] Fetching Roller staff...");
    const rawStaff = await fetchAllPages(`${apiUrl}/data/staffs`, rollerHeaders);
    console.log(`[sync-roller-staff] ${rawStaff.length} staff received from Roller`);

    const rollerStaff: RollerStaff[] = (rawStaff as Record<string, unknown>[]).map((s) => ({
      staffId: String(s.staffId || s.id || ""),
      uniqueId: (s.uniqueId as string) || String(s.staffId || s.id),
      firstName: (s.firstName as string) || "",
      lastName: (s.lastName as string) || "",
      email: (s.email as string) || null,
      role: (s.role as string) || null,
      isLocked: (s.isLocked as boolean) || false,
    }));

    // ── 4. Init Supabase ─────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 5. Get parc ──────────────────────────────────
    const { data: parcData, error: parcErr } = await supabase
      .from("parcs")
      .select("id, code, nom")
      .eq("code", parcCode)
      .maybeSingle();

    if (parcErr || !parcData) {
      return new Response(
        JSON.stringify({ error: `Parc ${parcCode} introuvable`, detail: parcErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 6. Get ALBA role mapping ─────────────────────
    const { data: roleMappings } = await supabase
      .from("roller_role_mapping")
      .select("roller_role_name, role_code");

    const nameToAlbaRole = new Map<string, string>();
    for (const rm of roleMappings || []) {
      nameToAlbaRole.set(rm.roller_role_name.toLowerCase(), rm.role_code);
    }

    // ── 7. Get roles table ───────────────────────────
    const { data: rolesData } = await supabase.from("roles").select("id, code");
    const roleIdByCode = new Map<string, string>();
    for (const r of rolesData || []) {
      roleIdByCode.set(r.code, r.id);
    }

    // ── 8. Get ALL existing users (for matching by roller_id OR email/name)
    const { data: allExistingUsers } = await supabase
      .from("utilisateurs")
      .select("id, roller_unique_id, prenom, nom, email, role_id, actif");

    type ExistingUser = NonNullable<typeof allExistingUsers>[0];
    const existingByRollerId = new Map<string, ExistingUser>();
    const existingByEmail = new Map<string, ExistingUser>();
    const existingByName = new Map<string, ExistingUser>();
    for (const u of allExistingUsers || []) {
      if (u.roller_unique_id) existingByRollerId.set(u.roller_unique_id, u);
      if (u.email) existingByEmail.set(u.email.toLowerCase(), u);
      const nameKey = `${(u.prenom || "").toLowerCase()}|${(u.nom || "").toLowerCase()}`;
      if (nameKey !== "|") existingByName.set(nameKey, u);
    }

    // ── 9. Process staff ─────────────────────────────
    const stats = {
      received_from_roller: rollerStaff.length,
      system_accounts_excluded: 0,
      no_role_skipped: 0,
      unmapped_role_skipped: 0,
      locked_skipped: 0,
      inserted: 0,
      updated: 0,
      already_exists: 0,
    };
    const skippedDetails = {
      system_accounts: [] as string[],
      no_role: [] as Array<{ name: string; email: string | null }>,
      unmapped_roles: [] as string[],
      locked: [] as string[],
    };
    const details: Array<{
      roller_id: string;
      name: string;
      action: string;
      roller_role_raw?: string;
      roller_role_name?: string;
      alba_role?: string;
    }> = [];

    // Collect users that need PINs + emails (only after all inserts succeed)
    const usersNeedingPin: Array<{
      userId: string;
      prenom: string;
      nom: string;
      email: string | null;
      roleCode: string;
    }> = [];

    for (const staff of rollerStaff) {
      const fullName = `${staff.firstName} ${staff.lastName}`.trim();

      // Filter: system accounts
      if (isSystemAccount(staff)) {
        stats.system_accounts_excluded++;
        skippedDetails.system_accounts.push(fullName);
        details.push({ roller_id: staff.uniqueId, name: fullName, action: "SKIP_SYSTEM" });
        continue;
      }

      // Filter: locked
      if (staff.isLocked) {
        stats.locked_skipped++;
        skippedDetails.locked.push(fullName);
        details.push({ roller_id: staff.uniqueId, name: fullName, action: "SKIP_LOCKED" });
        continue;
      }

      // Filter: no role
      if (!staff.role) {
        stats.no_role_skipped++;
        skippedDetails.no_role.push({ name: fullName, email: staff.email });
        details.push({ roller_id: staff.uniqueId, name: fullName, action: "SKIP_NO_ROLE" });
        continue;
      }

      // Resolve role: ID -> name -> ALBA code
      let rollerRoleName: string;
      const rawRole = staff.role;
      if (/^\d+$/.test(rawRole)) {
        const resolved = rollerRoleIdToName.get(rawRole);
        if (!resolved) {
          stats.unmapped_role_skipped++;
          if (!skippedDetails.unmapped_roles.includes(`ID:${rawRole}`)) {
            skippedDetails.unmapped_roles.push(`ID:${rawRole}`);
          }
          details.push({
            roller_id: staff.uniqueId,
            name: fullName,
            action: "SKIP_UNMAPPED_ROLE_ID",
            roller_role_raw: rawRole,
          });
          continue;
        }
        rollerRoleName = resolved;
      } else {
        rollerRoleName = rawRole;
      }

      const albaRoleCode = nameToAlbaRole.get(rollerRoleName.toLowerCase());
      if (!albaRoleCode) {
        stats.unmapped_role_skipped++;
        if (!skippedDetails.unmapped_roles.includes(rollerRoleName)) {
          skippedDetails.unmapped_roles.push(rollerRoleName);
        }
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: "SKIP_UNMAPPED_ROLE_NAME",
          roller_role_raw: rawRole,
          roller_role_name: rollerRoleName,
        });
        continue;
      }

      const albaRoleId = roleIdByCode.get(albaRoleCode);
      if (!albaRoleId) {
        stats.unmapped_role_skipped++;
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: "SKIP_ALBA_ROLE_MISSING",
          alba_role: albaRoleCode,
        });
        continue;
      }

      // ── Case A: already linked by roller_unique_id (re-sync)
      const linkedUser = existingByRollerId.get(staff.uniqueId);
      if (linkedUser) {
        if (dryRun) {
          stats.already_exists++;
          details.push({
            roller_id: staff.uniqueId,
            name: fullName,
            action: "ALREADY_LINKED (dry_run)",
            roller_role_raw: rawRole,
            roller_role_name: rollerRoleName,
            alba_role: albaRoleCode,
          });
          continue;
        }

        const { error: updateErr } = await supabase
          .from("utilisateurs")
          .update({
            prenom: staff.firstName,
            nom: staff.lastName,
            email: isNoEmailPlaceholder(staff.email) ? linkedUser.email : (staff.email || linkedUser.email),
            role_id: albaRoleId,
            actif: true,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", linkedUser.id);

        if (updateErr) {
          details.push({
            roller_id: staff.uniqueId,
            name: fullName,
            action: `UPDATE_ERROR: ${updateErr.message}`,
          });
          continue;
        }

        await supabase.from("parcs_utilisateurs").upsert(
          { utilisateur_id: linkedUser.id, parc_id: parcData.id, est_manager: false },
          { onConflict: "utilisateur_id,parc_id" },
        );

        stats.updated++;
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: "UPDATED",
          roller_role_name: rollerRoleName,
          alba_role: albaRoleCode,
        });
        continue;
      }

      // ── Case B: pre-existing user WITHOUT roller_unique_id (match by email or name)
      const rollerEmail = isNoEmailPlaceholder(staff.email) ? null : staff.email;
      const nameKey = `${staff.firstName.toLowerCase()}|${staff.lastName.toLowerCase()}`;
      const preExisting =
        (rollerEmail ? existingByEmail.get(rollerEmail.toLowerCase()) : null) ||
        existingByName.get(nameKey) ||
        null;

      if (preExisting) {
        if (dryRun) {
          stats.already_exists++;
          details.push({
            roller_id: staff.uniqueId,
            name: fullName,
            action: "LINK_EXISTING (dry_run)",
            roller_role_raw: rawRole,
            roller_role_name: rollerRoleName,
            alba_role: albaRoleCode,
            matched_by: rollerEmail && existingByEmail.has(rollerEmail.toLowerCase()) ? "email" : "name",
            existing_email: preExisting.email,
          } as typeof details[0] & { matched_by: string; existing_email: string | null });
          continue;
        }

        // ONLY set roller_unique_id + last_synced_at. Do NOT touch role_id, auth_mode, code_pin_hash, statut_validation.
        const { error: linkErr } = await supabase
          .from("utilisateurs")
          .update({
            roller_unique_id: staff.uniqueId,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", preExisting.id);

        if (linkErr) {
          details.push({
            roller_id: staff.uniqueId,
            name: fullName,
            action: `LINK_ERROR: ${linkErr.message}`,
          });
          continue;
        }

        await supabase.from("parcs_utilisateurs").upsert(
          { utilisateur_id: preExisting.id, parc_id: parcData.id, est_manager: false },
          { onConflict: "utilisateur_id,parc_id" },
        );

        stats.updated++;
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: "LINKED_EXISTING",
          roller_role_name: rollerRoleName,
          alba_role: albaRoleCode,
        });
        continue;
      }

      // ── Case C: truly new user
      if (dryRun) {
        stats.inserted++;
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: "CREATE (dry_run)",
          roller_role_raw: rawRole,
          roller_role_name: rollerRoleName,
          alba_role: albaRoleCode,
        });
        continue;
      }

      const authMode = albaRoleCode === "staff_operationnel" ? "pin_seul" : "email_password";

      const { data: newUser, error: insertErr } = await supabase
        .from("utilisateurs")
        .insert({
          prenom: staff.firstName,
          nom: staff.lastName,
          email: rollerEmail,
          role_id: albaRoleId,
          auth_mode: authMode,
          statut_validation: "valide",
          actif: true,
          roller_unique_id: staff.uniqueId,
          last_synced_at: new Date().toISOString(),
          pin_must_change: true,
        })
        .select("id")
        .single();

      if (insertErr) {
        details.push({
          roller_id: staff.uniqueId,
          name: fullName,
          action: `INSERT_ERROR: ${insertErr.message}`,
        });
        continue;
      }

      await supabase.from("parcs_utilisateurs").upsert(
        { utilisateur_id: newUser.id, parc_id: parcData.id, est_manager: false },
        { onConflict: "utilisateur_id,parc_id" },
      );

      stats.inserted++;
      details.push({
        roller_id: staff.uniqueId,
        name: fullName,
        action: "CREATED",
        roller_role_name: rollerRoleName,
        alba_role: albaRoleCode,
      });

      usersNeedingPin.push({
        userId: newUser.id,
        prenom: staff.firstName,
        nom: staff.lastName,
        email: rollerEmail,
        roleCode: albaRoleCode,
      });
    }

    // ── 10. Generate PINs and send emails ────────────
    const pinsToCommunciate: PinEntry[] = [];
    const emailStats = { sent: 0, failed: 0, no_email_in_roller: 0 };

    if (!dryRun && usersNeedingPin.length > 0) {
      // Phase A: generate all PINs and store hashes
      for (const u of usersNeedingPin) {
        const pin = generateSecurePin6();

        // Call hash-pin edge function to hash and store
        const hashRes = await fetch(
          `${supabaseUrl}/functions/v1/hash-pin`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "generate",
              utilisateur_id: u.userId,
            }),
          },
        );

        let actualPin = pin;
        if (hashRes.ok) {
          const hashData = await hashRes.json();
          if (hashData.success && hashData.pin) {
            actualPin = hashData.pin;
          }
        } else {
          console.error(`[sync-roller-staff] hash-pin failed for ${u.prenom} ${u.nom}`);
        }

        pinsToCommunciate.push({
          prenom: u.prenom,
          nom: u.nom,
          email: u.email,
          pin: actualPin,
          email_sent: false,
        });
      }

      // Phase B: send emails (only for staff_operationnel with real email)
      if (resendApiKey) {
        for (const entry of pinsToCommunciate) {
          if (!entry.email || isNoEmailPlaceholder(entry.email)) {
            emailStats.no_email_in_roller++;
            continue;
          }

          const result = await sendPinEmail(
            resendApiKey,
            entry.email,
            entry.prenom,
            entry.pin,
            parcData.nom,
          );
          entry.email_sent = result.sent;
          if (result.sent) {
            emailStats.sent++;
          } else {
            emailStats.failed++;
            entry.email_error = result.error;
          }

          // Rate limit Resend
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    }

    // ── 11. Build response ───────────────────────────
    const response: Record<string, unknown> = {
      success: true,
      venue_code: parcCode,
      dry_run: dryRun,
      parc_nom: parcData.nom,
      stats,
      skipped_details: skippedDetails,
      details,
    };

    if (dryRun) {
      response.roller_roles_loaded = Object.fromEntries(rollerRoleIdToName);
    }

    if (!dryRun && pinsToCommunciate.length > 0) {
      response.emails = emailStats;
      response.pins_to_communicate = pinsToCommunciate;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-roller-staff] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
