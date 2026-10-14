// session-info
// Devuelve la identidad y sus permisos actuales, y renueva la sesión de forma
// deslizante (24 h) mientras el enlace siga activo. Revalida caducidad y
// revocación en cada llamada.
//
// Entrada:  { "token": "<token de sesión>" }
// Salida:   { display_name, editable_participants, expires_at }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";
import { newExpiry, resolveSession } from "../_shared/session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_body" }, 400);
  }

  const token = typeof body?.token === "string" ? body.token : "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const result = await resolveSession(admin, token);
  if (!result.ok) return json(req, { error: result.error }, 401);

  const expiresAt = newExpiry();
  await admin
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString(), expires_at: expiresAt })
    .eq("id", result.sessionId);

  const { data: perms } = await admin
    .from("edit_permissions")
    .select("participant_id")
    .eq("identity_id", result.identity.id);

  return json(req, {
    display_name: result.identity.display_name,
    editable_participants: (perms ?? []).map((p) => p.participant_id),
    expires_at: expiresAt,
  });
});
