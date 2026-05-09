const curveDays = [1, 3, 7, 14, 30, 60, 120];
const dailyReviewLimit = 3;
const ivyTaskLimit = 6;
const ivyPointsPerPomodoro = 5;
const ivyDifficulties = {
  green: { label: "Fácil", emoji: "🟢", className: "green", multiplier: 1, weight: 1 },
  yellow: { label: "Media", emoji: "🟡", className: "yellow", multiplier: 1.2, weight: 2 },
  red: { label: "Difícil", emoji: "🔴", className: "red", multiplier: 1.5, weight: 3 },
};
const storageKey = "spaced-bambutition-state-v1";
const topicPanelStateKey = "spaced-bambutition-topic-panel-collapsed";
const legacyStorageKeys = ["repaso10-state-v7"];
const skipProfile = { label: "Rescate", factor: 0.5, easeDelta: -0.14, masteryDelta: -6 };
const scoreProfiles = [
  { min: 9, label: "Excelente", factor: 1.35, easeDelta: 0.08, masteryDelta: 12 },
  { min: 7, label: "Bien fijado", factor: 1.1, easeDelta: 0.03, masteryDelta: 7 },
  { min: 5, label: "Fragil", factor: 0.78, easeDelta: -0.08, masteryDelta: 1 },
  { min: 0, label: "Refuerzo", factor: 0.45, easeDelta: -0.16, masteryDelta: -8 },
];

const state = loadState();
let activeReviewId = null;
let lastNotificationKey = "";
let deferredInstallPrompt = null;

const els = {
  pointsStat: document.querySelector("#pointsStat"),
  streakStat: document.querySelector("#streakStat"),
  levelStat: document.querySelector("#levelStat"),
  todayStat: document.querySelector("#todayStat"),
  loadStat: document.querySelector("#loadStat"),
  dueCount: document.querySelector("#dueCount"),
  dueList: document.querySelector("#dueList"),
  ivyCount: document.querySelector("#ivyCount"),
  ivyStats: document.querySelector("#ivyStats"),
  ivyForm: document.querySelector("#ivyForm"),
  ivyTaskInput: document.querySelector("#ivyTaskInput"),
  ivyPomodoroInput: document.querySelector("#ivyPomodoroInput"),
  ivyDifficultyInput: document.querySelector("#ivyDifficultyInput"),
  ivyList: document.querySelector("#ivyList"),
  calendarList: document.querySelector("#calendarList"),
  progressList: document.querySelector("#progressList"),
  averageScore: document.querySelector("#averageScore"),
  rewardPoints: document.querySelector("#rewardPoints"),
  rewardList: document.querySelector("#rewardList"),
  curveChips: document.querySelector("#curveChips"),
  topicPanel: document.querySelector("#topicPanel"),
  topicPanelBody: document.querySelector("#topicPanelBody"),
  topicPanelToggle: document.querySelector("#topicPanelToggle"),
  topicForm: document.querySelector("#topicForm"),
  subjectOptions: document.querySelector("#subjectOptions"),
  rewardForm: document.querySelector("#rewardForm"),
  reviewDialog: document.querySelector("#reviewDialog"),
  reviewForm: document.querySelector("#reviewForm"),
  reviewSubject: document.querySelector("#reviewSubject"),
  reviewTitle: document.querySelector("#reviewTitle"),
  scoreInput: document.querySelector("#scoreInput"),
  scoreOutput: document.querySelector("#scoreOutput"),
  noteInput: document.querySelector("#noteInput"),
  closeReview: document.querySelector("#closeReview"),
  notifyBtn: document.querySelector("#notifyBtn"),
  installBtn: document.querySelector("#installBtn"),
};

document.querySelector("#dateInput").valueAsDate = new Date();

curveDays.forEach((day) => {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = day === 1 ? "24 horas" : `${day} dias`;
  els.curveChips.append(chip);
});

els.topicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.topicForm);
  const studiedAt = parseDate(form.get("firstDate"));
  const subject = form.get("subject").trim();
  const topic = {
    id: crypto.randomUUID(),
    subject,
    title: form.get("topic").trim(),
    createdAt: new Date().toISOString(),
    studiedAt: studiedAt.toISOString(),
    ease: 1,
    mastery: 0,
    reviews: buildReviews(studiedAt),
  };

  rememberSubject(subject);
  state.topics.unshift(topic);
  balanceUpcomingLoad();
  saveState();
  els.topicForm.reset();
  document.querySelector("#dateInput").valueAsDate = new Date();
  setTopicPanelCollapsed(true);
  render();
});

