/*
  Calculates streak based on submission history
*/

export function calculateStreak(history = []) {
  if (!history.length) return 0;

  const dates = history.map(
    (h) => new Date(h.timestamp).toISOString().split("T")[0],
  );

  const uniqueDates = [...new Set(dates)].sort().reverse();

  let streak = 0;
  let current = new Date();

  while (true) {
    const iso = current.toISOString().split("T")[0];
    if (uniqueDates.includes(iso)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
