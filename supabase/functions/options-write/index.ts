// options-write
// Alta, modificación y borrado de opciones de regalo. Revalida en cada llamada:
//   1. la sesión (vigente y no revocada),
//   2. el estado del enlace (identidad activa),
//   3. el permiso de edición sobre el participante objetivo.
// El cliente nunca decide el permiso: se comprueba contra edit_permissions.
//
// Entrada:
//   { token, action: "add",    participant_id, text }
//   { token, action: "update", participant_id, option_id, text }
//   { token, action: "delete", participant_id, option_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";
import { resolveSession } from "../_shared/session.ts";

const MAX_TEXT = 120;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_body" }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  const action = typeof body.action === "string" ? body.action : "";
  const participantId = typeof body.participant_id === "string" ? body.participant_id : "";
  const optionId = typeof body.option_id === "string" ? body.option_id : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!participantId) return json(req, { error: "missing_participant" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const result = await resolveSession(admin, token);
  if (!result.ok) return json(req, { error: result.error }, 401);

  // Permiso de edición sobre el participante solicitado.
  const { data: permission } = await admin
    .from("edit_permissions")
    .select("participant_id")
    .eq("identity_id", result.identity.id)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!permission) return json(req, { error: "forbidden" }, 403);

  if (action === "add") {
    if (text.length < 1 || text.length > MAX_TEXT) {
      return json(req, { error: "invalid_text" }, 400);
    }
    const { data: last } = await admin
      .from("gift_options")
      .select("position")
      .eq("participant_id", participantId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? -1) + 1;

    const { data: option, error } = await admin
      .from("gift_options")
      .insert({ participant_id: participantId, position, text })
      .select("id, participant_id, position, text, updated_at")
      .single();
    if (error) return json(req, { error: "server_error" }, 500);
    return json(req, { ok: true, option });
  }

  if (action === "update" || action === "delete") {
    if (!optionId) return json(req, { error: "missing_option" }, 400);

    const { data: existing } = await admin
      .from("gift_options")
      .select("id, participant_id")
      .eq("id", optionId)
      .maybeSingle();
    if (!existing) return json(req, { error: "not_found" }, 404);
    if (existing.participant_id !== participantId) {
      return json(req, { error: "forbidden" }, 403);
    }

    if (action === "delete") {
      const { error } = await admin.from("gift_options").delete().eq("id", optionId);
      if (error) return json(req, { error: "server_error" }, 500);
      return json(req, { ok: true });
    }

    if (action === "update") {
      if (text.length < 1 || text.length > MAX_TEXT) {
        return json(req, { error: "invalid_text" }, 400);
      }
      const { data: option, error } = await admin
        .from("gift_options")
        .update({ text })
        .eq("id", optionId)
        .select("id, participant_id, position, text, updated_at")
        .single();
      if (error) return json(req, { error: "server_error" }, 500);
      return json(req, { ok: true, option });
    }
  }

  return json(req, { error: "invalid_action" }, 400);
});
