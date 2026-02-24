import { DECAY_START_DAYS, DECAY_RATE } from "./constants.js";

export function applyDecay(skill, lastActive) {
  if (!lastActive) return skill;

  const diffDays = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);

  if (diffDays <= DECAY_START_DAYS) return skill;

  const inactiveDays = diffDays - DECAY_START_DAYS;
  const decayAmount = skill * (DECAY_RATE * inactiveDays);

  return Math.max(0, skill - decayAmount);
}
