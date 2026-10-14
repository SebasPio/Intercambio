// validate-link
// Canjea la credencial de un enlace (enviada desde el fragmento #k=...) por una
// sesión temporal. La credencial nunca se registra ni se devuelve.
//
// Entrada:  { "credential": "<cadena aleatoria>" }
// Salida:   { token, display_name, editable_participants, expires_at }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";
import { newExpiry, randomToken, sha256Hex } from "../_shared/session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  let body: { credential?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_body" }, 400);
  }

  const credential = typeof body?.credential === "string" ? body.credential.trim() : "";
  if (credential.length < 32) return json(req, { error: "invalid_link" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const credentialHash = await sha256Hex(credential);
  const { data: identity } = await admin
    .from("access_identities")
    .select("id, display_name")
    .eq("credential_hash", credentialHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!identity) return json(req, { error: "invalid_link" }, 401);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = newExpiry();

  const { error: insertError } = await admin.from("sessions").insert({
    identity_id: identity.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (insertError) return json(req, { error: "server_error" }, 500);

  const { data: perms } = await admin
    .from("edit_permissions")
    .select("participant_id")
    .eq("identity_id", identity.id);

  return json(req, {
    token,
    display_name: identity.display_name,
    editable_participants: (perms ?? []).map((p) => p.participant_id),
    expires_at: expiresAt,
  });
});
