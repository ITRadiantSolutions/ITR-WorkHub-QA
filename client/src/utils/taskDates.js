const toCalendarDay = (value) => {
  if (!value) return null;


  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const isTaskOverdue = (task, now = new Date()) => {
  if (!task?.dueDate || task.status === "DONE") return false;
  const dueDay = toCalendarDay(task.dueDate);
  const today = toCalendarDay(now);
  return Boolean(dueDay && today && dueDay < today);
};

export const formatTaskDueDate = (value, locale = "en-US", options = {}) => {
  const day = toCalendarDay(value);
  if (!day) return "";
  return day.toLocaleDateString(locale, options);
};
