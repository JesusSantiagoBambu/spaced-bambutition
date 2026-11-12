// Spaced Bambutition: cuenta opcional y copia en la nube (Supabase) sin librerias externas.
// Si url o key estan vacios, la nube queda desactivada y la app funciona solo en local.
(function () {
  const config = {
    url: "https://tfcevuazvniujzpsmqfb.supabase.co",
    key: "sb_publishable_Evf2YCQUCfXZ-R0VCkRPzw_FOQhbo23",
  };

  const SESSION_KEY = "spaced-bambutition-auth";
  const META_KEY = "spaced-bambutition-sync";
  const APP_VERSION = "2026-11";
  const enabled = Boolean(config.url && config.key);

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  class CloudError extends Error {
    constructor(message, code, status) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  // ---------- Sesion ----------

  let session = readJson(SESSION_KEY);
  let refreshing = null;
  const authListeners = new Set();

  function setSession(next) {
    session = next;
    writeJson(SESSION_KEY, next);
    authListeners.forEach((listener) => listener(currentUser()));
  }

  function currentUser() {
    return session?.user || null;
  }

  function sessionFromAuthResponse(data) {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || now + (Number(data.expires_in) || 3600),
      user: { id: data.user?.id, email: data.user?.email },
    };
  }

  async function getAccessToken() {
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at - 60 > now) return session.access_token;
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const data = await raw("/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            body: { refresh_token: session.refresh_token },
            auth: false,
          });
          setSession(sessionFromAuthResponse(data));
          return session.access_token;
        } catch (error) {
          if (error.status === 400 || error.status === 401 || error.status === 403) setSession(null);
          throw error;
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  // ---------- Peticiones ----------

  async function raw(path, { method = "GET", body, auth = true, headers = {} } = {}) {
    if (!enabled) throw new CloudError("La nube no está configurada.", "disabled");
    const requestHeaders = { apikey: config.key, "Content-Type": "application/json", ...headers };
    if (auth) {
      const token = await getAccessToken();
      if (!token) throw new CloudError("Inicia sesión para guardar en la nube.", "no-session");
      requestHeaders.Authorization = `Bearer ${token}`;
    }
    let response;
    try {
      response = await fetch(`${config.url}${path}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new CloudError("Sin conexión. Se guardará cuando vuelvas a tener internet.", "offline");
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message = data?.msg || data?.error_description || data?.message || data?.error || `Error ${response.status}`;
      throw new CloudError(message, data?.error_code || data?.code || "http", response.status);
    }
    return data;
  }

  function translateAuthError(error) {
    const text = String(error.message || "").toLowerCase();
    if (error.code === "offline") return error.message;
    if (text.includes("expired") || text.includes("invalid") || error.code === "otp_expired") return "El código no es válido o ha caducado. Pide uno nuevo.";
    if (text.includes("signup") || text.includes("not found") || error.code === "otp_disabled") return "Ese correo no tiene cuenta. Entra primero desde la app con ese correo.";
    if (text.includes("rate") || error.status === 429) return "Has pedido demasiados códigos seguidos. Espera un minuto y vuelve a intentarlo.";
    if (text.includes("email")) return "Revisa que el correo esté bien escrito.";
    return "No se ha podido completar. Inténtalo de nuevo en unos segundos.";
  }

  const auth = {
    enabled,
    user: currentUser,
    onChange(listener) {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },
    async sendCode(email, { createUser = true } = {}) {
      try {
        await raw("/auth/v1/otp", { method: "POST", auth: false, body: { email, create_user: createUser } });
      } catch (error) {
        throw new CloudError(translateAuthError(error), error.code, error.status);
      }
    },
    async verifyCode(email, token) {
      try {
        const data = await raw("/auth/v1/verify", { method: "POST", auth: false, body: { type: "email", email, token } });
        setSession(sessionFromAuthResponse(data));
        return currentUser();
      } catch (error) {
        throw new CloudError(translateAuthError(error), error.code, error.status);
      }
    },
    async signOut() {
      try {
        if (session) await raw("/auth/v1/logout", { method: "POST" });
      } catch {}
      setSession(null);
      writeJson(META_KEY, null);
    },
    async getProfile() {
      const user = currentUser();
      if (!user) return null;
      const rows = await raw(`/rest/v1/profiles?id=eq.${user.id}&select=display_name,role,email`);
      return rows?.[0] || null;
    },
    async updateName(displayName) {
      const user = currentUser();
      if (!user) return;
      await raw(`/rest/v1/profiles?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: { display_name: displayName },
      });
    },
    request: raw,
  };

  // ---------- Sincronizacion de la app del alumno ----------

  let hooks = null;
  let meta = readJson(META_KEY) || { remoteUpdatedAt: null, dirty: false, localChangedAt: null, lastSyncAt: null };
  let pushTimer = null;
  let syncing = null;
  let status = { state: enabled ? (session ? "idle" : "signed-out") : "disabled", message: "" };

  function saveMeta() {
    writeJson(META_KEY, meta);
  }

  function setStatus(state, message = "") {
    status = { state, message, lastSyncAt: meta.lastSyncAt };
    hooks?.onStatus?.(status);
  }

  function summarize(stateData) {
    const topics = Array.isArray(stateData?.topics) ? stateData.topics : [];
    const history = Array.isArray(stateData?.history) ? stateData.history : [];
    const reviews = history.filter((item) => item.type === "completed").length;
    const dates = history.map((item) => item.completedAt || item.skippedAt || item.redeemedAt).filter(Boolean).sort();
    return { topics: topics.length, reviews, lastActivity: dates[dates.length - 1] || null, points: Number(stateData?.points) || 0 };
  }

  function hasMeaningfulData(stateData) {
    const summary = summarize(stateData);
    return summary.topics > 0 || summary.reviews > 0 || (Array.isArray(stateData?.ivyTasks) && stateData.ivyTasks.length > 0);
  }

  async function fetchRemote() {
    const user = currentUser();
    const rows = await raw(`/rest/v1/app_states?user_id=eq.${user.id}&select=state,updated_at,client_updated_at`);
    return rows?.[0] || null;
  }

  async function push() {
    const user = currentUser();
    if (!user) return;
    const localChangedAt = meta.localChangedAt || new Date().toISOString();
    const rows = await raw("/rest/v1/app_states?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: { user_id: user.id, state: hooks.getState(), client_updated_at: localChangedAt, app_version: APP_VERSION },
    });
    meta.remoteUpdatedAt = rows?.[0]?.updated_at || meta.remoteUpdatedAt;
    if (meta.localChangedAt === localChangedAt) meta.dirty = false;
    meta.lastSyncAt = new Date().toISOString();
    saveMeta();
  }

  function applyRemote(remote) {
    hooks.applyRemote(remote.state);
    meta.remoteUpdatedAt = remote.updated_at;
    meta.dirty = false;
    meta.localChangedAt = remote.client_updated_at || remote.updated_at;
    meta.lastSyncAt = new Date().toISOString();
    saveMeta();
  }

  async function reconcile() {
    const remote = await fetchRemote();
    if (!remote) {
      await push();
      return;
    }
    if (meta.remoteUpdatedAt && remote.updated_at === meta.remoteUpdatedAt) {
      if (meta.dirty) await push();
      else {
        meta.lastSyncAt = new Date().toISOString();
        saveMeta();
      }
      return;
    }

    const local = hooks.getState();
    const firstTimeHere = !meta.remoteUpdatedAt;
    const localHasData = hasMeaningfulData(local);
    const remoteHasData = hasMeaningfulData(remote.state);

    if (!remoteHasData && localHasData) {
      await push();
      return;
    }
    if (!localHasData || (!firstTimeHere && !meta.dirty)) {
      applyRemote(remote);
      return;
    }
    // Hay datos distintos aqui y en la nube: decide el alumno.
    const choice = await hooks.onConflict({
      local: { ...summarize(local), changedAt: meta.localChangedAt },
      remote: { ...summarize(remote.state), changedAt: remote.client_updated_at || remote.updated_at },
    });
    if (choice === "local") await push();
    else applyRemote(remote);
  }

  function sync() {
    if (!enabled || !currentUser()) return Promise.resolve();
    if (syncing) return syncing;
    setStatus("syncing");
    syncing = reconcile()
      .then(() => setStatus("synced"))
      .catch((error) => {
        if (!currentUser()) setStatus("signed-out");
        else setStatus(error.code === "offline" ? "offline" : "error", error.message);
      })
      .finally(() => {
        syncing = null;
      });
    return syncing;
  }

  function schedulePush(delay = 2500) {
    if (!enabled || !currentUser()) return;
    clearTimeout(pushTimer);
    setStatus("pending");
    pushTimer = setTimeout(() => {
      if (syncing) return schedulePush(1500);
      setStatus("syncing");
      syncing = push()
        .then(() => setStatus("synced"))
        .catch((error) => setStatus(error.code === "offline" ? "offline" : "error", error.message))
        .finally(() => {
          syncing = null;
        });
    }, delay);
  }

  const sync$ = {
    enabled,
    status: () => status,
    init(nextHooks) {
      hooks = nextHooks;
      if (!enabled) return;
      auth.onChange((user) => {
        if (!user) setStatus("signed-out");
      });
      window.addEventListener("online", () => sync());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") sync();
      });
      setStatus(currentUser() ? "idle" : "signed-out");
      if (currentUser()) sync();
    },
    markDirty() {
      meta.dirty = true;
      meta.localChangedAt = new Date().toISOString();
      saveMeta();
      schedulePush();
    },
    syncNow: sync,
    async afterSignIn() {
      meta = { remoteUpdatedAt: null, dirty: true, localChangedAt: meta.localChangedAt || new Date().toISOString(), lastSyncAt: null };
      saveMeta();
      await sync();
    },
  };

  window.BambuCloud = { auth, sync: sync$, CloudError };
})();
