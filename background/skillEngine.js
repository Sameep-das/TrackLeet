/* background/skillEngine.js
   Efficiency + delta computation with anti-farming.
*/
import {
  DIFFICULTY_BASE,
  EXPECTED_TIME,
  MIN_SOLVE_TIME,
  MAX_EFFICIENCY,
} from "./constants.js";

export function computeEfficiency(diff, timeMin) {
  const t = Math.max(timeMin, MIN_SOLVE_TIME);
  const expected = EXPECTED_TIME[diff] ?? 30;
  const ratio = expected / t;
  const eff = Math.log(ratio + 1);
  return Math.min(eff, MAX_EFFICIENCY);
}

export function computeDelta(diff, timeMin, recentHistory = []) {
  const base = DIFFICULTY_BASE[diff] ?? 0;
  const efficiency = computeEfficiency(diff, timeMin);
  let delta = base * efficiency;

  // Anti-farming: if last 5 are mostly Easy and current is Easy, dampen
  const lastFive = recentHistory.slice(-5);
  const easyCount = lastFive.filter((h) => h.difficulty === "Easy").length;
  if (easyCount >= 4 && diff === "Easy") {
    delta *= 0.5;
  }

  return { delta, efficiency };
}
