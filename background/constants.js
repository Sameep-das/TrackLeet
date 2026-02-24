/* 
   Centralized configuration values.
   Change here if you want to tune metrics.
*/
// export const APP_STATES = {
//   UNINITIALIZED: "UNINITIALIZED",
//   IDLE: "IDLE",
//   SOLVING: "SOLVING",
// };

// ... keep your existing constants below

export const INITIAL_SKILL = 100;

export const IDEAL_RATIO = { Easy: 0.2, Medium: 0.5, Hard: 0.3 };

export const CONTEST_MAX = 3000;
export const STREAK_MAX_DAYS = 30;

export const DIFFICULTY_BASE = {
  Easy: 0,
  Medium: 2,
  Hard: 5,
};

export const EXPECTED_TIME = {
  Easy: 15,
  Medium: 30,
  Hard: 60,
};

export const MIN_SOLVE_TIME = 1;
export const MAX_EFFICIENCY = 3.5;

export const DECAY_START_DAYS = 2;
export const DECAY_RATE = 0.02;

export const WEAK_TOPIC_THRESHOLD = 0.4;
export const STRONG_TOPIC_THRESHOLD = 0.7;