els.rewardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#rewardName").value.trim();
  const cost = Number(document.querySelector("#rewardCost").value);
  state.rewards.unshift({ id: crypto.randomUUID(), name, cost, redeemed: false });
  saveState();
  els.rewardForm.reset();
  document.querySelector("#rewardCost").value = 100;
  render();
});

els.scoreInput.addEventListener("input", () => {
  els.scoreOutput.textContent = els.scoreInput.value;
});

els.closeReview.addEventListener("click", () => {
  els.reviewDialog.close();
});

els.reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  completeReview(activeReviewId, Number(els.scoreInput.value), els.noteInput.value.trim());
  els.reviewDialog.close();
});

els.notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Este navegador no admite notificaciones.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    notifyDueReviews(true);
  }
});

els.installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.hidden = true;
});

els.ivyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addIvyTask();
});

els.topicPanelToggle.addEventListener("click", () => {
  setTopicPanelCollapsed(!els.topicPanel.classList.contains("is-collapsed"));
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBtn.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  els.installBtn.hidden = true;
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .view").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.view}View`).classList.add("active");
  });
});

setInterval(() => notifyDueReviews(false), 60_000);
registerServiceWorker();
cleanupOldCompletedIvyTasks();
setTopicPanelCollapsed(localStorage.getItem(topicPanelStateKey) === "true");
render();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  }).catch(() => {});
}

function loadState() {
  const saved = localStorage.getItem(storageKey) || legacyStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) return normalizeState({});
  try {
    const restoredState = normalizeState(JSON.parse(saved));
    localStorage.setItem(storageKey, JSON.stringify(restoredState));
    return restoredState;
  } catch {
    return normalizeState({});
  }
}

function setTopicPanelCollapsed(isCollapsed) {
  els.topicPanel.classList.toggle("is-collapsed", isCollapsed);
  els.topicPanelBody.hidden = isCollapsed;
  els.topicPanelToggle.textContent = isCollapsed ? "Mostrar" : "Ocultar";
  els.topicPanelToggle.setAttribute("aria-expanded", String(!isCollapsed));
  localStorage.setItem(topicPanelStateKey, String(isCollapsed));
}

