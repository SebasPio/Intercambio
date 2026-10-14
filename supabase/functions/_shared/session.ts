// Utilidades de credenciales/sesiones.
// Las credenciales y los tokens nunca se guardan en claro: solo su sha256.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SESSION_HOURS = 24;

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Token opaco de 256 bits.
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

export function newExpiry(): string {
  return new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
}

export type ResolvedIdentity = {
  id: string;
  display_name: string;
};

export type SessionResult =
  | { ok: true; sessionId: string; identity: ResolvedIdentity }
  | { ok: false; error: "invalid_session" | "expired_session" | "revoked_identity" };

// Resuelve un token de sesión a su identidad, comprobando caducidad y revocación
// tanto de la sesión como del enlace (identidad).
export async function resolveSession(
  admin: SupabaseClient,
  token: string,
): Promise<SessionResult> {
  if (!token || token.length < 32) return { ok: false, error: "invalid_session" };

  const tokenHash = await sha256Hex(token);
  const { data: session } = await admin
    .from("sessions")
    .select("id, identity_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session || session.revoked_at) return { ok: false, error: "invalid_session" };
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "expired_session" };
  }

  const { data: identity } = await admin
    .from("access_identities")
    .select("id, display_name, revoked_at")
    .eq("id", session.identity_id)
    .maybeSingle();

  if (!identity || identity.revoked_at) {
    return { ok: false, error: "revoked_identity" };
  }

  return { ok: true, sessionId: session.id, identity };
}
