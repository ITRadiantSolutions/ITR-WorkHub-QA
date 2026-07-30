// Shared week/date-range helpers used by timesheets, entries, and HR reports.

export const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Mirrors the preset ranges routes_entries.py exposed for dashboard filtering.
export const resolvePresetRange = (preset, now = new Date()) => {
  const thisWeekStart = startOfWeek(now);
  switch (preset) {
    case "this_week":
      return { start: thisWeekStart, end: addDays(thisWeekStart, 6) };
    case "last_week":
      return { start: addDays(thisWeekStart, -7), end: addDays(thisWeekStart, -1) };
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
    case "last_6_months":
      return { start: new Date(now.getFullYear(), now.getMonth() - 6, 1), end: now };
    default:
      return null;
  }
};