function normalizeState(raw) {
  const topics = Array.isArray(raw.topics) ? raw.topics.map(normalizeTopic) : [];
  return {
    points: Math.max(0, Number(raw.points) || 0),
    streak: Number(raw.streak) || 0,
    lastCompletedDate: raw.lastCompletedDate || "",
    subjects: normalizeSubjects(raw.subjects, topics),
    topics,
    rewards: Array.isArray(raw.rewards) && raw.rewards.length ? raw.rewards : makeInitialRewards(),
    ivyTasks: Array.isArray(raw.ivyTasks) ? raw.ivyTasks.map(normalizeIvyTask) : [],
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function normalizeSubjects(subjects, topics) {
  const topicSubjects = topics.map((topic) => topic.subject);
  const savedSubjects = Array.isArray(subjects) ? subjects : [];
  return Array.from(new Set([...savedSubjects, ...topicSubjects].map((item) => String(item || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function normalizeTopic(topic) {
  const studiedAt = topic.studiedAt || topic.createdAt || new Date().toISOString();
  return {
    id: topic.id || crypto.randomUUID(),
    subject: topic.subject || "Sin asignatura/oposición",
    title: topic.title || "Tema sin titulo",
    createdAt: topic.createdAt || new Date().toISOString(),
    studiedAt,
    ease: clamp(Number(topic.ease) || 1, 0.55, 1.85),
    mastery: clamp(Number(topic.mastery) || 0, 0, 100),
    reviews: Array.isArray(topic.reviews)
      ? topic.reviews.map((review, index) => normalizeReview(review, index, studiedAt))
      : buildReviews(new Date(studiedAt)),
  };
}

function normalizeReview(review, index, studiedAt) {
  const baseDay = Number(review.baseDay ?? curveDays[index] ?? (index + 1) * 7);
  return {
    id: review.id || crypto.randomUUID(),
    step: Number(review.step) || index + 1,
    baseDay,
    intervalDays: Number(review.intervalDays) || baseDay,
    dueDate: review.dueDate || addDays(new Date(studiedAt), baseDay).toISOString(),
    completedAt: review.completedAt || "",
    skippedAt: review.skippedAt || "",
    skipCount: Number(review.skipCount) || 0,
    score: review.score === null || review.score === undefined ? null : Number(review.score),
    note: review.note || "",
    points: Number(review.points) || 0,
    adjusted: Boolean(review.adjusted),
    adjustmentReason: review.adjustmentReason || "",
  };
}

function makeInitialRewards() {
  return [
    { id: crypto.randomUUID(), name: "🎬 Ver un capitulo", cost: 80, redeemed: false },
    { id: crypto.randomUUID(), name: "🌿 Plan especial de descanso", cost: 180, redeemed: false },
  ];
}

function normalizeIvyTask(task) {
  const difficulty = ivyDifficulties[task.difficulty] ? task.difficulty : "yellow";
  return {
    id: task.id || crypto.randomUUID(),
    date: task.date || dateKey(new Date()),
    title: String(task.title || "Tarea sin titulo").trim(),
    pomodoros: clamp(Number(task.pomodoros) || 1, 1, 8),
    difficulty,
    completedAt: task.completedAt || "",
    points: Number(task.points) || 0,
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function rememberSubject(subject) {
  const value = String(subject || "").trim();
  if (!value) return;
  const exists = state.subjects.some((item) => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"));
  if (!exists) {
    state.subjects.push(value);
    state.subjects.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }
}

function renderSubjectOptions() {
  els.subjectOptions.replaceChildren();
  state.subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    els.subjectOptions.append(option);
  });
}

function buildReviews(studiedAt) {
  const start = atReviewTime(studiedAt);
  return curveDays.map((days, index) => ({
    id: crypto.randomUUID(),
    step: index + 1,
    baseDay: days,
    intervalDays: days,
    dueDate: addDays(start, days).toISOString(),
    completedAt: "",
    skippedAt: "",
    skipCount: 0,
    score: null,
    note: "",
    points: 0,
    adjusted: false,
    adjustmentReason: "",
  }));
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 9, 0, 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return atReviewTime(next);
}

function atReviewTime(date) {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfToday() {
  return startOfDay(new Date());
}

function dateKey(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDistance(fromDate, toDate) {
  return Math.round((startOfDay(fromDate) - startOfDay(toDate)) / 86_400_000);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function reviewItems() {
  return state.topics.flatMap((topic) => topic.reviews.map((review) => ({ review, topic })));
}

function allReviews() {
  return reviewItems().map(({ review, topic }) => ({ ...review, review, topic }));
}

function dueReviews() {
  const tomorrow = addDays(startOfToday(), 1);
  return allReviews()
    .filter((item) => !item.completedAt && new Date(item.dueDate) < tomorrow)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function findReview(reviewId) {
  for (const topic of state.topics) {
    const review = topic.reviews.find((item) => item.id === reviewId);
    if (review) return { topic, review };
  }
  return null;
}

function completeReview(reviewId, score, note) {
  const found = findReview(reviewId);
  if (!found) return;

  const { topic, review } = found;
  const completedAt = new Date();
  const dueDate = new Date(review.dueDate);
  const daysLate = Math.max(0, dayDistance(completedAt, dueDate));
  const isOnTime = daysLate === 0;
  const latenessPenalty = Math.min(10, daysLate * 2);
  const points = Math.max(4, 10 + Math.round(score * 2) + (isOnTime ? 8 : 0) + streakBonus() - latenessPenalty);
  const profile = getScoreProfile(score);

  review.completedAt = completedAt.toISOString();
  review.score = score;
  review.note = note;
  review.points = points;
  review.adjusted = true;
  review.adjustmentReason = `${profile.label}: curva adaptada`;
  state.points += points;

  updateTopicMemory(topic, profile);
  replanFutureReviews(topic, review, { score, anchorDate: completedAt, skipped: false });
  balanceUpcomingLoad();
  updateStreak(completedAt);
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "completed",
    topicId: topic.id,
    topic: topic.title,
    subject: topic.subject,
    score,
    points,
    daysLate,
    profile: profile.label,
    completedAt: completedAt.toISOString(),
  });

  activeReviewId = null;
  saveState();
  render();
}

function skipReview(reviewId) {
  const found = findReview(reviewId);
  if (!found) return;

  const { topic, review } = found;
  const skippedAt = new Date();
  const penalty = Math.min(12, 5 + review.skipCount * 2);
  const rescueDate = addDays(startOfToday(), 1);

  state.points = Math.max(0, state.points - penalty);
  review.skipCount += 1;
  review.skippedAt = skippedAt.toISOString();
  review.dueDate = rescueDate.toISOString();
  review.adjusted = true;
  review.adjustmentReason = `Rescate por repaso saltado: -${penalty} puntos`;

  updateTopicMemory(topic, skipProfile);
  replanFutureReviews(topic, review, { score: 3, anchorDate: rescueDate, skipped: true });
  balanceUpcomingLoad();
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "skipped",
    topicId: topic.id,
    topic: topic.title,
    subject: topic.subject,
    penalty,
    skippedAt: skippedAt.toISOString(),
  });

  saveState();
  render();
}

function deleteTopic(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic) return;
  const confirmed = confirm(`¿Borrar "${topic.title}" y todos sus repasos de la app?`);
  if (!confirmed) return;

  state.topics = state.topics.filter((item) => item.id !== topicId);
  state.history = state.history.filter((item) => item.topicId !== topicId);
  recomputePointsFromHistory();
  recomputeStreakFromHistory();
  balanceUpcomingLoad();
  saveState();
  render();
}

function deleteReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward) return;
  const confirmed = confirm(`¿Borrar la recompensa "${reward.name}"?`);
  if (!confirmed) return;

  state.rewards = state.rewards.filter((item) => item.id !== rewardId);
  recomputePointsFromHistory();
  saveState();
  render();
}

function recomputePointsFromHistory() {
  const earned = state.history.reduce((sum, item) => {
    if (item.type === "completed") return sum + (Number(item.points) || 0);
    if (item.type === "ivy") return sum + (Number(item.points) || 0);
    if (item.type === "skipped") return sum - (Number(item.penalty) || 0);
    return sum;
  }, 0);
  const spent = state.rewards.reduce((sum, reward) => sum + (reward.redeemed ? Number(reward.cost) || 0 : 0), 0);
  state.points = Math.max(0, earned - spent);
}

function recomputeStreakFromHistory() {
  const completionDays = Array.from(new Set(
    state.history
      .filter((item) => item.type === "completed" && item.completedAt)
      .map((item) => dateKey(item.completedAt))
  )).sort();

  if (!completionDays.length) {
    state.streak = 0;
    state.lastCompletedDate = "";
    return;
  }

  let streak = 1;
  let cursor = completionDays[completionDays.length - 1];
  for (let index = completionDays.length - 2; index >= 0; index -= 1) {
    const expectedPrevious = dateKey(addDays(parseDate(cursor), -1));
    if (completionDays[index] !== expectedPrevious) break;
    streak += 1;
    cursor = completionDays[index];
  }

  state.streak = streak;
  state.lastCompletedDate = completionDays[completionDays.length - 1];
}

function getScoreProfile(score) {
  return scoreProfiles.find((profile) => score >= profile.min) || scoreProfiles[scoreProfiles.length - 1];
}

function updateTopicMemory(topic, profile) {
  topic.ease = clamp((topic.ease || 1) + profile.easeDelta, 0.55, 1.85);
  topic.mastery = clamp((topic.mastery || 0) + profile.masteryDelta, 0, 100);
}

function replanFutureReviews(topic, anchorReview, options) {
  const profile = options.skipped ? skipProfile : getScoreProfile(options.score);
  const futureReviews = topic.reviews
    .filter((review) => !review.completedAt && review.step > anchorReview.step)
    .sort((a, b) => a.step - b.step);

  if (!futureReviews.length) return;

  let dateCursor = atReviewTime(options.anchorDate);
  let previousBaseDay = anchorReview.baseDay || curveDays[anchorReview.step - 1] || 1;

  futureReviews.forEach((review, index) => {
    const baseGap = Math.max(1, (review.baseDay || previousBaseDay + 1) - previousBaseDay);
    let gap = Math.max(1, Math.round(baseGap * profile.factor * (topic.ease || 1)));

    if (options.skipped) gap = Math.max(1, Math.round(baseGap * skipProfile.factor));
    if (!options.skipped && options.score < 5 && index === 0) gap = 1;
    if (!options.skipped && options.score >= 9 && index === 0) gap = Math.max(2, gap);

    dateCursor = addDays(dateCursor, gap);
    review.dueDate = dateCursor.toISOString();
    review.intervalDays = gap;
    review.adjusted = true;
    review.adjustmentReason = options.skipped ? "Reajustado por repaso saltado" : `${profile.label}: curva adaptada`;
    previousBaseDay = review.baseDay || previousBaseDay + gap;
  });
}

function balanceUpcomingLoad() {
  const today = startOfToday();
  const loads = new Map();
  const topicLastDate = new Map();
  const pending = reviewItems()
    .filter(({ review }) => !review.completedAt && new Date(review.dueDate) >= today)
    .sort((a, b) => new Date(a.review.dueDate) - new Date(b.review.dueDate) || a.review.step - b.review.step);

  pending.forEach(({ review, topic }) => {
    let dueDate = atReviewTime(review.dueDate);
    const previousTopicDate = topicLastDate.get(topic.id);
    if (previousTopicDate && dueDate <= previousTopicDate) {
      dueDate = addDays(previousTopicDate, 1);
    }

    let key = dateKey(dueDate);
    while ((loads.get(key) || 0) >= dailyReviewLimit) {
      dueDate = addDays(dueDate, 1);
      key = dateKey(dueDate);
    }

    if (dateKey(review.dueDate) !== key) {
      review.dueDate = dueDate.toISOString();
      review.adjusted = true;
      review.adjustmentReason = "Movido para equilibrar carga diaria";
    }

    loads.set(key, (loads.get(key) || 0) + 1);
    topicLastDate.set(topic.id, dueDate);
  });
}

function streakBonus() {
  return Math.min(10, Math.floor(state.streak / 3) * 2);
}

function updateStreak(date) {
  const todayKey = dateKey(date);
  if (state.lastCompletedDate === todayKey) return;
  const yesterdayKey = dateKey(addDays(date, -1));
  state.streak = state.lastCompletedDate === yesterdayKey ? state.streak + 1 : 1;
  state.lastCompletedDate = todayKey;
}

function countReviewsOn(date) {
  const key = dateKey(date);
  return allReviews().filter((item) => !item.completedAt && dateKey(item.dueDate) === key).length;
}

function cleanupOldCompletedIvyTasks() {
  const today = dateKey(new Date());
  const initialLength = state.ivyTasks.length;
  state.ivyTasks = state.ivyTasks.filter((task) => !task.completedAt || task.date === today);
  if (state.ivyTasks.length !== initialLength) saveState();
}

function todayIvyTasks() {
  const today = dateKey(new Date());
  return state.ivyTasks
    .filter((task) => task.date === today)
    .sort((a, b) => {
      const completionOrder = Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt));
      if (completionOrder !== 0) return completionOrder;

      const difficultyOrder = ivyDifficultyWeight(b) - ivyDifficultyWeight(a);
      if (difficultyOrder !== 0) return difficultyOrder;

      const pomodoroOrder = b.pomodoros - a.pomodoros;
      if (pomodoroOrder !== 0) return pomodoroOrder;

      return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
    });
}

function ivyDifficultyWeight(task) {
  return (ivyDifficulties[task.difficulty] || ivyDifficulties.yellow).weight;
}

function addIvyTask() {
  const tasks = todayIvyTasks();
  if (tasks.length >= ivyTaskLimit) {
    alert(`El método Ivy Lee recomienda como máximo ${ivyTaskLimit} tareas clave al día.`);
    return;
  }

  const title = els.ivyTaskInput.value.trim();
  const pomodoros = clamp(Number(els.ivyPomodoroInput.value) || 1, 1, 8);
  const difficulty = ivyDifficulties[els.ivyDifficultyInput.value] ? els.ivyDifficultyInput.value : "yellow";
  if (!title) return;

  state.ivyTasks.unshift({
    id: crypto.randomUUID(),
    date: dateKey(new Date()),
    title,
    pomodoros,
    difficulty,
    completedAt: "",
    points: 0,
  });
  saveState();
  els.ivyForm.reset();
  els.ivyPomodoroInput.value = 1;
  els.ivyDifficultyInput.value = "yellow";
  render();
}

function completeIvyTask(taskId) {
  const task = state.ivyTasks.find((item) => item.id === taskId);
  if (!task || task.completedAt) return;

  const completedAt = new Date();
  const points = ivyTaskPoints(task);
  task.completedAt = completedAt.toISOString();
  task.points = points;
  state.points += points;
  state.history.unshift({
    id: crypto.randomUUID(),
    type: "ivy",
    taskId: task.id,
    task: task.title,
    pomodoros: task.pomodoros,
    difficulty: task.difficulty || "yellow",
    points,
    completedAt: completedAt.toISOString(),
  });
  saveState();
  render();
}

function deleteIvyTask(taskId) {
  const task = state.ivyTasks.find((item) => item.id === taskId);
  if (!task) return;
  const confirmed = task.completedAt
    ? confirm(`¿Borrar "${task.title}"? También se retirarán sus puntos.`)
    : confirm(`¿Borrar "${task.title}"?`);
  if (!confirmed) return;

  state.ivyTasks = state.ivyTasks.filter((item) => item.id !== taskId);
  state.history = state.history.filter((item) => item.taskId !== taskId);
  recomputePointsFromHistory();
  saveState();
  render();
}

function ivyTaskPoints(task) {
  const difficulty = ivyDifficulties[task.difficulty] || ivyDifficulties.yellow;
  return Math.round(task.pomodoros * ivyPointsPerPomodoro * difficulty.multiplier);
}

function ivyPomodoroStats() {
  const today = dateKey(new Date());
  const weekStart = dateKey(addDays(new Date(), -6));
  const completedIvy = state.history.filter((item) => item.type === "ivy");
  const isInRange = (key) => key >= weekStart && key <= today;

  const todayCompleted = completedIvy
    .filter((item) => dateKey(item.completedAt) === today)
    .reduce((sum, item) => sum + (Number(item.pomodoros) || 0), 0);
  const todayPending = state.ivyTasks
    .filter((task) => task.date === today && !task.completedAt)
    .reduce((sum, task) => sum + task.pomodoros, 0);
  const weekCompleted = completedIvy
    .filter((item) => isInRange(dateKey(item.completedAt)))
    .reduce((sum, item) => sum + (Number(item.pomodoros) || 0), 0);
  const weekPending = state.ivyTasks
    .filter((task) => isInRange(task.date) && !task.completedAt)
    .reduce((sum, task) => sum + task.pomodoros, 0);
  const weekDays = new Set(completedIvy.filter((item) => isInRange(dateKey(item.completedAt))).map((item) => dateKey(item.completedAt))).size;

  return {
    todayCompleted,
    todayPlanned: todayCompleted + todayPending,
    weekCompleted,
    weekPlanned: weekCompleted + weekPending,
    weekDays,
  };
}

function render() {
  const due = dueReviews();
  const ivyTasks = todayIvyTasks();
  const completedIvyTasks = ivyTasks.filter((task) => task.completedAt);
  const completed = state.history.filter((item) => item.type !== "skipped" && typeof item.score === "number");
  const average = completed.length
    ? completed.reduce((sum, item) => sum + item.score, 0) / completed.length
    : 0;
  const todayLoad = countReviewsOn(new Date());

  els.pointsStat.textContent = state.points;
  els.streakStat.textContent = `${state.streak} ${state.streak === 1 ? "dia" : "dias"}`;
  els.levelStat.textContent = Math.floor(state.points / 250) + 1;
  els.todayStat.textContent = `${due.length} ${due.length === 1 ? "repaso" : "repasos"}`;
  els.loadStat.textContent = `${todayLoad}/${dailyReviewLimit}`;
  els.dueCount.textContent = `${due.length} pendientes`;
  els.ivyCount.textContent = `${completedIvyTasks.length}/${ivyTasks.length || ivyTaskLimit} tareas`;
  els.averageScore.textContent = completed.length ? `Media ${average.toFixed(1)}/10` : "Sin notas";
  els.rewardPoints.textContent = `${state.points} puntos`;

  renderSubjectOptions();
  renderDueList(due);
  renderIvyStats(ivyPomodoroStats());
  renderIvyTasks(ivyTasks);
  renderCalendar();
  renderProgress();
  renderRewards();
}

function renderDueList(items) {
  els.dueList.replaceChildren();
  if (!items.length) return renderEmpty(els.dueList);

  items.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const daysLate = Math.max(0, dayDistance(new Date(), dueDate));
    const overdue = daysLate > 0;
    const card = document.createElement("article");
    card.className = `review-card${overdue ? " overdue" : ""}`;
    card.innerHTML = `
      <div>
        <span class="badge ${overdue ? "warning" : "brand"}">${overdue ? `⚠️ Atrasado ${daysLate}d` : "✅ Toca hoy"} · Repaso ${item.step}</span>
        <p class="card-title">📘 ${escapeHtml(item.topic.title)}</p>
        <p class="card-meta">${escapeHtml(item.topic.subject)} · ${formatDate(dueDate)}</p>
        ${item.adjustmentReason ? `<p class="card-note">${escapeHtml(item.adjustmentReason)}</p>` : ""}
      </div>
      <div class="review-actions">
        <button class="ghost skip-btn" type="button">⏭️ Saltar</button>
        <button class="primary" type="button">📝 Evaluar</button>
      </div>
    `;
    card.querySelector(".primary").addEventListener("click", () => openReview(item));
    card.querySelector(".skip-btn").addEventListener("click", () => skipReview(item.id));
    els.dueList.append(card);
  });
}

function renderIvyTasks(tasks) {
  els.ivyList.replaceChildren();
  if (!tasks.length) return renderEmpty(els.ivyList);

  tasks.forEach((task) => {
    const difficulty = ivyDifficulties[task.difficulty] || ivyDifficulties.yellow;
    const item = document.createElement("article");
    item.className = `ivy-card difficulty-${difficulty.className}${task.completedAt ? " completed" : ""}`;
    item.innerHTML = `
      <div>
        <p class="card-title">${task.completedAt ? "✅" : "🍅"} ${escapeHtml(task.title)}</p>
        <p class="card-meta">
          <span class="difficulty-pill ${difficulty.className}">${difficulty.emoji} ${difficulty.label}</span>
          ${task.pomodoros} ${task.pomodoros === 1 ? "pomodoro" : "pomodoros"} · ${ivyTaskPoints(task)} puntos
        </p>
      </div>
      <div class="ivy-actions">
        <label class="check-action">
          <input type="checkbox" ${task.completedAt ? "checked disabled" : ""} />
          Hecha
        </label>
        <button class="ghost danger delete-ivy" type="button" aria-label="Borrar ${escapeHtml(task.title)}">🗑️</button>
      </div>
    `;
    item.querySelector("input").addEventListener("change", () => completeIvyTask(task.id));
    item.querySelector(".delete-ivy").addEventListener("click", () => deleteIvyTask(task.id));
    els.ivyList.append(item);
  });
}

function renderIvyStats(stats) {
  const todayPercent = stats.todayPlanned ? Math.round((stats.todayCompleted / stats.todayPlanned) * 100) : 0;
  const weekPercent = stats.weekPlanned ? Math.round((stats.weekCompleted / stats.weekPlanned) * 100) : 0;
  els.ivyStats.innerHTML = `
    <article class="ivy-stat-card">
      <span>Hoy</span>
      <strong>${stats.todayCompleted}/${stats.todayPlanned}</strong>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${todayPercent}%"></span></div>
    </article>
    <article class="ivy-stat-card">
      <span>7 días</span>
      <strong>${stats.weekCompleted}/${stats.weekPlanned}</strong>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${weekPercent}%"></span></div>
    </article>
    <article class="ivy-stat-card">
      <span>Días cumplidos</span>
      <strong>${stats.weekDays}/7</strong>
      <div class="mini-progress" aria-hidden="true"><span style="width: ${Math.round((stats.weekDays / 7) * 100)}%"></span></div>
    </article>
  `;
}

function renderCalendar() {
  const limit = addDays(startOfToday(), 30);
  const upcoming = allReviews()
    .filter((item) => !item.completedAt && new Date(item.dueDate) <= limit)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  els.calendarList.replaceChildren();
  if (!upcoming.length) return renderEmpty(els.calendarList);

  upcoming.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const row = document.createElement("article");
    row.className = "calendar-row";
    row.innerHTML = `
      <div class="date-pill">🗓️ ${shortDate(dueDate)}</div>
      <div>
        <p class="card-title">📘 ${escapeHtml(item.topic.title)}</p>
        <p class="card-meta">${escapeHtml(item.topic.subject)} · carga ${countReviewsOn(dueDate)}/${dailyReviewLimit}</p>
        ${item.adjustmentReason ? `<p class="card-note">${escapeHtml(item.adjustmentReason)}</p>` : ""}
      </div>
      <span class="badge ${item.adjusted ? "brand" : ""}">${item.adjusted ? "🧠 Adaptado" : `Repaso ${item.step}`}</span>
    `;
    els.calendarList.append(row);
  });
}

