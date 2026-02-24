/* popup/popup.js
   Renders UI, provides manual timer controls, three analysis charts,
   shows suggestions with reason.
*/
import {
  IDEAL_RATIO,
  CONTEST_MAX,
  STREAK_MAX_DAYS,
} from "../background/constants.js";

const defaultState = {
  skillScore: 100,
};

let skillChart = null;
let effChart = null;
let timeChart = null;
let timerInterval = null;

init();

async function init() {
  // UI events
  document.getElementById("saveUser").onclick = onSaveUser;
  document.getElementById("manualStart").onclick = manualStart;
  document.getElementById("manualStop").onclick = manualStop;

  document.querySelectorAll(".tabButton").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  // load current state and show appropriate screen
  const state = await chrome.storage.local.get(null);

  if (!state.profileData) {
    document.getElementById("usernameSection").style.display = "flex";
    document.getElementById("mainUI").style.display = "none";
  } else {
    document.getElementById("usernameSection").style.display = "none";
    document.getElementById("mainUI").style.display = "flex";
    renderAll();
  }

  // listen for state changes to update UI live
  chrome.storage.onChanged.addListener((changes) => {
    if (
      changes.submissionHistory ||
      changes.suggestions ||
      changes.activeSession ||
      changes.topicStats ||
      changes.skillScore
    ) {
      renderAll();
    }
  });

  // default tab
  showTab("profile");
  startTimerLoop();
}

async function onSaveUser() {
  const username = document.getElementById("usernameInput").value.trim();
  document.getElementById("error").innerText = "";
  if (!username) {
    document.getElementById("error").innerText = "Enter username.";
    return;
  }
  // call background to fetch profile
  chrome.runtime.sendMessage(
    { type: "FETCH_PROFILE", username },
    async (resp) => {
      if (!resp || !resp.profile) {
        document.getElementById("error").innerText =
          "Invalid username or fetch failed.";
        return;
      }
      // store profileData
      await chrome.storage.local.set({
        profileData: resp.profile,
        username,
        skillScore: defaultState.skillScore,
      });
      document.getElementById("usernameSection").style.display = "none";
      document.getElementById("mainUI").style.display = "flex";
      renderAll();
    },
  );
}

