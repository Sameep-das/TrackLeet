/* background/suggestionEngine.js
   Deterministic suggestion engine that uses:
   - goalsList
   - topicStats (weakness)
   - recent submission topics (recency)
   - difficulty mismatch (derived from profile vs ideal)
   Produces suggestions as {title, url, reason}
*/

export function generateSuggestions({
  goals = [],
  topicStats = {},
  submissionHistory = [],
  profileData = null,
}) {
  // Candidate topics: goals first, then weak topics, then others
  const weakTopics = Object.entries(topicStats)
    .filter(([_, s]) => s.classification === "Weak")
    .map(([t]) => t);

  const candidates = [...new Set([...goals, ...weakTopics])];

  // If no candidates, fallback to top topics from profileData or most attempted
  if (!candidates.length) {
    if (profileData && profileData.submitStatsGlobal) {
      const tags = profileData.submitStatsGlobal.acSubmissionNum || [];
      // fallback: search by most frequent tags in submissionHistory
      candidates.push("Array"); // fallback seed
    } else if (submissionHistory.length) {
      submissionHistory.slice(-5).forEach((s) => {
        (s.topics || []).forEach((t) => candidates.push(t));
      });
    }
  }

  // Compute recency set
  const recentTopics = new Set(
    submissionHistory.slice(-5).flatMap((s) => s.topics || []),
  );

  // Assemble suggestion objects: we produce a search link per topic
  const suggestions = candidates.slice(0, 10).map((topic) => {
    const reasonParts = [];
    if (goals.includes(topic)) reasonParts.push("Matches your goal");
    if (weakTopics.includes(topic)) reasonParts.push("Identified weak topic");
    if (recentTopics.has(topic))
      reasonParts.push("Worked recently — try deeper problems");
    const reason = reasonParts.length
      ? reasonParts.join(" · ")
      : "Practice this topic";

    return {
      title: `Practice: ${topic}`,
      url: `https://leetcode.com/problemset/all/?search=${encodeURIComponent(topic)}`,
      reason,
    };
  });

  // Return top 5
  return suggestions.slice(0, 5);
}
