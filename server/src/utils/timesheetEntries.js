const DAY_MS = 24 * 60 * 60 * 1000;

// Shared by entriesController (dashboard) and hrReportController (aggregates):
// flattens populated Timesheet documents into one record per (day, project).
export const flattenTimesheetRows = (timesheets) => {
  const entries = [];
  for (const ts of timesheets) {
    for (const row of ts.rows) {
      row.secs.forEach((secs, dayIndex) => {
        if (!secs) return;
        entries.push({
          date: new Date(ts.weekStart.getTime() + dayIndex * DAY_MS),
          hours: Number((secs / 3600).toFixed(2)),
          projectId: row.projectId?._id?.toString() || row.projectId?.toString(),
          projectName: row.projectId?.name,
          status: ts.status,
          userId: ts.userId._id?.toString() || ts.userId?.toString(),
          userName: ts.userId.name,
          managerId: ts.managerId,
        });
      });
    }
  }
  return entries;
};
