// Utilidades compartidas por los scripts de administración.
// Se ejecutan en local con la service_role (nunca en el navegador).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Revisa .env y usa --env-file=.env");
    Deno.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function publicBaseUrl(): string {
  return Deno.env.get("PUBLIC_BASE_URL") ?? "https://sebaspio.github.io/Intercambio/";
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Credencial de 256 bits (32 bytes) en hexadecimal.
export function randomCredential(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildLink(credential: string): string {
  return `${publicBaseUrl()}#k=${credential}`;
}

export function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}
