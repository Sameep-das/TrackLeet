/* background/storage.js
   Small wrapper for chrome.storage operations.
*/
export async function getState() {
  const all = await chrome.storage.local.get(null);
  // Ensure defaults
  const defaults = {
    skillScore: undefined,
    profileData: undefined,
    attemptHistory: [],
    submissionHistory: [],
    topicStats: {},
    goalsList: [],
    suggestions: [],
    activeSession: null,
    lastActive: null,
    streakInfo: { currentStreak: 0 },
  };
  return Object.assign(defaults, all);
}

export async function setState(data) {
  return await chrome.storage.local.set(data);
}