function showTab(name) {
  // Hide all tabs
  document.querySelectorAll(".tab").forEach((t) => (t.style.display = "none"));
  // Remove active class from all tab buttons
  document.querySelectorAll(".tabButton").forEach((btn) => {
    btn.classList.remove("active");
  });
  // Show target tab
  const el = document.getElementById(name);
  if (el) el.style.display = "block";
  // Add active class to clicked button
  const activeBtn = document.querySelector(`.tabButton[data-tab="${name}"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

async function renderAll() {
  await renderHeader();
  await renderProfile();
  await renderTopics();
  await renderSuggestions();
  await renderAnalysis();
}

// Header/skill
async function renderHeader() {
  const state = await chrome.storage.local.get(null);
  const skill = state.skillScore !== undefined ? state.skillScore : 100;
  document.getElementById("skillValue").innerText = skill.toFixed(2);
}

// PROFILE tab (also update overview section)
async function renderProfile() {
  const state = await chrome.storage.local.get(null);
  const profile = state.profileData;
  const streak = state.streakInfo?.currentStreak ?? 0;
  if (!profile) {
    document.getElementById("profile").innerHTML = "<p>No profile</p>";
    return;
  }

  const ac = profile.submitStatsGlobal?.acSubmissionNum || [];
  const total = ac.find((x) => x.difficulty === "All")?.count ?? 0;
  const easy = ac.find((x) => x.difficulty === "Easy")?.count ?? 0;
  const medium = ac.find((x) => x.difficulty === "Medium")?.count ?? 0;
  const hard = ac.find((x) => x.difficulty === "Hard")?.count ?? 0;

  const ratioScore = computeRatioScore(easy, medium, hard);
  const contestScore = computeContestScore(
    profile.userContestRanking?.rating ?? 0,
  );
  const streakScore = computeStreakScore(streak);

  // Update overview section
  document.getElementById("overview").innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px;">
      <img src="${profile.profile.userAvatar}" width="50" height="50" style="border-radius: 6px; flex-shrink: 0;"/>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 15px;">${profile.username}</div>
        <div style="font-size: 12px; color: #666;">QUESTIONS SOLVED : ${total} &nbsp; CURRENT DSA RATING : ${ratioScore}</div>
      </div>
    </div>
  `;

  // Profile content
  document.getElementById("profile").innerHTML = `
    <div style="margin-bottom: 20px;">
      <div class="cardTitle">USERNAME</div>
      <div style="padding: 12px; background-color: white; border-radius: 4px; font-weight: 500;">${profile.username}</div>
    </div>
    
    <hr/>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0;">
      <div class="profileCard" style="border: none; margin: 0;">
        <div class="cardTitle">QUESTIONS SOLVED</div>
        <div class="cardValue">${total}</div>
      </div>
      <div class="profileCard" style="border: none; margin: 0;">
        <div class="cardTitle">CURRENT DSA RATING</div>
        <div class="cardValue">${ratioScore}</div>
      </div>
      <div class="profileCard" style="border: none; margin: 0;">
        <div class="cardTitle">ACTIVE DAYS ON LC</div>
        <div class="cardValue">${streak}</div>
      </div>
    </div>
    
    <hr/>
    
    <div class="sectionTitle">Score Breakdown</div>
    <div class="profileCard" style="border: none; margin: 8px 0;">
      <div class="cardTitle">E-M-H RATIO</div>
      <div class="cardValue">${ratioScore}</div>
    </div>
    <div class="profileCard" style="border: none; margin: 8px 0;">
      <div class="cardTitle">CONTEST SCORE</div>
      <div class="cardValue">${contestScore}</div>
    </div>
    <div class="profileCard" style="border: none; margin: 8px 0;">
      <div class="cardTitle">STREAK</div>
      <div class="cardValue">${streakScore}</div>
    </div>
  `;
}

function computeRatioScore(e, m, h) {
  const total = e + m + h;
  if (!total) return 0;
  const pE = e / total,
    pM = m / total,
    pH = h / total;
  const L1 =
    Math.abs(pE - IDEAL_RATIO.Easy) +
    Math.abs(pM - IDEAL_RATIO.Medium) +
    Math.abs(pH - IDEAL_RATIO.Hard);
  const sim = 1 - L1 / 2;
  return Math.max(0, (sim * 10).toFixed(2));
}
function computeContestScore(r) {
  return Math.min(10, (r / CONTEST_MAX) * 10 || 0).toFixed(2);
}
function computeStreakScore(s) {
  return Math.min(10, (s / STREAK_MAX_DAYS) * 10 || 0).toFixed(2);
}

// TOPICS tab
async function renderTopics() {
  const state = await chrome.storage.local.get(null);
  const stats = state.topicStats || {};
  const goals = state.goalsList || [];
  const weak = [],
    strong = [],
    avg = [];
  Object.entries(stats).forEach(([topic, data]) => {
    if (data.classification === "Weak") weak.push({ topic, data });
    else if (data.classification === "Strong") strong.push({ topic, data });
    else avg.push({ topic, data });
  });

  const strongHtml = strong.length
    ? strong
        .map(
          (s) =>
            `<div class="topicItem">${s.topic} — <strong>${(s.data.strengthScore || 0).toFixed(2)}</strong></div>`,
        )
        .join("")
    : '<div class="topicItem" style="color: #999;">No strong topics yet</div>';

  const avgHtml = avg.length
    ? avg
        .map(
          (s) =>
            `<div class="topicItem">${s.topic} — <strong>${(s.data.strengthScore || 0).toFixed(2)}</strong></div>`,
        )
        .join("")
    : '<div class="topicItem" style="color: #999;">No average topics</div>';

  const weakHtml = weak.length
    ? weak
        .map(
          (s) =>
            `<div class="topicItem">${s.topic} — <strong>${(s.data.strengthScore || 0).toFixed(2)}</strong></div>`,
        )
        .join("")
    : '<div class="topicItem" style="color: #999;">No weak topics yet</div>';

  const goalsHtml = goals.length
    ? goals.map((g) => `<div class="topicItem">${g}</div>`).join("")
    : '<div class="topicItem" style="color: #999;">No goals set yet</div>';

  document.getElementById("topics").innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <div>
        <div class="sectionTitle">STRONG</div>
        <div class="topicsList">
          ${strongHtml}
        </div>
      </div>
      <div>
        <div class="sectionTitle">WEAK</div>
        <div class="topicsList">
          ${weakHtml}
        </div>
      </div>
    </div>
    
    <hr/>
    
    <div class="sectionTitle">ENTER YOUR TARGET TOPIC</div>
    <div>
      ${goalsHtml}
    </div>
    <input id="goalInput" class="goalInput" placeholder="Add a goal (topic)" />
    <button id="addGoalBtn" class="addGoalBtn">Add Goal</button>
  `;

  // attach add button
  document.getElementById("addGoalBtn").onclick = async () => {
    const val = document.getElementById("goalInput").value.trim();
    if (!val) return;
    const state = await chrome.storage.local.get(null);
    const updated = [...(state.goalsList || []), val];
    await chrome.storage.local.set({ goalsList: updated });
    chrome.runtime.sendMessage({ type: "UPDATE_GOALS", goals: updated });
    renderTopics();
    renderSuggestions();
  };
}

// SUGGESTIONS tab
async function renderSuggestions() {
  const state = await chrome.storage.local.get(null);
  const suggestions = state.suggestions || [];
  if (!suggestions.length) {
    document.getElementById("suggestions").innerHTML =
      '<div style="padding: 20px; text-align: center; color: #666;">No suggestions yet. Set some goals or solve more problems!</div>';
    return;
  }
  document.getElementById("suggestions").innerHTML = `
    <div style="margin-bottom: 8px;">
      <div class="sectionTitle">TOPICS YOU MUST FOCUS :-)</div>
    </div>
    ${suggestions
      .map(
        (s) => `
      <div class="suggestionItem">
        <div class="suggestionTitle"><a href="${s.url}" target="_blank" class="suggestionLink">${s.title}</a></div>
        <div class="suggestionReason">${s.reason || ""}</div>
      </div>
    `,
      )
      .join("")}
  `;
}

// ANALYSIS tab — three charts
async function renderAnalysis() {
  const state = await chrome.storage.local.get(null);
  const history = state.submissionHistory || [];

  // Skill chart (EMA)
  const skillCtx = document.getElementById("skillChart").getContext("2d");
  if (skillChart) skillChart.destroy();
  if (!history.length) {
    skillChart = new Chart(skillCtx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {},
    });
  } else {
    const raw = history.map((h) => h.skillAfter || 0);
    const ema = computeEMA(raw, 0.3);
    skillChart = new Chart(skillCtx, {
      type: "line",
      data: {
        labels: raw.map((_, i) => i + 1),
        datasets: [
          {
            label: "Skill (EMA)",
            data: ema.map((v) => Number(v.toFixed(2))),
            borderColor: "#3b82f6",
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: "Skill (EMA) — smoothed skill trend over submissions",
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label || "Value"}: ${Number(ctx.raw).toFixed(2)}`,
              title: () => "Shows your smoothed skill trajectory (EMA).",
            },
          },
        },
        scales: {
          y: { ticks: { callback: (v) => Number(v).toFixed(2) } },
        },
      },
    });
  }

  // Efficiency chart (raw + rolling avg)
  const effCtx = document.getElementById("effChart").getContext("2d");
  if (effChart) effChart.destroy();
  if (!history.length) {
    effChart = new Chart(effCtx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {},
    });
  } else {
    const rawEff = history.map((h) => h.efficiency || 0);
    const roll = movingAverage(rawEff, 5);
    effChart = new Chart(effCtx, {
      type: "line",
      data: {
        labels: rawEff.map((_, i) => i + 1),
        datasets: [
          {
            label: "Efficiency (raw)",
            data: rawEff.map((v) => Number(v.toFixed(2))),
            borderColor: "#10b981",
            tension: 0.2,
            pointRadius: 0,
            fill: false,
          },
          {
            label: "Rolling Avg (5)",
            data: roll.map((v) => Number(v.toFixed(2))),
            borderColor: "#f59e0b",
            tension: 0.3,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: "Efficiency — per submission and rolling average",
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label || "Value"}: ${Number(ctx.raw).toFixed(2)}`,
              title: () => "Shows efficiency (higher is better).",
            },
          },
        },
        scales: { y: { ticks: { callback: (v) => Number(v).toFixed(2) } } },
      },
    });
  }

  // Time per solve chart
  const timeCtx = document.getElementById("timeChart").getContext("2d");
  if (timeChart) timeChart.destroy();
  if (!history.length) {
    timeChart = new Chart(timeCtx, {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: {},
    });
  } else {
    const times = history.map((h) => h.timeTaken || 0);
    timeChart = new Chart(timeCtx, {
      type: "bar",
      data: {
        labels: times.map((_, i) => i + 1),
        datasets: [
          {
            label: "Time per Solve (min)",
            data: times.map((v) => Number(v.toFixed(2))),
            backgroundColor: "rgba(59,130,246,0.4)",
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: "Time per Solve — minutes spent per accepted problem",
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label || "Time"}: ${Number(ctx.raw).toFixed(2)} min`,
              title: () =>
                "Shows time (in minutes) taken for each solved problem.",
            },
          },
        },
        scales: { y: { ticks: { callback: (v) => Number(v).toFixed(2) } } },
      },
    });
  }
}

