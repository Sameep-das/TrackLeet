/* content/content.js
   Responsibilities:
   - Start activeSession on editor focus (or manual)
   - Detect submit clicks to create a pendingAttempt
   - Observe submission result node robustly and finalize attempts
   - Send SUBMISSION_EVENT messages to background
*/

(function () {
  let active = false;
  let activeStart = null;
  let pendingAttempt = null;
  let acceptedHandled = false;

  function slugFromPath() {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[1] ?? null;
  }

  function prettyTitle() {
    const domTitle =
      document.querySelector('[data-cy="question-title"]') ||
      document.querySelector("h1");
    if (domTitle) return domTitle.innerText.trim();
    const slug = slugFromPath();
    if (!slug) return "Unknown";
    return slug
      .split("-")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(" ");
  }

  function difficultyFromDOM() {
    const el = document.querySelector('[class*="difficulty"]');
    if (el) return el.innerText.trim();
    return "Medium";
  }

  function topicsFromDOM() {
    return Array.from(document.querySelectorAll('a[href^="/tag/"]')).map((e) =>
      e.innerText.trim(),
    );
  }

  function startActiveSessionIfNeeded() {
    if (active) return;
    active = true;
    activeStart = Date.now();
    chrome.storage.local.set({
      activeSession: {
        startTime: activeStart,
        title: prettyTitle(),
        difficulty: difficultyFromDOM(),
      },
    });
    // notify badge etc.
    chrome.runtime.sendMessage({ type: "TIMER_RUNNING" });
  }

  function stopActiveSessionCleanup() {
    active = false;
    activeStart = null;
    pendingAttempt = null;
    acceptedHandled = false;
    chrome.runtime.sendMessage({ type: "TIMER_STOPPED" });
  }

  // If user clicks submit/run - create a pendingAttempt (best-effort)
  document.addEventListener(
    "click",
    (e) => {
      const btn =
        e.target.closest && e.target.closest("button, input[type='button']");
      if (!btn) return;
      const text = (btn.innerText || btn.value || "").toLowerCase();
      if (
        text.includes("submit") ||
        text.includes("run") ||
        text.includes("execute")
      ) {
        // Start pending attempt record
        pendingAttempt = { startTime: Date.now(), triggeredBy: text };
        // ensure session started too
        startActiveSessionIfNeeded();
      }
    },
    true,
  );

  // editor focus detection (monaco, codemirror, ace, textarea)
  document.addEventListener(
    "focusin",
    (e) => {
      const selectors = [
        ".monaco-editor",
        ".CodeMirror",
        ".ace_editor",
        "textarea",
        ".view-lines",
      ];
      const target = e.target;
      try {
        for (const s of selectors) {
          if (target.closest && target.closest(s)) {
            startActiveSessionIfNeeded();
            break;
          }
        }
      } catch (err) {
        /* ignore */
      }
    },
    true,
  );

  // MutationObserver: observe submission-result node only when available
  function attachResultObserver() {
    const poll = setInterval(() => {
      const resultNode = document.querySelector(
        '[data-e2e-locator="submission-result"]',
      );
      if (!resultNode) return;

      clearInterval(poll);

      const obs = new MutationObserver(() => {
        if (acceptedHandled) return;
        const txt = (resultNode.innerText || "").trim();
        if (/Accepted/i.test(txt)) {
          acceptedHandled = true;
          finalizeAttempt("Accepted");
        } else if (
          /Wrong Answer|Time Limit|Runtime Error|Compilation Error/i.test(txt)
        ) {
          acceptedHandled = true;
          finalizeAttempt("Failed");
        }
      });

      obs.observe(resultNode, { childList: true, subtree: true });

      // re-attach on SPA nav: when url changes, reset acceptedHandled
      let lastUrl = location.href;
      new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          acceptedHandled = false;
        }
      }).observe(document, { subtree: true, childList: true });
    }, 500);
  }

  function finalizeAttempt(result) {
    // compute timeTaken: prefer pendingAttempt.startTime, else activeStart, else fallback to 2min
    const start =
      pendingAttempt?.startTime || activeStart || Date.now() - 2 * 60 * 1000;
    const timeTakenMin = (Date.now() - start) / (1000 * 60);

    const payload = {
      slug: slugFromPath(),
      title: prettyTitle(),
      difficulty: difficultyFromDOM(),
      topics: topicsFromDOM(),
      timeTaken: timeTakenMin,
      result,
      timestamp: Date.now(),
    };

    // try to compute efficiency quickly in content side (uses expected times)
    // send to background
    chrome.runtime.sendMessage(
      { type: "SUBMISSION_EVENT", data: payload },
      () => {},
    );

    // cleanup
    chrome.storage.local.remove("activeSession");
    stopActiveSessionCleanup();
  }

  // handle SPA navigation resets
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // reset local session state
      pendingAttempt = null;
      acceptedHandled = false;
    }
  }).observe(document, { subtree: true, childList: true });

  // init observer
  attachResultObserver();

  // respond to popup queries and background notifications
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_CURRENT_PROBLEM") {
      sendResponse({
        slug: slugFromPath(),
        title: prettyTitle(),
        difficulty: difficultyFromDOM(),
        topics: topicsFromDOM(),
      });
      return true;
    }
    if (msg && msg.type === "SUBMISSION_HANDLED") {
      // background has processed submission; ensure local UI state updated
      stopActiveSessionCleanup();
      // also clear pendingAttempt and acceptedHandled to allow new attempts
      pendingAttempt = null;
      acceptedHandled = false;
      sendResponse({ ok: true });
      return true;
    }
  });

  // also expose quick manual start/stop listens through storage events (popup writes activeSession)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.activeSession) {
      const val = changes.activeSession.newValue;
      if (val) {
        active = true;
        activeStart = val.startTime;
      } else {
        active = false;
        activeStart = null;
      }
    }
  });
})();
