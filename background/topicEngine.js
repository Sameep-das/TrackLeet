/* background/topicEngine.js
   Multi-factor topic scoring as discussed.
*/

import { MAX_EFFICIENCY } from "./constants.js";

export function computeTopicStats(attemptHistory = [], submissionHistory = []) {
  const stats = {};

  // Build base counts and efficiency
  attemptHistory.forEach((a) => {
    const topics = a.topics || [];
    topics.forEach((topic) => {
      if (!stats[topic]) {
        stats[topic] = {
          attempts: 0,
          accepted: 0,
          easySolved: 0,
          mediumSolved: 0,
          hardSolved: 0,
          totalEfficiency: 0,
        };
      }
      const s = stats[topic];
      s.attempts++;
      if (a.result === "Accepted") {
        s.accepted++;
        if (a.difficulty === "Easy") s.easySolved++;
        if (a.difficulty === "Medium") s.mediumSolved++;
        if (a.difficulty === "Hard") s.hardSolved++;
        if (a.efficiency) s.totalEfficiency += a.efficiency;
      }
    });
  });

  // recent 5 accepted submissions for trend
  const recentAccepted = submissionHistory.slice(-5);

  Object.keys(stats).forEach((topic) => {
    const s = stats[topic];

    const A = s.attempts > 0 ? s.accepted / s.attempts : 0;
    const confidence = Math.min(s.attempts / 10, 1);
    const avgEfficiency = s.accepted > 0 ? s.totalEfficiency / s.accepted : 0;
    const E = Math.min(avgEfficiency / MAX_EFFICIENCY, 1);

    const totalAccepted = s.easySolved + s.mediumSolved + s.hardSolved;
    const difficultyWeight =
      totalAccepted === 0
        ? 0
        : (0.3 * s.easySolved + 0.5 * s.mediumSolved + 0.8 * s.hardSolved) /
          totalAccepted;

    const recentCount = recentAccepted.filter((r) =>
      (r.topics || []).includes(topic),
    ).length;
    const recentTrend = Math.min(recentCount / 5, 1);

    const TSS = 0.4 * A + 0.2 * E + 0.2 * difficultyWeight + 0.2 * recentTrend;
    const finalScore = TSS * confidence;

    s.acceptPct = A;
    s.avgEfficiency = avgEfficiency;
    s.strengthScore = finalScore;

    if (finalScore >= 0.7) s.classification = "Strong";
    else if (finalScore >= 0.4) s.classification = "Average";
    else s.classification = "Weak";
  });

  return stats;
}