function computeEMA(values, alpha) {
  const out = [];
  values.forEach((v, i) => {
    if (i === 0) out.push(v);
    else out.push(alpha * v + (1 - alpha) * out[i - 1]);
  });
  return out;
}
function movingAverage(data, windowSize) {
  return data.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = data.slice(start, i + 1);
    const sum = slice.reduce((a, b) => a + (b || 0), 0);
    return sum / slice.length;
  });
}

// Manual timer controls
async function manualStart() {
  const state = await chrome.storage.local.get(null);
  if (state.activeSession) return;
  const startTime = Date.now();
  // try to get current problem details from active tab (content script)
  try {
    const tabs = await new Promise((res) =>
      chrome.tabs.query({ active: true, currentWindow: true }, res),
    );
    const tab = tabs && tabs[0];
    let details = null;
    if (tab && tab.id) {
      details = await new Promise((res) =>
        chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_PROBLEM" }, res),
      );
    }
    const title = details?.title || "Manual Session";
    const difficulty = details?.difficulty || "Medium";
    await chrome.storage.local.set({
      activeSession: { startTime, title, difficulty },
    });
  } catch (e) {
    await chrome.storage.local.set({
      activeSession: {
        startTime,
        title: "Manual Session",
        difficulty: "Medium",
      },
    });
  }
}

