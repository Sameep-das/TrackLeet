/* background/background.js
   Service worker router: handles incoming messages from content & popup,
   orchestrates engines, persists state.
*/

import { getState, setState } from "./storage.js";
import { computeTopicStats } from "./topicEngine.js";
import { computeDelta } from "./skillEngine.js";
import { generateSuggestions } from "./suggestionEngine.js";
import { applyDecay } from "./decayEngine.js";
import { INITIAL_SKILL } from "./constants.js";

// receive messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SUBMISSION_EVENT") {
    handleSubmission(msg.data);
  } else if (msg.type === "FETCH_PROFILE") {
    // fetch profile directly (previously implemented by you); here we forward to popup
    // popup calls FETCH_PROFILE; profile fetching implementation must be in profileEngine.js
    // For simplicity, we will call profile fetch via global function if present
    (async () => {
      try {
        const profile = await (async function fetchProfileFromGraphQL(
          username,
        ) {
          try {
            const resp = await fetch("https://leetcode.com/graphql", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `
                  query getUserProfile($username: String!) {
                    matchedUser(username: $username) {
                      username
                      profile { userAvatar ranking }
                      submitStatsGlobal {
                        acSubmissionNum { difficulty count }
                      }
                    }
                    userContestRanking(username: $username) {
                      rating
                      attendedContestsCount
                    }
                  }
                `,
                variables: { username },
              }),
            });
            const json = await resp.json();
            if (!json.data?.matchedUser) return null;
            return {
              ...json.data.matchedUser,
              userContestRanking: json.data.userContestRanking,
            };
          } catch (e) {
            console.error("Profile fetch error", e);
            return null;
          }
        })(msg.username);

        sendResponse({ profile });
      } catch (e) {
        sendResponse({ profile: null });
      }
    })();
    return true; // async
  } else if (msg.type === "UPDATE_GOALS") {
    // update goals and regenerate suggestions
    (async () => {
      const state = await getState();
      const newGoals = msg.goals ?? state.goalsList ?? [];
      const topicStats = computeTopicStats(
        state.attemptHistory || [],
        state.submissionHistory || [],
      );
      const suggestions = generateSuggestions({
        goals: newGoals,
        topicStats,
        submissionHistory: state.submissionHistory || [],
        profileData: state.profileData,
      });
      await setState({ goalsList: newGoals, suggestions });
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// main submission handler
async function handleSubmission(data) {
  const state = await getState();

  let skill = state.skillScore !== undefined ? state.skillScore : INITIAL_SKILL;
  const attemptHistory = state.attemptHistory || [];
  const submissionHistory = state.submissionHistory || [];
  const lastActive = state.lastActive;

  // apply decay if needed
  skill = applyDecay(skill, lastActive);

  // Append attempt record (every submission attempt)
  // enrich attempt with efficiency if present (content may compute)
  const attempt = {
    slug: data.slug,
    title: data.title,
    difficulty: data.difficulty || "Medium",
    topics: data.topics || [],
    timeTaken: data.timeTaken || 0,
    result: data.result || "Unknown",
    timestamp: data.timestamp || Date.now(),
    efficiency: data.efficiency ?? undefined,
  };

  attemptHistory.push(attempt);

  // If accepted: compute delta and push to submissionHistory
  if (attempt.result === "Accepted") {
    const { delta, efficiency } = computeDelta(
      attempt.difficulty,
      attempt.timeTaken,
      submissionHistory,
    );
    skill += delta;

    const submissionRecord = {
      ...attempt,
      deltaSkill: delta,
      efficiency,
      skillAfter: skill,
    };

    submissionHistory.push(submissionRecord);
  }

  // Recompute topic stats (uses attemptHistory + submissionHistory)
  const topicStats = computeTopicStats(attemptHistory, submissionHistory);

  // Compute streak
  const streakInfo = computeStreak(submissionHistory);

  // Generate suggestions
  const suggestions = generateSuggestions({
    goals: state.goalsList || [],
    topicStats,
    submissionHistory,
    profileData: state.profileData,
  });

  // Save state (clear activeSession)
  await setState({
    skillScore: skill,
    attemptHistory,
    submissionHistory,
    topicStats,
    suggestions,
    lastActive: attempt.result === "Accepted" ? Date.now() : lastActive,
    streakInfo,
  });

  // ensure activeSession removed so popup stops the timer
  await chrome.storage.local.remove("activeSession");

  // notify any open LeetCode tabs so content script can update UI without reload
  try {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs || []) {
        try {
          if (t.url && t.url.includes("leetcode.com")) {
            chrome.tabs.sendMessage(
              t.id,
              { type: "SUBMISSION_HANDLED" },
              () => {},
            );
          }
        } catch (e) {
          /* ignore individual tab failures */
        }
      }
    });
  } catch (e) {
    /* ignore */
  }
}

/* helper: compute streak */
function computeStreak(submissionHistory = []) {
  if (!submissionHistory.length) return { currentStreak: 0 };
  const dates = [
    ...new Set(
      submissionHistory.map(
        (s) => new Date(s.timestamp).toISOString().split("T")[0],
      ),
    ),
  ];
  dates.sort().reverse();
  let streak = 0;
  let current = new Date();
  while (true) {
    const iso = current.toISOString().split("T")[0];
    if (dates.includes(iso)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else break;
  }
  return { currentStreak: streak };
}