function renderProgress() {
  els.progressList.replaceChildren();
  if (!state.topics.length) return renderEmpty(els.progressList);

  state.topics.forEach((topic) => {
    const done = topic.reviews.filter((review) => review.completedAt);
    const average = done.length ? done.reduce((sum, review) => sum + review.score, 0) / done.length : 0;
    const nextReview = topic.reviews.find((review) => !review.completedAt);
    const card = document.createElement("article");
    card.className = "topic-card";
    card.innerHTML = `
      <div class="topic-card-head">
        <div>
          <p class="card-title">📘 ${escapeHtml(topic.title)}</p>
          <p class="card-meta">${escapeHtml(topic.subject)} · ${done.length}/${topic.reviews.length} repasos · factor x${topic.ease.toFixed(2)}</p>
        </div>
        <button class="ghost danger delete-topic" type="button" aria-label="Borrar ${escapeHtml(topic.title)}">🗑️ Borrar</button>
      </div>
      <div class="score-bar" aria-label="Nota media">
        <div class="score-fill" style="width: ${average * 10}%"></div>
      </div>
      <div class="topic-metrics">
        <strong>${done.length ? average.toFixed(1) : "-"} / 10</strong>
        <span class="badge brand">🧠 Dominio ${Math.round(topic.mastery)}%</span>
        <span class="badge">${nextReview ? `⏭️ Proximo ${shortDate(new Date(nextReview.dueDate))}` : "✅ Completado"}</span>
      </div>
    `;
    card.querySelector(".delete-topic").addEventListener("click", () => deleteTopic(topic.id));
    els.progressList.append(card);
  });
}

