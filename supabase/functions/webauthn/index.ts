import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function generateChallenge(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64urlEncode(buffer);
}

const RP_NAME = "Alba by Nikito";
const RP_ID_HEADER = "x-rp-id";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rpId =
      req.headers.get(RP_ID_HEADER) ||
      new URL(req.headers.get("origin") || "https://localhost").hostname;

    switch (path) {
      case "register-options": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
          return jsonResponse({ error: "Non authentifie" }, 401);
        }

        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return jsonResponse({ error: "Non authentifie" }, 401);
        }

        const { data: utilisateur } = await supabase
          .from("utilisateurs")
          .select("id, prenom, nom, email")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!utilisateur) {
          return jsonResponse({ error: "Utilisateur non trouve" }, 404);
        }

        const { data: existingCreds } = await supabase
          .from("webauthn_credentials")
          .select("credential_id")
          .eq("utilisateur_id", utilisateur.id)
          .eq("actif", true);

        const challenge = generateChallenge();

        await supabase.from("webauthn_challenges").insert({
          challenge,
          type: "registration",
          utilisateur_id: utilisateur.id,
        });

        const options = {
          challenge,
          rp: { name: RP_NAME, id: rpId },
          user: {
            id: base64urlEncode(new TextEncoder().encode(utilisateur.id)),
            name: utilisateur.email,
            displayName: `${utilisateur.prenom} ${utilisateur.nom}`,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
            requireResidentKey: false,
          },
          attestation: "none",
          excludeCredentials: (existingCreds || []).map((c: { credential_id: string }) => ({
            id: c.credential_id,
            type: "public-key",
            transports: ["internal"],
          })),
        };

        return jsonResponse(options);
      }

      case "register-verify": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
          return jsonResponse({ error: "Non authentifie" }, 401);
        }

        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return jsonResponse({ error: "Non authentifie" }, 401);
        }

        const { data: utilisateur } = await supabase
          .from("utilisateurs")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!utilisateur) {
          return jsonResponse({ error: "Utilisateur non trouve" }, 404);
        }

        const body = await req.json();
        const { credential, deviceName } = body;

        if (!credential || !credential.id || !credential.response) {
          return jsonResponse({ error: "Credential invalide" }, 400);
        }

        const { data: challengeRow } = await supabase
          .from("webauthn_challenges")
          .select("*")
          .eq("utilisateur_id", utilisateur.id)
          .eq("type", "registration")
          .eq("utilise", false)
          .gt("expire_le", new Date().toISOString())
          .order("expire_le", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!challengeRow) {
          return jsonResponse({ error: "Challenge expire ou invalide" }, 400);
        }

        await supabase
          .from("webauthn_challenges")
          .update({ utilise: true })
          .eq("id", challengeRow.id);

        const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
        const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

        if (clientData.type !== "webauthn.create") {
          return jsonResponse({ error: "Type de reponse invalide" }, 400);
        }

        if (clientData.challenge !== challengeRow.challenge) {
          return jsonResponse({ error: "Challenge ne correspond pas" }, 400);
        }

        const attestationObject = base64urlDecode(credential.response.attestationObject);
        const authData = parseAttestationObject(attestationObject);

        if (!authData) {
          return jsonResponse({ error: "Impossible de parser attestation" }, 400);
        }

        const { credentialId, publicKey, counter } = authData;

        await supabase.from("webauthn_credentials").insert({
          utilisateur_id: utilisateur.id,
          credential_id: credentialId,
          public_key: publicKey,
          counter,
          device_name: deviceName || "Appareil biometrique",
          transports: credential.response.transports || ["internal"],
        });

        return jsonResponse({ success: true });
      }

      case "authenticate-options": {
        const body = await req.json();
        const { email } = body;

        if (!email) {
          return jsonResponse({ error: "Email requis" }, 400);
        }

        const { data: utilisateur } = await supabase
          .from("utilisateurs")
          .select("id")
          .eq("email", email)
          .eq("actif", true)
          .maybeSingle();

        if (!utilisateur) {
          return jsonResponse({ error: "Utilisateur non trouve" }, 404);
        }

        const { data: credentials } = await supabase
          .from("webauthn_credentials")
          .select("credential_id, transports")
          .eq("utilisateur_id", utilisateur.id)
          .eq("actif", true);

        if (!credentials || credentials.length === 0) {
          return jsonResponse({ error: "Aucun passkey enregistre" }, 404);
        }

        const challenge = generateChallenge();

        await supabase.from("webauthn_challenges").insert({
          challenge,
          type: "authentication",
          email,
        });

        const options = {
          challenge,
          rpId,
          timeout: 60000,
          userVerification: "required",
          allowCredentials: credentials.map((c: { credential_id: string; transports: string[] }) => ({
            id: c.credential_id,
            type: "public-key",
            transports: c.transports || ["internal"],
          })),
        };

        return jsonResponse(options);
      }

      case "authenticate-verify": {
        const body = await req.json();
        const { credential, email } = body;

        if (!credential || !email) {
          return jsonResponse({ error: "Credential et email requis" }, 400);
        }

        const { data: challengeRow } = await supabase
          .from("webauthn_challenges")
          .select("*")
          .eq("email", email)
          .eq("type", "authentication")
          .eq("utilise", false)
          .gt("expire_le", new Date().toISOString())
          .order("expire_le", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!challengeRow) {
          return jsonResponse({ error: "Challenge expire ou invalide" }, 400);
        }

        await supabase
          .from("webauthn_challenges")
          .update({ utilise: true })
          .eq("id", challengeRow.id);

        const { data: storedCred } = await supabase
          .from("webauthn_credentials")
          .select("*, utilisateurs!inner(id, auth_user_id, email, actif)")
          .eq("credential_id", credential.id)
          .eq("actif", true)
          .maybeSingle();

        if (!storedCred) {
          return jsonResponse({ error: "Credential non reconnu" }, 401);
        }

        const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
        const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

        if (clientData.type !== "webauthn.get") {
          return jsonResponse({ error: "Type de reponse invalide" }, 400);
        }

        if (clientData.challenge !== challengeRow.challenge) {
          return jsonResponse({ error: "Challenge ne correspond pas" }, 400);
        }

        const authenticatorData = base64urlDecode(credential.response.authenticatorData);
        const newCounter = getCounterFromAuthData(authenticatorData);

        if (newCounter > 0 && newCounter <= storedCred.counter) {
          return jsonResponse({ error: "Compteur de replay invalide" }, 400);
        }

        await supabase
          .from("webauthn_credentials")
          .update({
            counter: newCounter,
            derniere_utilisation: new Date().toISOString(),
          })
          .eq("id", storedCred.id);

        const utilisateurData = storedCred.utilisateurs as { auth_user_id: string };

        const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: email,
        });

        if (tokenError || !tokenData) {
          return jsonResponse({ error: "Erreur generation session" }, 500);
        }

        return jsonResponse({
          success: true,
          access_token: tokenData.properties?.hashed_token,
          token_type: "magiclink",
          verification_url: tokenData.properties?.action_link,
        });
      }

      default:
        return jsonResponse({ error: "Route non trouvee" }, 404);
    }
  } catch (e) {
    console.error("WebAuthn error:", e);
    return jsonResponse({ error: "Erreur interne du serveur" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseAttestationObject(buffer: Uint8Array): { credentialId: string; publicKey: string; counter: number } | null {
  try {
    const decoded = decodeCBOR(buffer);
    if (!decoded || !decoded.authData) return null;

    const authData = decoded.authData instanceof Uint8Array
      ? decoded.authData
      : new Uint8Array(decoded.authData);

    const rpIdHash = authData.slice(0, 32);
    const flags = authData[32];
    const counter = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0);

    if (!(flags & 0x40)) return null;

    const aaguid = authData.slice(37, 53);
    const credIdLen = new DataView(authData.buffer, authData.byteOffset + 53, 2).getUint16(0);
    const credentialIdBytes = authData.slice(55, 55 + credIdLen);
    const publicKeyBytes = authData.slice(55 + credIdLen);

    return {
      credentialId: base64urlEncode(credentialIdBytes),
      publicKey: base64urlEncode(publicKeyBytes),
      counter,
    };
  } catch (e) {
    console.error("Parse attestation error:", e);
    return null;
  }
}

function getCounterFromAuthData(authData: Uint8Array): number {
  if (authData.length < 37) return 0;
  return new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0);
}

function decodeCBOR(data: Uint8Array): Record<string, unknown> | null {
  let offset = 0;

  function readByte(): number {
    return data[offset++];
  }

  function readBytes(n: number): Uint8Array {
    const result = data.slice(offset, offset + n);
    offset += n;
    return result;
  }

  function readLength(additional: number): number {
    if (additional < 24) return additional;
    if (additional === 24) return readByte();
    if (additional === 25) {
      const b = readBytes(2);
      return (b[0] << 8) | b[1];
    }
    if (additional === 26) {
      const b = readBytes(4);
      return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
    }
    return 0;
  }

  function decode(): unknown {
    const initial = readByte();
    const majorType = initial >> 5;
    const additional = initial & 0x1f;

    switch (majorType) {
      case 0:
        return readLength(additional);
      case 1:
        return -1 - readLength(additional);
      case 2: {
        const len = readLength(additional);
        return readBytes(len);
      }
      case 3: {
        const len = readLength(additional);
        const bytes = readBytes(len);
        return new TextDecoder().decode(bytes);
      }
      case 4: {
        const len = readLength(additional);
        const arr: unknown[] = [];
        for (let i = 0; i < len; i++) arr.push(decode());
        return arr;
      }
      case 5: {
        const len = readLength(additional);
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < len; i++) {
          const key = decode();
          const value = decode();
          obj[String(key)] = value;
        }
        return obj;
      }
      case 7: {
        if (additional === 20) return false;
        if (additional === 21) return true;
        if (additional === 22) return null;
        return undefined;
      }
      default:
        return null;
    }
  }

  try {
    const result = decode();
    return result as Record<string, unknown>;
  } catch {
    return null;
  }
}
