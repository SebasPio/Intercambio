// Frontend sin build. Lectura pública + edición autorizada por sesión.
(function () {
  "use strict";

  const { supabaseUrl, supabaseAnonKey } = window.APP_CONFIG;
  const TOKEN_KEY = "intercambio_token";

  const els = {
    app: document.getElementById("app"),
    greeting: document.getElementById("greeting"),
    status: document.getElementById("status"),
  };

  const state = {
    participants: [],
    assignments: [],
    options: [],
    token: null,
    displayName: null,
    editable: new Set(),
    drafts: {},
    sig: "",
  };

  let pendingRemote = false;
  let polling = false;
  let syncStarted = false;

  // --- API ------------------------------------------------------------------

  async function rest(path) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) throw new Error(`No se pudieron cargar los datos (${res.status}).`);
    return res.json();
  }

  async function callFunction(name, payload) {
    const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* sin cuerpo */
    }
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function setStatus(message, tone) {
    els.status.textContent = message || "";
    if (tone) els.status.dataset.tone = tone;
    else delete els.status.dataset.tone;
  }

  // --- Enlace y sesión ------------------------------------------------------

  function readCredential() {
    const match = location.hash.match(/[#&]k=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function clearCredentialFromUrl() {
    history.replaceState(null, "", location.pathname + location.search);
  }

  async function validateLink(credential) {
    const data = await callFunction("validate-link", { credential });
    state.token = data.token;
    state.displayName = data.display_name;
    state.editable = new Set(data.editable_participants || []);
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  async function restoreSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const data = await callFunction("session-info", { token });
      state.token = token;
      state.displayName = data.display_name;
      state.editable = new Set(data.editable_participants || []);
    } catch (_) {
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
    }
  }

  // --- Datos ----------------------------------------------------------------

  async function loadData() {
    const [participants, assignments, options] = await Promise.all([
      rest("participants?select=id,name&order=name"),
      rest("assignments?select=giver_participant_id,receiver_participant_id"),
      rest("gift_options?select=id,participant_id,position,text&order=participant_id,position"),
    ]);
    state.participants = participants;
    state.assignments = assignments;
    state.options = options;
    state.sig = JSON.stringify(options);
  }

  const nameOf = (id) => (state.participants.find((p) => p.id === id) || {}).name || "?";
  const optionsOf = (pid) => state.options.filter((o) => o.participant_id === pid);
  const receiverOf = (pid) => {
    const a = state.assignments.find((x) => x.giver_participant_id === pid);
    return a ? nameOf(a.receiver_participant_id) : null;
  };
  const giverOfReceiver = (pid) => {
    const a = state.assignments.find((x) => x.receiver_participant_id === pid);
    return a ? nameOf(a.giver_participant_id) : null;
  };

  function originalOptions(pid) {
    return optionsOf(pid).map((o) => ({ id: o.id, text: o.text }));
  }

  function draftFor(pid) {
    if (!state.drafts[pid]) {
      state.drafts[pid] = state.editable.has(pid)
        ? originalOptions(pid).map((o) => ({ ...o }))
        : [];
    }
    return state.drafts[pid];
  }

  function hasPending(pid) {
    const draft = state.drafts[pid];
    if (!draft) return false;
    const original = originalOptions(pid);
    const draftIds = draft.filter((d) => d.id).map((d) => d.id);
    if (draftIds.length !== original.length) return true;
    if (draft.some((d) => !d.id && d.text.trim() !== "")) return true;
    return draft.some((d) => {
      if (!d.id) return false;
      const orig = original.find((o) => o.id === d.id);
      return !orig || orig.text !== d.text.trim();
    });
  }

  function anyPending() {
    return Object.keys(state.drafts).some((pid) => hasPending(pid));
  }

  // --- Render ---------------------------------------------------------------

  function render() {
    if (state.token) {
      const editableNames = [...state.editable].map(nameOf).filter((n) => n !== "?");
      // find receiver of current displayName if it's a participant
      let receiverName = null;
      if (state.displayName) {
        const pidSelf = state.participants.find(p => p.name === state.displayName)?.id;
        if (pidSelf) receiverName = receiverOf(pidSelf);
      }
      els.greeting.innerHTML = `Hola, <strong>${escapeHtml(state.displayName || "")}</strong>.` +
        (receiverName
          ? ` Te tocó darle a <strong>${escapeHtml(receiverName)}</strong>.`
          : (editableNames.length
            ? ` Puedes editar: <strong>${editableNames.map(escapeHtml).join(", ")}</strong>.`
            : " No tienes permisos de edición."));
    } else {
      els.greeting.textContent = "Modo de solo lectura. Abre tu enlace personal para editar.";
    }

    els.app.innerHTML = "";
    if (state.participants.length === 0) {
      els.app.innerHTML = '<p class="empty">Todavía no hay participantes.</p>';
      return;
    }

    let listParticipants = [...state.participants];
    if (state.token && state.displayName) {
      const pidSelf = listParticipants.find(p => p.name === state.displayName)?.id;
      const pref = [];
      if (pidSelf) {
        const recv = receiverOf(pidSelf);
        const recvPid = listParticipants.find(p => p.name === recv)?.id;
        if (recvPid) {
          pref.push(listParticipants.find(p => p.id === recvPid));
          listParticipants = listParticipants.filter(p => p.id !== recvPid);
        }
        // add self if present and editable
        const selfP = listParticipants.find(p => p.id === pidSelf);
        if (selfP && state.editable.has(pidSelf)) {
          pref.push(selfP);
          listParticipants = listParticipants.filter(p => p.id !== pidSelf);
        }
        // add other editable
        for (const p of listParticipants.filter(p => state.editable.has(p.id))) {
          pref.push(p);
        }
        listParticipants = listParticipants.filter(p => !state.editable.has(p.id));
      }
      listParticipants = pref.concat(listParticipants);
    }
    for (const participant of listParticipants) {
      els.app.appendChild(renderCard(participant));
    }
    if (state.editable.size > 0) els.app.appendChild(renderSaveBar());
  }

  function renderCard(participant) {
    const pid = participant.id;
    const editable = state.editable.has(pid);
    const card = document.createElement("article");
    card.className = "card" + (editable ? " editable" : "");
    card.dataset.pid = pid;

    const head = document.createElement("div");
    head.className = "card-head";
    const h2 = document.createElement("h2");
    h2.textContent = participant.name;
    head.appendChild(h2);
    if (editable) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "editable";
      head.appendChild(badge);
    }
    card.appendChild(head);

    const receiver = receiverOf(pid);
    const assign = document.createElement("p");
    assign.className = "assignment";
    if (receiver) {
      assign.innerHTML = `Le regala a <strong>${escapeHtml(receiver)}</strong>`;
    } else {
      assign.innerHTML = 'Sin asignación';
    }
    card.appendChild(assign);

    // clarify: show context
    const list = document.createElement("ul");
    list.className = "options";
    if (editable) {
      // prepend context label
      const ctx = document.createElement("li");
      ctx.className = "empty";
      ctx.innerHTML = receiver ? `Opciones para <strong>${escapeHtml(receiver)}</strong>` : 'Edita tus opciones';
      list.appendChild(ctx);
      renderEditableOptions(list, pid);
    } else {
      const opts = optionsOf(pid);
      const ctx = document.createElement("li");
      ctx.className = "empty";
      ctx.innerHTML = `Opciones de <strong>${escapeHtml(participant.name)}</strong>`;
      list.appendChild(ctx);
      if (opts.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Sin opciones todavía.";
        list.appendChild(li);
      }
      for (const o of opts) {
        const li = document.createElement("li");
        li.textContent = o.text;
        list.appendChild(li);
      }
    }
    card.appendChild(list);

    if (editable) card.appendChild(renderCardActions(pid));
    return card;
  }

  function renderEditableOptions(list, pid) {
    const draft = draftFor(pid);
    if (draft.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Sin opciones todavía.";
      list.appendChild(li);
    }
    draft.forEach((item, index) => {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "row";

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 120;
      input.placeholder = "Opción de regalo";
      input.value = item.text;
      input.addEventListener("input", () => {
        draft[index].text = input.value;
        refreshPendingState();
      });

      const del = document.createElement("button");
      del.className = "danger ghost";
      del.type = "button";
      del.textContent = "Eliminar";
      del.addEventListener("click", () => {
        draft.splice(index, 1);
        render();
      });

      row.appendChild(input);
      row.appendChild(del);
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function renderCardActions(pid) {
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "+ Agregar opción";
    add.addEventListener("click", () => {
      draftFor(pid).push({ id: null, text: "" });
      render();
      const card = document.querySelector(`.card[data-pid="${pid}"]`);
      const inputs = card ? card.querySelectorAll('input[type="text"]') : [];
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    actions.appendChild(add);

    const pending = document.createElement("span");
    pending.className = "pending";
    pending.dataset.pid = pid;
    pending.textContent = "cambios sin guardar";
    pending.hidden = !hasPending(pid);
    actions.appendChild(pending);
    return actions;
  }

  function renderSaveBar() {
    const bar = document.createElement("div");
    bar.className = "save-bar";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "ghost";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", () => {
      const hadRemote = pendingRemote;
      state.drafts = {};
      pendingRemote = false;
      setStatus("");
      if (hadRemote) refresh();
      else render();
    });

    const save = document.createElement("button");
    save.type = "button";
    save.className = "primary";
    save.textContent = "Guardar";
    save.id = "save-button";
    save.disabled = !anyPending();
    save.addEventListener("click", () => saveAll(save));

    bar.appendChild(cancel);
    bar.appendChild(save);
    return bar;
  }

  function refreshPendingState() {
    const save = document.getElementById("save-button");
    if (save) save.disabled = !anyPending();
    document.querySelectorAll(".pending[data-pid]").forEach((el) => {
      el.hidden = !hasPending(el.dataset.pid);
    });
  }

  // --- Guardar --------------------------------------------------------------

  function operationsFor(pid) {
    const original = originalOptions(pid);
    const draft = draftFor(pid);
    const draftIds = new Set(draft.filter((d) => d.id).map((d) => d.id));
    const ops = [];
    for (const o of original) {
      if (!draftIds.has(o.id)) ops.push({ action: "delete", option_id: o.id });
    }
    for (const d of draft) {
      const text = d.text.trim();
      if (d.id) {
        const orig = original.find((o) => o.id === d.id);
        if (orig && orig.text !== text && text) ops.push({ action: "update", option_id: d.id, text });
      } else if (text) {
        ops.push({ action: "add", text });
      }
    }
    return ops;
  }

  async function saveAll(button) {
    const pids = Object.keys(state.drafts).filter((pid) => hasPending(pid));
    if (pids.length === 0) return;
    button.disabled = true;
    setStatus("Guardando…");
    try {
      for (const pid of pids) {
        for (const op of operationsFor(pid)) {
          await callFunction("options-write", { token: state.token, participant_id: pid, ...op });
        }
      }
      state.drafts = {};
      pendingRemote = false;
      await loadData();
      render();
      setStatus("Cambios guardados.", "ok");
    } catch (err) {
      setStatus(messageForError(err), "error");
      button.disabled = false;
    }
  }

  function messageForError(err) {
    switch (err.code) {
      case "invalid_session":
      case "expired_session":
        state.token = null;
        state.editable = new Set();
        localStorage.removeItem(TOKEN_KEY);
        return "Tu sesión expiró. Abre tu enlace de nuevo.";
      case "revoked_identity":
        state.token = null;
        state.editable = new Set();
        localStorage.removeItem(TOKEN_KEY);
        return "Este enlace fue revocado.";
      case "forbidden":
        return "No tienes permiso para editar a esa persona.";
      case "invalid_text":
        return "Las opciones deben tener entre 1 y 120 caracteres.";
      default:
        return "No se pudo guardar. Intenta de nuevo.";
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // --- Sincronización (Realtime con respaldo de sondeo) ---------------------

  function isEditing() {
    const el = document.activeElement;
    return !!el && el.tagName === "INPUT";
  }

  let syncMode = "";

  function setMode(mode) {
    syncMode = mode;
    setStatus(
      mode === "realtime"
        ? "Sincronización en tiempo real activa."
        : "Sincronización por sondeo activa.",
      mode === "realtime" ? "ok" : undefined,
    );
  }

  async function refresh() {
    try {
      state.drafts = {};
      pendingRemote = false;
      await loadData();
      render();
      if (syncMode) setMode(syncMode);
    } catch (_) {
      /* ignora errores transitorios */
    }
  }

  function onRemoteChange() {
    if (anyPending() || isEditing()) {
      pendingRemote = true;
      setStatus("Hay cambios nuevos de otros. Guarda o cancela para verlos.");
      return;
    }
    refresh();
  }

  function startSync() {
    if (syncStarted) return;
    syncStarted = true;

    if (!window.supabase) {
      startPolling();
      return;
    }

    let subscribed = false;
    const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    client
      .channel("gift_options_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "gift_options" }, (payload) => {
        console.log("[realtime] evento:", payload.eventType);
        onRemoteChange();
      })
      .subscribe((status) => {
        console.log("[realtime] estado:", status);
        if (status === "SUBSCRIBED") {
          subscribed = true;
          setMode("realtime");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!subscribed) startPolling();
        }
      });

    setTimeout(() => {
      if (!subscribed) startPolling();
    }, 8000);
  }

  function startPolling() {
    if (polling) return;
    polling = true;
    setMode("polling");
    setInterval(async () => {
      try {
        const options = await rest("gift_options?select=id,participant_id,position,text&order=participant_id,position");
        const sig = JSON.stringify(options);
        if (sig === state.sig) return;
        if (anyPending() || isEditing()) {
          pendingRemote = true;
          setStatus("Hay cambios nuevos de otros. Guarda o cancela para verlos.");
          return;
        }
        state.drafts = {};
        state.options = options;
        state.sig = sig;
        render();
        setMode("polling");
      } catch (_) {
        /* ignora errores transitorios */
      }
    }, 5000);
  }

  // --- Init -----------------------------------------------------------------

  async function init() {
    const credential = readCredential();
    try {
      if (credential) {
        await validateLink(credential);
        clearCredentialFromUrl();
      } else {
        await restoreSession();
      }
    } catch (err) {
      setStatus(messageForError(err), "error");
    }
    try {
      await loadData();
      render();
      startSync();
    } catch (err) {
      els.app.innerHTML = '<p class="empty">No se pudieron cargar los datos.</p>';
    }
  }

  document.addEventListener("focusout", () => {
    if (pendingRemote && !anyPending() && !isEditing()) onRemoteChange();
  });

  document.getElementById("refresh-button").addEventListener("click", () => {
    pendingRemote = false;
    setStatus("");
    refresh();
  });

  init();
})();
