import { supabase, supabaseUrl } from './supabase';

const WEBAUTHN_FN_URL = `${supabaseUrl}/functions/v1/webauthn`;

function getHeaders(token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  h['x-rp-id'] = window.location.hostname;
  return h;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function isWebAuthnSupported(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerPasskey(deviceName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Non authentifie' };

    const res = await fetch(`${WEBAUTHN_FN_URL}/register-options`, {
      method: 'POST',
      headers: getHeaders(session.access_token),
    });

    const options = await res.json();
    if (options.error) return { success: false, error: options.error };

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64urlToBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64urlToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation as AttestationConveyancePreference,
      excludeCredentials: (options.excludeCredentials || []).map((c: { id: string; type: string; transports: string[] }) => ({
        id: base64urlToBuffer(c.id),
        type: c.type,
        transports: c.transports,
      })),
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) return { success: false, error: 'Creation annulee' };

    const attestationResponse = credential.response as AuthenticatorAttestationResponse;

    const verifyRes = await fetch(`${WEBAUTHN_FN_URL}/register-verify`, {
      method: 'POST',
      headers: getHeaders(session.access_token),
      body: JSON.stringify({
        credential: {
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
            attestationObject: bufferToBase64url(attestationResponse.attestationObject),
            transports: attestationResponse.getTransports?.() || ['internal'],
          },
        },
        deviceName,
      }),
    });

    const result = await verifyRes.json();
    if (result.error) return { success: false, error: result.error };

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
      return { success: false, error: 'Annule par l\'utilisateur' };
    }
    return { success: false, error: msg };
  }
}

export async function authenticateWithPasskey(email: string): Promise<{ success: boolean; error?: string; verificationUrl?: string }> {
  try {
    const res = await fetch(`${WEBAUTHN_FN_URL}/authenticate-options`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });

    const options = await res.json();
    if (options.error) return { success: false, error: options.error };

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64urlToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification as UserVerificationRequirement,
      allowCredentials: (options.allowCredentials || []).map((c: { id: string; type: string; transports: string[] }) => ({
        id: base64urlToBuffer(c.id),
        type: c.type,
        transports: c.transports,
      })),
    };

    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) return { success: false, error: 'Authentification annulee' };

    const assertionResponse = credential.response as AuthenticatorAssertionResponse;

    const verifyRes = await fetch(`${WEBAUTHN_FN_URL}/authenticate-verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        credential: {
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
            authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
            signature: bufferToBase64url(assertionResponse.signature),
            userHandle: assertionResponse.userHandle ? bufferToBase64url(assertionResponse.userHandle) : null,
          },
        },
      }),
    });

    const result = await verifyRes.json();
    if (result.error) return { success: false, error: result.error };

    if (result.verification_url) {
      return { success: true, verificationUrl: result.verification_url };
    }

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
      return { success: false, error: 'Annule par l\'utilisateur' };
    }
    return { success: false, error: msg };
  }
}

export async function hasRegisteredPasskey(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${WEBAUTHN_FN_URL}/authenticate-options`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return !data.error;
  } catch {
    return false;
  }
}