function renderRewards() {
  els.rewardList.replaceChildren();
  if (!state.rewards.length) return renderEmpty(els.rewardList);

  state.rewards.forEach((reward) => {
    const canRedeem = state.points >= reward.cost && !reward.redeemed;
    const card = document.createElement("article");
    card.className = "reward-card";
    card.innerHTML = `
      <div>
        <p class="card-title">${escapeHtml(reward.name)}</p>
        <p class="card-meta">${reward.redeemed ? "Canjeada" : `${reward.cost} puntos`}</p>
      </div>
      <div class="reward-actions">
        <button class="ghost danger delete-reward" type="button">🗑️ Borrar</button>
        <button class="${canRedeem ? "primary" : "ghost"} redeem-reward" type="button" ${canRedeem ? "" : "disabled"}>🎁 Canjear</button>
      </div>
    `;
    card.querySelector(".delete-reward").addEventListener("click", () => deleteReward(reward.id));
    card.querySelector(".redeem-reward").addEventListener("click", () => {
      if (!canRedeem) return;
      reward.redeemed = true;
      recomputePointsFromHistory();
      saveState();
      render();
    });
    els.rewardList.append(card);
  });
}

function renderEmpty(container) {
  container.append(document.querySelector("#emptyStateTemplate").content.cloneNode(true));
}

function openReview(item) {
  activeReviewId = item.id;
  els.reviewSubject.textContent = item.topic.subject;
  els.reviewTitle.textContent = item.topic.title;
  els.scoreInput.value = 7;
  els.scoreOutput.textContent = "7";
  els.noteInput.value = "";
  els.reviewDialog.showModal();
}

function notifyDueReviews(force) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const due = dueReviews();
  if (!due.length) {
    if (force) new Notification("Spaced Bambutition", { body: "✨ Todo en orden." });
    return;
  }
  const key = `${dateKey(new Date())}-${due.map((item) => item.id).join("-")}`;
  if (!force && key === lastNotificationKey) return;
  lastNotificationKey = key;
  new Notification("Spaced Bambutition", {
    body: `${due.length} ${due.length === 1 ? "repaso necesita" : "repasos necesitan"} tu nota de hoy.`,
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
}

function shortDate(date) {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}