async function manualStop() {
  const state = await chrome.storage.local.get(null);
  if (!state.activeSession) return;
  const timeTakenMin =
    (Date.now() - state.activeSession.startTime) / (1000 * 60);
  // try to enrich with problem topics/title from active tab
  let details = null;
  try {
    const tabs = await new Promise((res) =>
      chrome.tabs.query({ active: true, currentWindow: true }, res),
    );
    const tab = tabs && tabs[0];
    if (tab && tab.id) {
      details = await new Promise((res) =>
        chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_PROBLEM" }, res),
      );
    }
  } catch (e) {
    /* ignore */
  }

  chrome.runtime.sendMessage({
    type: "SUBMISSION_EVENT",
    data: {
      slug: details?.slug || "manual-session",
      title: details?.title || state.activeSession.title || "Manual Session",
      difficulty:
        details?.difficulty || state.activeSession.difficulty || "Medium",
      topics: details?.topics || [],
      timeTaken: timeTakenMin,
      result: "Accepted",
      timestamp: Date.now(),
    },
  });

  // remove activeSession and set lastActive so UI timer updates immediately
  await chrome.storage.local.remove("activeSession");
  await chrome.storage.local.set({ lastActive: Date.now() });
}

// Timer realtime display
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    const state = await chrome.storage.local.get(null);
    const el = document.getElementById("timerDisplay");
    if (state.activeSession && state.activeSession.startTime) {
      const diff = Date.now() - state.activeSession.startTime;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.innerText = `Solving: ${state.activeSession.title || "Problem"} — ${mins}m ${secs}s`;
    } else {
      // show since last active
      const last = state.lastActive;
      if (last) {
        const diff = Date.now() - last;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        el.innerText = `Since last solve: ${mins}m ${secs}s`;
      } else {
        el.innerText = "—";
      }
    }
  }, 1000);
}
