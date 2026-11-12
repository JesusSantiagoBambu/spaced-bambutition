// Panel del profesor: lee (solo lectura) los datos que los alumnos guardan en la nube.
(function () {
  const cloud = window.BambuCloud;
  const $ = (selector) => document.querySelector(selector);
  const views = ["loginView", "notTeacherView", "setupView", "dashboardView", "studentView"];
  let students = [];
  let loginEmail = "";

  // ---------- Utilidades ----------

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
  const today = () => startOfDay(new Date());
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
  const dayDistance = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);
  const dateKey = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const fmtScore = (value) => (value === null || value === undefined ? "–" : Number(value).toLocaleString("es", { maximumFractionDigits: 1 }));
  const fmtDate = (date) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(date));
  const fmtDateTime = (date) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  const tone = (score) => (score === null || score === undefined ? "none" : score >= 7 ? "good" : score >= 5 ? "fragile" : "weak");
  const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  function relativeDays(date) {
    if (!date) return "Nunca";
    const diff = dayDistance(new Date(), date);
    if (diff <= 0) return "Hoy";
    if (diff === 1) return "Ayer";
    return `Hace ${diff} días`;
  }

  function show(view) {
    views.forEach((id) => { $(`#${id}`).hidden = id !== view; });
    window.scrollTo({ top: 0 });
  }

  function loginError(message) {
    $("#loginError").textContent = message;
    $("#loginError").hidden = !message;
  }

  // ---------- Analisis del estado de cada alumno ----------

  function analyze(profile, row) {
    const state = row?.state || {};
    const topics = Array.isArray(state.topics) ? state.topics : [];
    const history = Array.isArray(state.history) ? state.history : [];
    const completed = history.filter((item) => item.type === "completed" && typeof item.score === "number");
    const weekAgo = addDays(today(), -6);
    const monthAgo = addDays(today(), -29);
    const tomorrow = addDays(today(), 1);

    const topicRows = topics.map((topic) => {
      const reviews = (topic.reviews || []).filter((review) => review.completedAt && typeof review.score === "number")
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
      const pending = (topic.reviews || []).find((review) => !review.completedAt) || null;
      const due = pending ? new Date(pending.dueDate) : null;
      return {
        topic,
        reviews,
        pending,
        due,
        overdueDays: due && due < today() ? dayDistance(new Date(), due) : 0,
        dueToday: Boolean(due && due < tomorrow),
        avg: average(reviews.map((review) => review.score)),
        last: reviews[reviews.length - 1] || null,
      };
    });

    const activityDates = history.map((item) => item.completedAt || item.skippedAt).filter(Boolean).sort();
    const lastCompleted = state.lastCompletedDate || "";
    const streakAlive = lastCompleted === dateKey(new Date()) || lastCompleted === dateKey(addDays(new Date(), -1));

    return {
      id: profile.id,
      name: profile.display_name || "",
      email: profile.email || "",
      hasData: Boolean(row),
      syncedAt: row?.updated_at || null,
      points: Number(state.points) || 0,
      streak: streakAlive ? Number(state.streak) || 0 : 0,
      topics: topicRows,
      history,
      reviews7: completed.filter((item) => new Date(item.completedAt) >= weekAgo).length,
      skipped7: history.filter((item) => item.type === "skipped" && new Date(item.skippedAt) >= weekAgo).length,
      avg30: average(completed.filter((item) => new Date(item.completedAt) >= monthAgo).map((item) => item.score)),
      avgAll: average(completed.map((item) => item.score)),
      totalReviews: completed.length,
      overdue: topicRows.filter((item) => item.overdueDays > 0).length,
      dueToday: topicRows.filter((item) => item.dueToday).length,
      weak: topicRows.filter((item) => item.last && item.last.score < 5).length,
      lastActivity: activityDates[activityDates.length - 1] || null,
    };
  }

  // ---------- Carga ----------

  async function load() {
    $("#loadingText").hidden = false;
    try {
      const [profiles, states] = await Promise.all([
        cloud.auth.request("/rest/v1/profiles?select=id,email,display_name,role,created_at&role=eq.student&order=created_at.asc"),
        cloud.auth.request("/rest/v1/app_states?select=user_id,state,updated_at"),
      ]);
      const byUser = new Map((states || []).map((row) => [row.user_id, row]));
      students = (profiles || []).map((profile) => analyze(profile, byUser.get(profile.id)));
      students.sort((a, b) => (b.overdue - a.overdue) || ((b.lastActivity || "") > (a.lastActivity || "") ? 1 : -1));
      renderDashboard();
      show("dashboardView");
    } catch (error) {
      if (!cloud.auth.user()) return start();
      alert(`No se han podido cargar los datos: ${error.message}`);
    } finally {
      $("#loadingText").hidden = true;
    }
  }

  // ---------- Vista general ----------

  function renderDashboard() {
    const activeToday = students.filter((s) => s.lastActivity && dayDistance(new Date(), s.lastActivity) === 0).length;
    const reviews7 = students.reduce((sum, s) => sum + s.reviews7, 0);
    const withOverdue = students.filter((s) => s.overdue > 0).length;
    const avg = average(students.map((s) => s.avg30).filter((v) => v !== null));
    $("#teacherSummary").innerHTML = `
      <div class="stat"><span class="stat-label">👥 Alumnos con cuenta</span><strong>${students.length}</strong></div>
      <div class="stat"><span class="stat-label">✅ Han repasado hoy</span><strong>${activeToday}</strong></div>
      <div class="stat"><span class="stat-label">📚 Repasos en 7 días</span><strong>${reviews7}</strong></div>
      <div class="stat"><span class="stat-label">📈 Media últimos 30 días</span><strong>${fmtScore(avg)}</strong></div>
      <div class="stat"><span class="stat-label">⚠️ Con repasos atrasados</span><strong>${withOverdue}</strong></div>
    `;
    $("#studentCount").textContent = `${students.length}`;

    const list = $("#studentList");
    list.replaceChildren();
    if (!students.length) {
      list.innerHTML = `<div class="empty-state"><strong>Aún no hay alumnos con cuenta.</strong><span>Cuando un alumno entre con su correo desde la app (botón ☁️), aparecerá aquí.</span></div>`;
      return;
    }
    students.forEach((student) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `student-row${student.overdue ? " needs-attention" : ""}`;
      button.innerHTML = `
        <div class="student-id">
          <p class="card-title">${escapeHtml(student.name || student.email)}</p>
          <p class="card-meta">${student.name ? escapeHtml(student.email) + " · " : ""}Última actividad: ${relativeDays(student.lastActivity)}</p>
        </div>
        <div class="student-metrics">
          <span class="metric"><small>Racha</small><strong>${student.streak} d</strong></span>
          <span class="metric"><small>Repasos 7 d</small><strong>${student.reviews7}</strong></span>
          <span class="metric"><small>Media 30 d</small><strong class="score-chip tone-${tone(student.avg30)}">${fmtScore(student.avg30)}</strong></span>
          <span class="metric"><small>Temas</small><strong>${student.topics.length}</strong></span>
          <span class="metric"><small>Atrasados</small><strong class="${student.overdue ? "is-alert" : ""}">${student.overdue}</strong></span>
        </div>
      `;
      if (!student.hasData) button.querySelector(".card-meta").textContent = `${student.email} · Todavía no ha subido datos`;
      button.addEventListener("click", () => openStudent(student.id));
      list.append(button);
    });
  }

  // ---------- Detalle de alumno ----------

  function openStudent(id) {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    const detail = $("#studentDetail");
    const topics = student.topics.slice().sort((a, b) => (b.overdueDays - a.overdueDays) || ((a.due || 0) - (b.due || 0)));
    const recent = student.history.filter((item) => item.type === "completed" || item.type === "skipped").slice(0, 25);

    detail.innerHTML = `
      <section class="panel student-header">
        <div>
          <h2>${escapeHtml(student.name || student.email)}</h2>
          <p class="card-meta">${escapeHtml(student.email)} · Última copia: ${student.syncedAt ? fmtDateTime(student.syncedAt) : "nunca"}</p>
        </div>
        <div class="detail-metrics teacher-metrics">
          <div><span>Puntos</span><strong>${student.points}</strong></div>
          <div><span>Racha</span><strong>${student.streak} d</strong></div>
          <div><span>Repasos hechos</span><strong>${student.totalReviews}</strong></div>
          <div><span>Media total</span><strong>${fmtScore(student.avgAll)}</strong></div>
          <div><span>Saltados 7 d</span><strong>${student.skipped7}</strong></div>
          <div><span>Atrasados</span><strong class="${student.overdue ? "is-alert" : ""}">${student.overdue}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Temas</h2><span class="count-pill">${topics.length}</span></div>
        ${topics.length ? `<div class="teacher-topics">${topics.map((row) => topicRowHtml(row)).join("")}</div>` : `<div class="empty-state"><strong>Sin temas todavía.</strong></div>`}
      </section>

      <section class="panel">
        <div class="section-title"><h2>Actividad reciente</h2></div>
        ${recent.length ? `<ol class="note-list">${recent.map((item) => activityHtml(item, student)).join("")}</ol>` : `<div class="empty-state"><strong>Sin actividad todavía.</strong></div>`}
      </section>
    `;
    detail.querySelectorAll(".teacher-topic-head").forEach((head) => {
      head.addEventListener("click", () => {
        const item = head.closest(".teacher-topic");
        const open = item.classList.toggle("is-open");
        head.setAttribute("aria-expanded", String(open));
      });
    });
    show("studentView");
  }

  function topicRowHtml(row) {
    const { topic } = row;
    const next = !row.pending
      ? "Al día"
      : row.overdueDays > 0
        ? `<span class="badge warning">Atrasado ${row.overdueDays} d</span>`
        : row.dueToday ? `<span class="badge brand">Hoy</span>` : fmtDate(row.due);
    return `
      <article class="teacher-topic${topic.hardcore ? " is-hardcore" : ""}">
        <button type="button" class="teacher-topic-head" aria-expanded="false">
          <span class="teacher-topic-name">
            <span class="topic-name${topic.hardcore ? " is-hardcore" : ""}">${topic.hardcore ? "🔥" : "📘"} ${escapeHtml(topic.title)}</span>
            <small>${escapeHtml(topic.subject || "")}</small>
          </span>
          <span class="metric"><small>Repasos</small><strong>${row.reviews.length}</strong></span>
          <span class="metric"><small>Media</small><strong class="score-chip tone-${tone(row.avg)}">${fmtScore(row.avg)}</strong></span>
          <span class="metric"><small>Última</small><strong class="score-chip tone-${tone(row.last?.score)}">${fmtScore(row.last?.score)}</strong></span>
          <span class="metric"><small>Próximo</small><strong>${next}</strong></span>
        </button>
        <div class="teacher-topic-body">
          ${row.reviews.length ? `<ol class="note-list">${row.reviews.slice().reverse().map((review) => `
            <li class="note-item">
              <span class="note-score tone-${tone(review.score)}">${fmtScore(review.score)}</span>
              <div>
                <p class="note-meta">Repaso ${review.step} · ${fmtDateTime(review.completedAt)}</p>
                <p class="note-text${review.note ? "" : " is-empty"}">${review.note ? escapeHtml(review.note) : "Sin comentario"}</p>
              </div>
            </li>`).join("")}</ol>` : `<p class="note-empty">Todavía no ha hecho ningún repaso de este tema.</p>`}
        </div>
      </article>
    `;
  }

  function activityHtml(item, student) {
    if (item.type === "skipped") {
      return `<li class="note-item"><span class="note-score tone-weak">⏭️</span><div><p class="note-meta">${fmtDateTime(item.skippedAt)}</p><p class="note-text">Saltó un repaso de <strong>${escapeHtml(item.topic)}</strong></p></div></li>`;
    }
    const topicRow = student.topics.find((row) => row.topic.id === item.topicId);
    const review = topicRow?.reviews.find((entry) => entry.completedAt === item.completedAt);
    const note = review?.note ? `<br />${escapeHtml(review.note)}` : "";
    return `<li class="note-item"><span class="note-score tone-${tone(item.score)}">${fmtScore(item.score)}</span><div><p class="note-meta">${fmtDateTime(item.completedAt)}${item.daysLate ? ` · con ${item.daysLate} d de retraso` : ""}</p><p class="note-text"><strong>${escapeHtml(item.topic)}</strong>${note}</p></div></li>`;
  }

  // ---------- Inicio de sesion ----------

  async function start() {
    if (!cloud?.auth.enabled) return show("setupView");
    const user = cloud.auth.user();
    $("#teacherAccount").hidden = !user;
    if (!user) {
      $("#loginEmailForm").hidden = false;
      $("#loginCodeForm").hidden = true;
      loginError("");
      return show("loginView");
    }
    $("#teacherEmail").textContent = user.email || "";
    try {
      const profile = await cloud.auth.getProfile();
      if (profile?.role !== "teacher") {
        $("#notTeacherEmail").textContent = user.email || "";
        return show("notTeacherView");
      }
      await load();
    } catch (error) {
      if (!cloud.auth.user()) return start();
      loginError(error.message);
      show("loginView");
    }
  }

  $("#loginEmailForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    loginEmail = $("#loginEmailInput").value.trim().toLowerCase();
    const button = $("#loginSendBtn");
    button.disabled = true;
    try {
      await cloud.auth.sendCode(loginEmail, { createUser: false });
      $("#loginEmailEcho").textContent = loginEmail;
      $("#loginEmailForm").hidden = true;
      $("#loginCodeForm").hidden = false;
      loginError("");
      $("#loginCodeInput").focus();
    } catch (error) {
      loginError(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#loginCodeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("#loginVerifyBtn");
    button.disabled = true;
    try {
      await cloud.auth.verifyCode(loginEmail, $("#loginCodeInput").value.replace(/\D/g, ""));
      await start();
    } catch (error) {
      loginError(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#loginBackBtn").addEventListener("click", () => {
    $("#loginEmailForm").hidden = false;
    $("#loginCodeForm").hidden = true;
  });

  const signOut = async () => {
    await cloud.auth.signOut();
    start();
  };
  $("#signOutBtn").addEventListener("click", signOut);
  $("#notTeacherSignOut").addEventListener("click", signOut);
  $("#refreshBtn").addEventListener("click", load);
  $("#backBtn").addEventListener("click", () => show("dashboardView"));

  start();
})();
