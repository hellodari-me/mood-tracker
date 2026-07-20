(function () {
  "use strict";

  const STORAGE_KEY = "moy-ritm.entries.v1";
  const THEME_KEY = "moy-ritm.theme";

  const moods = [
    { value: 1, label: "Плохо", face: "😞" },
    { value: 2, label: "Скорее плохо", face: "🙁" },
    { value: 3, label: "Нейтрально", face: "😐" },
    { value: 4, label: "Скорее хорошо", face: "🙂" },
    { value: 5, label: "Хорошо", face: "😊" }
  ];

  const groups = {
    weather: ["Солнечно", "Переменная облачность", "Облачно", "Пасмурно", "Дождь", "Снег", "Ветер", "Гроза", "Буря", "Туман", "Жара", "Холод"],
    activity: ["Работа", "Чтение", "Хобби", "Спорт", "Прогулка", "Время с близкими", "Забота о ребёнке", "Домашние дела", "Отдых", "Общение", "Дорога"],
    food: ["Здоровая еда", "Домашняя еда", "Фастфуд", "Ресторан", "Сладкое", "Переедание", "Мало еды"],
    emotion: ["Злость", "Раздражение", "Благодарность", "Любовь", "Волнение", "Расслабленность", "Усталость", "Покой", "Тревога", "Страх", "Грусть", "Отчаяние", "Тоска", "Радость", "Интерес", "Удовлетворение", "Надежда", "Одиночество", "Вина", "Стыд"]
  };

  let selectedMood = null;
  let selectedSleep = null;
  let entries = loadEntries();
  let pendingConfirm = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function loadEntries() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function localDateParts(date = new Date()) {
    const pad = n => String(n).padStart(2, "0");
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
    };
  }

  function createChoices() {
    const moodRoot = $("#moodChoices");
    moods.forEach(mood => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mood-option";
      button.dataset.value = mood.value;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.innerHTML = `<span class="face" aria-hidden="true">${mood.face}</span><span class="mood-label">${mood.label}</span>`;
      button.addEventListener("click", () => setMood(mood.value));
      moodRoot.appendChild(button);
    });

    const sleepRoot = $("#sleepChoices");
    moods.forEach(mood => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scale-option";
      button.dataset.value = mood.value;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.textContent = mood.label;
      button.addEventListener("click", () => setSleep(mood.value));
      sleepRoot.appendChild(button);
    });

    renderChipGroup("#weatherChoices", "weather", groups.weather);
    renderChipGroup("#activityChoices", "activity", groups.activity);
    renderChipGroup("#foodChoices", "food", groups.food);
    renderChipGroup("#emotionChoices", "emotion", groups.emotion);
  }

  function renderChipGroup(selector, name, values) {
    const root = $(selector);
    values.forEach((value, index) => {
      const id = `${name}-${index}`;
      const label = document.createElement("label");
      label.className = "choice-chip";
      label.innerHTML = `<input type="checkbox" id="${id}" name="${name}" value="${value}"><span>${value}</span>`;
      root.appendChild(label);
    });
  }

  function setMood(value) {
    selectedMood = Number(value);
    $$(".mood-option").forEach(button => {
      const active = Number(button.dataset.value) === selectedMood;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-checked", String(active));
    });
    $("#moodError").hidden = true;
  }

  function setSleep(value) {
    selectedSleep = selectedSleep === Number(value) ? null : Number(value);
    $$(".scale-option").forEach(button => {
      const active = Number(button.dataset.value) === selectedSleep;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function valuesFor(name) {
    return $$(`input[name="${name}"]:checked`).map(input => input.value);
  }

  function setValues(name, values = []) {
    $$(`input[name="${name}"]`).forEach(input => { input.checked = values.includes(input.value); });
  }

  function resetForm() {
    $("#entryForm").reset();
    $("#editingId").value = "";
    selectedMood = null;
    selectedSleep = null;
    setMoodVisuals();
    const now = localDateParts();
    $("#entryDate").value = now.date;
    $("#entryTime").value = now.time;
    $("#saveButton").textContent = "Сохранить запись";
    $("#cancelEditButton").hidden = true;
    $("#moodError").hidden = true;
  }

  function setMoodVisuals() {
    $$(".mood-option").forEach(button => {
      const active = Number(button.dataset.value) === selectedMood;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-checked", String(active));
    });
    $$(".scale-option").forEach(button => {
      const active = Number(button.dataset.value) === selectedSleep;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedMood) {
      $("#moodError").hidden = false;
      $("#moodChoices").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const date = $("#entryDate").value;
    const time = $("#entryTime").value;
    const editingId = $("#editingId").value;
    const entry = {
      id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      timestamp: new Date(`${date}T${time}:00`).toISOString(),
      mood: selectedMood,
      weather: valuesFor("weather"),
      activities: valuesFor("activity"),
      food: valuesFor("food"),
      sleep: selectedSleep,
      cycleDay: $("#cycleDay").value ? Number($("#cycleDay").value) : null,
      emotions: valuesFor("emotion"),
      note: $("#note").value.trim(),
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      entries = entries.map(item => item.id === editingId ? entry : item);
    } else {
      entries.push(entry);
    }
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    saveEntries();
    resetForm();
    refreshAll();
    showToast(editingId ? "Запись обновлена" : "Запись сохранена");
  }

  function switchTab(name) {
    $$(".tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.tab === name));
    $$(".panel").forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === name));
    if (name === "insights") renderInsights();
    if (name === "journal") renderJournal();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(iso, withTime = true) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric", month: "long", year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
    }).format(new Date(iso));
  }

  function moodMeta(value) {
    return moods.find(mood => mood.value === Number(value)) || moods[2];
  }

  function filteredJournalEntries() {
    const range = $("#journalFilter").value;
    if (range === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
    return entries.filter(entry => new Date(entry.timestamp) >= cutoff);
  }

  function renderJournal() {
    const list = $("#journalList");
    const data = filteredJournalEntries();
    list.innerHTML = "";
    $("#journalEmpty").hidden = data.length > 0;

    data.forEach(entry => {
      const mood = moodMeta(entry.mood);
      const tags = [
        ...entry.weather,
        ...entry.activities,
        ...entry.food,
        ...entry.emotions,
        ...(entry.sleep ? [`Сон: ${moodMeta(entry.sleep).label.toLowerCase()}`] : []),
        ...(entry.cycleDay ? [`Цикл: день ${entry.cycleDay}`] : [])
      ];
      const article = document.createElement("article");
      article.className = "journal-item";
      article.innerHTML = `
        <div class="journal-top">
          <div class="journal-mood">
            <span class="journal-face" aria-hidden="true">${mood.face}</span>
            <div><strong>${mood.label}</strong><time datetime="${entry.timestamp}">${formatDate(entry.timestamp)}</time></div>
          </div>
          <div class="journal-actions">
            <button class="text-button" type="button" data-edit="${entry.id}">Изменить</button>
            <button class="text-button" type="button" data-delete="${entry.id}">Удалить</button>
          </div>
        </div>
        ${tags.length ? `<div class="journal-tags">${tags.map(tag => `<span class="journal-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${entry.note ? `<p class="journal-note">${escapeHtml(entry.note)}</p>` : ""}
      `;
      list.appendChild(article);
    });
  }

  function editEntry(id) {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;
    const date = new Date(entry.timestamp);
    const parts = localDateParts(date);
    $("#editingId").value = entry.id;
    $("#entryDate").value = parts.date;
    $("#entryTime").value = parts.time;
    selectedMood = entry.mood;
    selectedSleep = entry.sleep;
    setMoodVisuals();
    setValues("weather", entry.weather);
    setValues("activity", entry.activities);
    setValues("food", entry.food);
    setValues("emotion", entry.emotions);
    $("#cycleDay").value = entry.cycleDay || "";
    $("#note").value = entry.note || "";
    $("#saveButton").textContent = "Сохранить изменения";
    $("#cancelEditButton").hidden = false;
    switchTab("entry");
  }

  function askConfirm(title, text, action) {
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    pendingConfirm = action;
    $("#confirmDialog").showModal();
  }

  function periodEntries() {
    const range = $("#insightRange").value;
    if (range === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
    return entries.filter(entry => new Date(entry.timestamp) >= cutoff);
  }

  function renderInsights() {
    const data = periodEntries().slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const empty = data.length < 3;
    $("#insightsEmpty").hidden = !empty;
    $("#insightsContent").hidden = empty;
    if (empty) return;

    const average = data.reduce((sum, entry) => sum + entry.mood, 0) / data.length;
    const uniqueDays = new Set(data.map(entry => entry.timestamp.slice(0, 10))).size;
    const emotionCounts = countValues(data.flatMap(entry => entry.emotions));
    const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    $("#averageMood").textContent = average.toFixed(1);
    $("#entryCount").textContent = data.length;
    $("#daysTracked").textContent = `${uniqueDays} ${pluralDays(uniqueDays)}`;
    $("#topEmotion").textContent = topEmotion ? topEmotion[0] : "—";

    renderTrendChart(data);
    renderFactors(data, average);
    renderCycleChart(data);
  }

  function countValues(values) {
    return values.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {});
  }

  function pluralDays(number) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return "день";
    if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return "дня";
    return "дней";
  }

  function dailyAverages(data) {
    const byDay = {};
    data.forEach(entry => {
      const key = entry.timestamp.slice(0, 10);
      byDay[key] ||= [];
      byDay[key].push(entry.mood);
    });
    return Object.entries(byDay).map(([date, values]) => ({
      date,
      value: values.reduce((a, b) => a + b, 0) / values.length
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderTrendChart(data) {
    const svg = $("#trendChart");
    const points = dailyAverages(data);
    const w = 720, h = 260, left = 44, right = 20, top = 18, bottom = 40;
    const plotW = w - left - right, plotH = h - top - bottom;
    const x = index => left + (points.length === 1 ? plotW / 2 : index * plotW / (points.length - 1));
    const y = value => top + (5 - value) * plotH / 4;
    let html = `<title>Динамика настроения</title><desc>Среднее настроение по дням от 1 до 5.</desc>`;
    for (let value = 1; value <= 5; value++) {
      html += `<line class="grid-line" x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}"></line><text class="axis-label" x="${left-15}" y="${y(value)+4}">${value}</text>`;
    }
    const coords = points.map((point, index) => [x(index), y(point.value)]);
    if (coords.length > 1) {
      const line = coords.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
      const area = `${line} L${coords.at(-1)[0]},${h-bottom} L${coords[0][0]},${h-bottom} Z`;
      html += `<path class="trend-area" d="${area}"></path><path class="trend-line" d="${line}"></path>`;
    }
    points.forEach((point, index) => {
      const showLabel = points.length <= 8 || index === 0 || index === points.length - 1;
      html += `<circle class="trend-dot" cx="${x(index)}" cy="${y(point.value)}" r="5"><title>${formatShortDate(point.date)}: ${point.value.toFixed(1)}</title></circle>`;
      if (showLabel) html += `<text class="axis-label" text-anchor="middle" x="${x(index)}" y="${h-14}">${formatShortDate(point.date)}</text>`;
    });
    svg.innerHTML = html;
  }

  function formatShortDate(dateString) {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${dateString}T12:00:00`));
  }

  function renderFactors(data, baseline) {
    const definitions = [
      ["Погода", "weather"], ["Занятие", "activities"], ["Еда", "food"], ["Эмоция", "emotions"]
    ];
    const factors = [];
    definitions.forEach(([type, key]) => {
      const values = new Set(data.flatMap(entry => entry[key] || []));
      values.forEach(value => {
        const matches = data.filter(entry => (entry[key] || []).includes(value));
        if (matches.length < 2) return;
        const average = matches.reduce((sum, entry) => sum + entry.mood, 0) / matches.length;
        factors.push({ type, value, count: matches.length, delta: average - baseline });
      });
    });
    const withSleep = data.filter(entry => entry.sleep);
    if (withSleep.length >= 2) {
      [1,2,3,4,5].forEach(value => {
        const matches = withSleep.filter(entry => entry.sleep === value);
        if (matches.length < 2) return;
        const average = matches.reduce((sum, entry) => sum + entry.mood, 0) / matches.length;
        factors.push({ type: "Сон", value: moodMeta(value).label, count: matches.length, delta: average - baseline });
      });
    }
    factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const list = $("#factorList");
    list.innerHTML = "";
    if (!factors.length) {
      list.innerHTML = `<p class="analysis-note">Повторяющихся факторов пока мало. Продолжай отмечать контекст.</p>`;
      return;
    }
    factors.slice(0, 10).forEach(factor => {
      const positive = factor.delta >= 0;
      const width = Math.min(50, Math.abs(factor.delta) / 2 * 50);
      const row = document.createElement("div");
      row.className = "factor-row";
      row.innerHTML = `
        <div class="factor-name">${escapeHtml(factor.value)}<small>${factor.type} · ${factor.count}×</small></div>
        <div class="factor-track"><span class="factor-fill ${positive ? "positive" : "negative"}" style="width:${width}%"></span></div>
        <div class="factor-delta ${positive ? "positive" : "negative"}">${positive ? "+" : ""}${factor.delta.toFixed(1)}</div>
      `;
      list.appendChild(row);
    });
  }

  function renderCycleChart(data) {
    const svg = $("#cycleChart");
    const cycleEntries = data.filter(entry => entry.cycleDay && entry.cycleDay <= 45);
    const byDay = {};
    cycleEntries.forEach(entry => {
      byDay[entry.cycleDay] ||= [];
      byDay[entry.cycleDay].push(entry.mood);
    });
    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    $("#cycleCoverage").textContent = cycleEntries.length ? `${cycleEntries.length} записей · ${days.length} дней` : "нет данных";
    const w = 720, h = 260, left = 44, right = 18, top = 18, bottom = 40;
    const plotW = w-left-right, plotH = h-top-bottom;
    let html = `<title>Настроение по дню цикла</title><desc>Среднее настроение для каждого отмеченного дня цикла.</desc>`;
    for (let value = 1; value <= 5; value++) {
      const y = top + (5-value)*plotH/4;
      html += `<line class="grid-line" x1="${left}" y1="${y}" x2="${w-right}" y2="${y}"></line><text class="axis-label" x="${left-15}" y="${y+4}">${value}</text>`;
    }
    if (!days.length) {
      html += `<text class="axis-label" text-anchor="middle" x="${w/2}" y="${h/2}">Добавь день цикла в записях</text>`;
      svg.innerHTML = html;
      return;
    }
    const maxDay = Math.max(28, ...days);
    const gap = 3;
    const barW = Math.max(5, plotW / maxDay - gap);
    for (let day=1; day<=maxDay; day++) {
      const values = byDay[day];
      const average = values ? values.reduce((a,b) => a+b,0)/values.length : null;
      const x = left + (day-1)*plotW/maxDay;
      const barH = average ? (average-1)*plotH/4 + 3 : 3;
      const y = top + plotH - barH;
      html += `<rect class="cycle-bar ${average ? "has-data" : ""}" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3"><title>День ${day}: ${average ? average.toFixed(1) : "нет данных"}</title></rect>`;
      if (day === 1 || day === maxDay || day % 7 === 0) html += `<text class="axis-label" text-anchor="middle" x="${x+barW/2}" y="${h-14}">${day}</text>`;
    }
    svg.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const payload = { app: "Мой ритм", version: 1, exportedAt: new Date().toISOString(), entries };
    download(`moy-ritm-${localDateParts().date}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function csvCell(value) {
    const string = Array.isArray(value) ? value.join("; ") : String(value ?? "");
    return `"${string.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const headers = ["Дата и время","Настроение (1–5)","Настроение","Погода","Занятия","Еда","Сон (1–5)","День цикла","Эмоции","Заметка"];
    const rows = entries.map(entry => [entry.timestamp, entry.mood, moodMeta(entry.mood).label, entry.weather, entry.activities, entry.food, entry.sleep || "", entry.cycleDay || "", entry.emotions, entry.note]);
    const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    download(`moy-ritm-${localDateParts().date}.csv`, csv, "text/csv;charset=utf-8");
  }

  async function importJson(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(incoming)) throw new Error("wrong shape");
      const existingIds = new Set(entries.map(entry => entry.id));
      const valid = incoming.filter(entry => entry && entry.id && entry.timestamp && entry.mood >= 1 && entry.mood <= 5);
      const additions = valid.filter(entry => !existingIds.has(entry.id));
      entries = [...entries, ...additions].sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
      saveEntries();
      refreshAll();
      showToast(`Добавлено записей: ${additions.length}`);
    } catch (_) {
      showToast("Не удалось прочитать этот файл");
    } finally {
      $("#importInput").value = "";
    }
  }

  function refreshAll() {
    renderJournal();
    renderInsights();
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    $("#themeButton").textContent = theme === "dark" ? "☀" : "☾";
  }

  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    $("#themeButton").textContent = theme === "dark" ? "☀" : "☾";
  }

  function bindEvents() {
    $$(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
    $$('[data-go-entry]').forEach(button => button.addEventListener("click", () => switchTab("entry")));
    $("#entryForm").addEventListener("submit", handleSubmit);
    $("#cancelEditButton").addEventListener("click", resetForm);
    $("#themeButton").addEventListener("click", toggleTheme);
    $("#insightRange").addEventListener("change", renderInsights);
    $("#journalFilter").addEventListener("change", renderJournal);
    $("#journalList").addEventListener("click", event => {
      const edit = event.target.closest("[data-edit]");
      const remove = event.target.closest("[data-delete]");
      if (edit) editEntry(edit.dataset.edit);
      if (remove) askConfirm("Удалить запись?", "Она исчезнет из журнала и аналитики.", () => {
        entries = entries.filter(entry => entry.id !== remove.dataset.delete);
        saveEntries(); refreshAll(); showToast("Запись удалена");
      });
    });
    $("#confirmDialog").addEventListener("close", () => {
      if ($("#confirmDialog").returnValue === "confirm" && pendingConfirm) pendingConfirm();
      pendingConfirm = null;
    });
    $("#exportJsonButton").addEventListener("click", exportJson);
    $("#exportCsvButton").addEventListener("click", exportCsv);
    $("#importInput").addEventListener("change", event => event.target.files[0] && importJson(event.target.files[0]));
    $("#clearDataButton").addEventListener("click", () => askConfirm("Удалить все записи?", `Будет удалено: ${entries.length}. Сначала можно скачать резервную копию.`, () => {
      entries = []; saveEntries(); refreshAll(); showToast("Все записи удалены");
    }));
  }

  createChoices();
  initTheme();
  bindEvents();
  resetForm();
  refreshAll();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
