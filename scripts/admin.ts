// Administración local del intercambio (service_role).
//
// Uso:
//   deno run --env-file=.env --allow-net --allow-env --allow-read --allow-write \
//     scripts/admin.ts <comando> [args]
//
// Comandos:
//   init <seed.json> [--reset]   Crea participantes, asignaciones, identidades,
//                                permisos y genera los enlaces.
//   list                         Lista identidades y sus permisos (sin secretos).
//   revoke <nombre|id>           Revoca un enlace y sus sesiones.
//   rotate <nombre|id>           Genera una credencial nueva e invalida sesiones.
//   export <archivo.json>        Exporta datos (sin credenciales ni sesiones).
//   restore <archivo.json>       Restaura datos evitando duplicados.
//   reset --yes                  Borra TODOS los datos del intercambio.

import {
  admin,
  buildLink,
  fail,
  randomCredential,
  sha256Hex,
} from "./lib.ts";

type Seed = {
  participants: string[];
  assignments: { giver: string; receiver: string }[];
  identities: { display_name: string; can_edit: string[] }[];
};

type Backup = {
  version: number;
  participants: { name: string }[];
  assignments: { giver: string; receiver: string }[];
  gift_options: { participant: string; position: number; text: string }[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ZERO = "00000000-0000-0000-0000-000000000000";

const client = admin();
const [command, ...args] = Deno.args;

switch (command) {
  case "init":
    await init(args[0], args.includes("--reset"));
    break;
  case "list":
    await list();
    break;
  case "revoke":
    await revoke(requireRef(args[0]));
    break;
  case "rotate":
    await rotate(requireRef(args[0]));
    break;
  case "export":
    await exportData(requireRef(args[0]));
    break;
  case "restore":
    await restore(requireRef(args[0]));
    break;
  case "reset":
    if (!args.includes("--yes")) fail("Uso: reset --yes (operación destructiva).");
    await wipe();
    console.log("Datos borrados.");
    break;
  default:
    console.log(
      "Comandos: init <seed.json> [--reset] | list | revoke <nombre|id> | " +
        "rotate <nombre|id> | export <archivo.json> | restore <archivo.json> | reset --yes",
    );
    Deno.exit(command ? 1 : 0);
}

function requireRef(v: string | undefined): string {
  if (!v || v.startsWith("--")) fail("Falta el nombre o id.");
  return v;
}

async function wipe(): Promise<void> {
  await client.from("gift_options").delete().neq("id", ZERO);
  await client.from("sessions").delete().neq("id", ZERO);
  await client.from("edit_permissions").delete().neq("identity_id", ZERO);
  await client.from("assignments").delete().neq("id", ZERO);
  await client.from("access_identities").delete().neq("id", ZERO);
  await client.from("participants").delete().neq("id", ZERO);
}

function validateSeed(seed: Seed): void {
  if (!seed || !Array.isArray(seed.participants) || seed.participants.length === 0) {
    fail("El seed debe tener 'participants' no vacío.");
  }
  const names = new Set(seed.participants);
  if (names.size !== seed.participants.length) fail("Hay nombres de participantes duplicados.");

  const givers = new Set<string>();
  const receivers = new Set<string>();
  for (const a of seed.assignments ?? []) {
    if (!names.has(a.giver) || !names.has(a.receiver)) fail(`Asignación con nombre desconocido: ${JSON.stringify(a)}`);
    if (a.giver === a.receiver) fail(`Asignación consigo mismo: ${a.giver}`);
    if (givers.has(a.giver)) fail(`Giver repetido: ${a.giver}`);
    if (receivers.has(a.receiver)) fail(`Receiver repetido: ${a.receiver}`);
    givers.add(a.giver);
    receivers.add(a.receiver);
  }

  const displayNames = new Set<string>();
  for (const id of seed.identities ?? []) {
    if (!id.display_name) fail("Identidad sin display_name.");
    if (displayNames.has(id.display_name)) fail(`display_name duplicado: ${id.display_name}`);
    displayNames.add(id.display_name);
    for (const p of id.can_edit ?? []) {
      if (!names.has(p)) fail(`Permiso sobre participante desconocido: ${p}`);
    }
  }
}

async function init(seedPath: string | undefined, reset: boolean): Promise<void> {
  if (!seedPath) fail("Uso: init <seed.json> [--reset]");
  const seed: Seed = JSON.parse(await Deno.readTextFile(seedPath));
  validateSeed(seed);

  if (reset) {
    await wipe();
    console.log("Datos previos borrados (--reset).");
  }

  const nameToId: Record<string, string> = {};
  for (const name of seed.participants) {
    const { data, error } = await client.from("participants").insert({ name }).select("id").single();
    if (error) fail(`No se pudo crear participante ${name}: ${error.message}`);
    nameToId[name] = data!.id;
  }

  for (const a of seed.assignments ?? []) {
    const { error } = await client.from("assignments").insert({
      giver_participant_id: nameToId[a.giver],
      receiver_participant_id: nameToId[a.receiver],
    });
    if (error) fail(`No se pudo crear asignación ${a.giver}->${a.receiver}: ${error.message}`);
  }

  const links: { display_name: string; link: string }[] = [];
  for (const ident of seed.identities ?? []) {
    const credential = randomCredential();
    const credentialHash = await sha256Hex(credential);
    const { data, error } = await client
      .from("access_identities")
      .insert({ display_name: ident.display_name, credential_hash: credentialHash })
      .select("id")
      .single();
    if (error) fail(`No se pudo crear identidad ${ident.display_name}: ${error.message}`);

    for (const p of ident.can_edit ?? []) {
      const { error: permError } = await client
        .from("edit_permissions")
        .insert({ identity_id: data!.id, participant_id: nameToId[p] });
      if (permError) fail(`No se pudo asignar permiso ${ident.display_name}->${p}: ${permError.message}`);
    }
    links.push({ display_name: ident.display_name, link: buildLink(credential) });
  }

  await Deno.mkdir("links", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `links/links-${stamp}.txt`;
  const content = links.map((l) => `${l.display_name}\t${l.link}`).join("\n") + "\n";
  await Deno.writeTextFile(filename, content);

  console.log(`\nCreados ${seed.participants.length} participantes, ${(seed.assignments ?? []).length} asignaciones y ${links.length} identidades.`);
  console.log(`Enlaces guardados en ${filename}\n`);
  for (const l of links) console.log(`  ${l.display_name}: ${l.link}`);
}

async function findIdentity(ref: string) {
  const column = UUID_RE.test(ref) ? "id" : "display_name";
  const { data } = await client
    .from("access_identities")
    .select("id, display_name, revoked_at")
    .eq(column, ref)
    .maybeSingle();
  return data;
}

async function revoke(ref: string): Promise<void> {
  const identity = await findIdentity(ref);
  if (!identity) fail(`No existe identidad: ${ref}`);

  const now = new Date().toISOString();
  await client.from("sessions").update({ revoked_at: now }).eq("identity_id", identity!.id).is("revoked_at", null);
  const { error } = await client.from("access_identities").update({ revoked_at: now }).eq("id", identity!.id);
  if (error) fail(`No se pudo revocar: ${error.message}`);
  console.log(`Enlace revocado: ${identity!.display_name} (sesiones invalidadas).`);
}

async function rotate(ref: string): Promise<void> {
  const identity = await findIdentity(ref);
  if (!identity) fail(`No existe identidad: ${ref}`);

  const credential = randomCredential();
  const credentialHash = await sha256Hex(credential);
  const now = new Date().toISOString();

  await client.from("sessions").update({ revoked_at: now }).eq("identity_id", identity!.id).is("revoked_at", null);
  const { error } = await client
    .from("access_identities")
    .update({ credential_hash: credentialHash, revoked_at: null })
    .eq("id", identity!.id);
  if (error) fail(`No se pudo rotar: ${error.message}`);
  console.log(`Credencial rotada para ${identity!.display_name}. Enlace nuevo:`);
  console.log(`  ${buildLink(credential)}`);
}

async function list(): Promise<void> {
  const { data: identities } = await client
    .from("access_identities")
    .select("id, display_name, revoked_at")
    .order("display_name");
  const { data: participants } = await client.from("participants").select("id, name");
  const { data: perms } = await client.from("edit_permissions").select("identity_id, participant_id");

  const pname = new Map((participants ?? []).map((p) => [p.id, p.name]));
  console.log("Identidades:");
  for (const i of identities ?? []) {
    const editable = (perms ?? [])
      .filter((p) => p.identity_id === i.id)
      .map((p) => pname.get(p.participant_id))
      .join(", ");
    const state = i.revoked_at ? "REVOCADO" : "activo";
    console.log(`  [${state}] ${i.display_name} (${i.id}) -> edita: ${editable || "(nadie)"}`);
  }
}

async function exportData(path: string): Promise<void> {
  const { data: participants } = await client.from("participants").select("id, name");
  const { data: assignments } = await client.from("assignments").select("giver_participant_id, receiver_participant_id");
  const { data: options } = await client
    .from("gift_options")
    .select("participant_id, position, text")
    .order("participant_id")
    .order("position");

  const name = new Map((participants ?? []).map((p) => [p.id, p.name]));
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    participants: (participants ?? []).map((p) => ({ name: p.name })),
    assignments: (assignments ?? []).map((a) => ({
      giver: name.get(a.giver_participant_id),
      receiver: name.get(a.receiver_participant_id),
    })),
    gift_options: (options ?? []).map((o) => ({
      participant: name.get(o.participant_id),
      position: o.position,
      text: o.text,
    })),
  };
  await Deno.writeTextFile(path, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Exportado a ${path}: ${payload.participants.length} participantes, ${payload.assignments.length} asignaciones, ${payload.gift_options.length} opciones.`);
}

function validateBackup(backup: Backup): void {
  if (!backup || !Array.isArray(backup.participants)) fail("Backup inválido: falta 'participants'.");
  const names = new Set(backup.participants.map((p) => p.name));
  if (names.size !== backup.participants.length) fail("Backup con participantes duplicados.");

  const givers = new Set<string>();
  const receivers = new Set<string>();
  for (const a of backup.assignments ?? []) {
    if (!names.has(a.giver) || !names.has(a.receiver)) fail(`Backup: asignación con nombre desconocido ${JSON.stringify(a)}`);
    if (a.giver === a.receiver) fail(`Backup: asignación consigo mismo ${a.giver}`);
    if (givers.has(a.giver)) fail(`Backup: giver repetido ${a.giver}`);
    if (receivers.has(a.receiver)) fail(`Backup: receiver repetido ${a.receiver}`);
    givers.add(a.giver);
    receivers.add(a.receiver);
  }
  for (const o of backup.gift_options ?? []) {
    if (!names.has(o.participant)) fail(`Backup: opción de participante desconocido ${o.participant}`);
  }
}

async function restore(path: string): Promise<void> {
  const backup: Backup = JSON.parse(await Deno.readTextFile(path));
  validateBackup(backup);

  const { data: existing } = await client.from("participants").select("id, name");
  const nameToId: Record<string, string> = {};
  for (const p of existing ?? []) nameToId[p.name] = p.id;

  let createdP = 0;
  for (const p of backup.participants) {
    if (nameToId[p.name]) continue;
    const { data, error } = await client.from("participants").insert({ name: p.name }).select("id").single();
    if (error) fail(`No se pudo restaurar participante ${p.name}: ${error.message}`);
    nameToId[p.name] = data!.id;
    createdP++;
  }

  const { data: existingAssignments } = await client.from("assignments").select("giver_participant_id");
  const assignedGivers = new Set((existingAssignments ?? []).map((a) => a.giver_participant_id));
  let createdA = 0;
  for (const a of backup.assignments ?? []) {
    if (assignedGivers.has(nameToId[a.giver])) continue;
    const { error } = await client.from("assignments").insert({
      giver_participant_id: nameToId[a.giver],
      receiver_participant_id: nameToId[a.receiver],
    });
    if (error) fail(`No se pudo restaurar asignación ${a.giver}->${a.receiver}: ${error.message}`);
    createdA++;
  }

  const { data: existingOptions } = await client.from("gift_options").select("participant_id, position");
  const optKey = (pid: string, pos: number) => `${pid}:${pos}`;
  const have = new Set((existingOptions ?? []).map((o) => optKey(o.participant_id, o.position)));
  let createdO = 0;
  for (const o of backup.gift_options ?? []) {
    const pid = nameToId[o.participant];
    if (have.has(optKey(pid, o.position))) continue;
    const { error } = await client
      .from("gift_options")
      .insert({ participant_id: pid, position: o.position, text: o.text });
    if (error) fail(`No se pudo restaurar opción de ${o.participant}: ${error.message}`);
    createdO++;
  }

  console.log(`Restaurado: ${createdP} participantes, ${createdA} asignaciones y ${createdO} opciones nuevas.`);
}
