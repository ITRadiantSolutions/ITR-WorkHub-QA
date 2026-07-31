import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad2 = (n) => String(n).padStart(2, "0");
const fmtISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtDDMMYYYY = (d) => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
const fmtShort = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const isSameDay = (a, b) => fmtISODate(a) === fmtISODate(b);

const fmtHHMMSS = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const newRow = () => ({ projectId: "", task: "", hours: Array(7).fill(""), nsa: Array(7).fill(false), comment: "" });

const MAX_HOURS_PER_DAY = 8;
const MAX_HOURS_PER_WEEK = 40;
// Only non-negative numbers with at most one decimal point — rejects "-",
// letters, and anything else while the user is still typing.
const isValidHourInput = (value) => value === "" || /^\d*\.?\d*$/.test(value);

export default function TimesheetEntry() {
  const { id } = useParams();
  const { user } = useAuth();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [projects, setProjects] = useState([]);
  const [companyHolidays, setCompanyHolidays] = useState([]);
  const [managers, setManagers] = useState([]);
  const [managerId, setManagerId] = useState("");
  const [myTimesheets, setMyTimesheets] = useState([]);
  const [rows, setRows] = useState([newRow()]);
  const [current, setCurrent] = useState(null); // the loaded/saved timesheet doc, if any
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [timerProject, setTimerProject] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);
  const [managerTouched, setManagerTouched] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const today = new Date();
  const atCurrentWeek = fmtISODate(weekStart) === fmtISODate(startOfWeek(today));

  useEffect(() => {
    API.get("/projects")
      .then((res) => setProjects(res.data || []))
      .catch(() => toast.error("Failed to load projects"));
    API.get("/users/managers")
      .then((res) => setManagers(res.data || []))
      .catch(() => toast.error("Failed to load managers"));
    API.get("/company-holidays")
      .then((res) => setCompanyHolidays((res.data || []).map((h) => h.date)))
      .catch(() => toast.error("Failed to load the company holiday calendar"));
  }, []);

  // Default to the employee's own manager, once we know who that is.
  useEffect(() => {
    const ownManagerId = user?.managerId?._id || user?.managerId;
    if (ownManagerId) setManagerId((prev) => prev || ownManagerId);
  }, [user]);

  useEffect(() => {
    if (current?.managerId) setManagerId(current.managerId._id || current.managerId);
  }, [current]);

  useEffect(() => {
    if (id) return; // direct-id mode loads separately below
    let cancelled = false;
    API.get("/timesheets")
      .then((res) => !cancelled && setMyTimesheets(res.data || []))
      .catch(() => toast.error("Failed to load timesheets"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Direct-id (history "View") mode
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setCurrent(null);
    API.get(`/timesheets/${id}`)
      .then((res) => {
        if (cancelled) return;
        setCurrent(res.data);
        setWeekStart(new Date(res.data.weekStart));
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err.response?.data?.message || "Failed to load this timesheet";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Current-week mode: find the matching saved timesheet (if any) whenever the week or list changes
  useEffect(() => {
    if (id) return;
    const match = myTimesheets.find((t) => fmtISODate(new Date(t.weekStart)) === fmtISODate(weekStart));
    setCurrent(match || null);
    setLoading(false);
  }, [id, weekStart, myTimesheets]);

  // Populate the editable rows whenever the loaded timesheet changes
  useEffect(() => {
    if (current) {
      setRows(
        (current.rows || []).length
          ? current.rows.map((r) => ({
              projectId: r.projectId?._id || r.projectId || "",
              task: r.task || "",
              hours: (r.secs || Array(7).fill(0)).map((s) => (s ? (s / 3600).toString() : "")),
              nsa: r.nsa || Array(7).fill(false),
              comment: r.comment || "",
            }))
          : [newRow()],
      );
    } else {
      setRows([newRow()]);
    }
  }, [current]);

  // In id-mode (viewing a specific week from History), only editable once we've
  // actually confirmed that week's status — never fall back to "editable" just
  // because the fetch hasn't resolved (or failed) yet.
  const editable = id
    ? Boolean(current) && ["draft", "needs_edit", "rejected"].includes(current.status)
    : !current || ["draft", "needs_edit", "rejected"].includes(current.status);

  // Effective locked dates for a project = the company-wide calendar plus
  // that project's own extra holidays, minus any dates the project has
  // specifically opted out of (e.g. a US client working through an
  // India-only public holiday).
  const holidaysForProject = (projectId) => {
    const project = projects.find((p) => p._id === projectId);
    if (!project) return [];
    const excluded = new Set(project.excludedHolidays || []);
    return [...new Set([...companyHolidays, ...(project.holidays || [])])].filter((d) => !excluded.has(d));
  };

  // When a row's project changes, re-check which days are locked under the
  // *new* project's holidays (weekend lock never changes) and clear any
  // hours/NSA left over from the previous project — otherwise a value typed
  // while on one project stays in state (just visually disabled) after
  // switching to a project where that same day is now a holiday.
  const updateRow = (i, patch) =>
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (patch.projectId !== undefined) {
          const holidays = holidaysForProject(patch.projectId);
          const isLocked = (d) => d >= 5 || holidays.includes(fmtISODate(addDays(weekStart, d)));
          next.hours = next.hours.map((h, d) => (isLocked(d) ? "" : h));
          next.nsa = next.nsa.map((v, d) => (isLocked(d) ? false : v));
        }
        return next;
      }),
    );
  const updateHour = (i, dayIdx, value) => {
    if (!isValidHourInput(value)) return; // rejects negative numbers and non-numeric input
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, hours: r.hours.map((h, d) => (d === dayIdx ? value : h)) } : r)));
  };
  const updateNsa = (i, dayIdx, checked) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, nsa: r.nsa.map((n, d) => (d === dayIdx ? checked : n)) } : r)));
  const removeRow = (i) => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const addRow = () => setRows((prev) => [...prev, newRow()]);

  // Weekends and holidays (company-wide or project-declared) are never editable, regardless of timesheet status.
  const isWeekendDay = (d) => d >= 5;
  const isHolidayDay = (row, d) => holidaysForProject(row.projectId).includes(fmtISODate(addDays(weekStart, d)));

  const rowTotal = (row) => row.hours.reduce((sum, h) => sum + (parseFloat(h) || 0), 0);
  const grandTotal = useMemo(() => rows.reduce((sum, r) => sum + rowTotal(r), 0), [rows]);
  const dayTotals = useMemo(
    () => DAY_LABELS.map((_, d) => rows.reduce((sum, r) => sum + (parseFloat(r.hours[d]) || 0), 0)),
    [rows],
  );
  const overCapDays = dayTotals
    .map((total, d) => ({ day: DAY_LABELS[d], total }))
    .filter((d) => d.total > MAX_HOURS_PER_DAY);

  const totalError = rows.some((r) => r.projectId) && grandTotal === 0 ? "Please enter time in at least one cell before saving." : "";
  const capMessages = [];
  if (overCapDays.length) {
    capMessages.push(
      `${overCapDays.map((d) => `${d.day} (${d.total.toFixed(1)}h)`).join(", ")} exceed${overCapDays.length === 1 ? "s" : ""} the ${MAX_HOURS_PER_DAY}-hour daily limit.`,
    );
  }
  if (grandTotal > MAX_HOURS_PER_WEEK) {
    capMessages.push(`Weekly total (${grandTotal.toFixed(1)}h) exceeds the ${MAX_HOURS_PER_WEEK}-hour weekly limit.`);
  }
  const capError = capMessages.join(" ");

  const buildPayload = () => ({
    weekStart: fmtISODate(weekStart),
    weekEnd: fmtISODate(weekEnd),
    rows: rows
      .filter((r) => r.projectId)
      .map((r) => ({
        projectId: r.projectId,
        task: r.task,
        secs: r.hours.map((h) => Math.round((parseFloat(h) || 0) * 3600)),
        nsa: r.nsa,
        comment: r.comment,
      })),
  });

  const handleSave = async () => {
    setManagerTouched(true);
    if (!rows.some((r) => r.projectId)) {
      toast.error("Select a project on at least one row");
      return null;
    }
    if (capError) {
      toast.error(capError);
      return null;
    }
    setSaving(true);
    try {
      const res = await API.post("/timesheets/save", buildPayload());
      toast.success("Timesheet saved");
      setCurrent(res.data);
      setMyTimesheets((prev) => {
        const others = prev.filter((t) => t._id !== res.data._id);
        return [...others, res.data];
      });
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save timesheet");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setManagerTouched(true);
    if (!managerId) return toast.error("Select a manager before submitting");
    if (submitting) return; // guards the whole save+submit round trip, not just the save half
    setSubmitting(true);
    try {
      const saved = await handleSave();
      if (!saved) return;
      const res = await API.post(`/timesheets/${saved._id}/submit`, { managerId });
      toast.success("Submitted for approval");
      setCurrent(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────
  const toggleTimer = () => {
    if (timerRunning) {
      clearInterval(timerRef.current);
      setTimerRunning(false);
      if (timerSeconds > 0 && timerProject) {
        const todayIdx = DAY_LABELS.findIndex((_, i) => isSameDay(addDays(weekStart, i), today));
        if (todayIdx >= 0) {
          setRows((prev) => {
            let found = false;
            const next = prev.map((r) => {
              if (r.projectId !== timerProject) return r;
              found = true;
              const hrs = (parseFloat(r.hours[todayIdx]) || 0) + timerSeconds / 3600;
              return { ...r, hours: r.hours.map((h, d) => (d === todayIdx ? hrs.toFixed(2) : h)) };
            });
            if (found) return next;
            const row = { ...newRow(), projectId: timerProject };
            row.hours[todayIdx] = (timerSeconds / 3600).toFixed(2);
            return [...prev.filter((r) => r.projectId), row];
          });
          toast.success(`Added ${fmtHHMMSS(timerSeconds)} to today`);
        }
      }
      setTimerSeconds(0);
      return;
    }
    if (!timerProject) return toast.error("Select a project to start the timer");
    setTimerRunning(true);
    timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <main className="w-[92%] max-w-[1600px] mx-auto px-2 py-8">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
      <div className="p-4 flex items-center gap-3 flex-wrap">
        {!id && (
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition">
              <Icons.Back />
            </button>
            <span className="flex items-center gap-2 rounded-xl bg-teal-50 px-3.5 py-2 text-sm font-bold text-teal-700">
              <Icons.Calendar /> {fmtDDMMYYYY(weekStart)} – {fmtDDMMYYYY(weekEnd)}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              disabled={atCurrentWeek}
              title={atCurrentWeek ? "Future weeks aren't available yet" : undefined}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <Icons.Arrow />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {editable && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-2xl p-1.5">
              <select
                value={timerProject}
                onChange={(e) => setTimerProject(e.target.value)}
                disabled={timerRunning}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium bg-white disabled:opacity-60"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={toggleTimer}
                className={`h-9 flex items-center gap-1.5 px-3.5 rounded-xl text-white text-sm font-bold transition ${
                  timerRunning ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {timerRunning ? <Icons.Pause /> : <Icons.Play />} {timerRunning ? fmtHHMMSS(timerSeconds) : "Start"}
              </button>
              <button onClick={resetTimer} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 transition" title="Reset timer">
                <Icons.Refresh />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || submitting || Boolean(capError)}
                title={capError || undefined}
                className="h-10 flex items-center gap-1.5 px-4 rounded-[14px] border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition disabled:opacity-60"
              >
                <Icons.Save /> {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || submitting || Boolean(capError)}
                title={capError || undefined}
                className="h-10 flex items-center gap-1.5 px-5 rounded-[14px] bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold shadow-sm shadow-teal-100 transition disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        )}
        {!editable && current && (
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3.5 py-2 rounded-full">
            {current.status.replace(/_/g, " ")} — read only
          </span>
        )}
      </div>

      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-12 text-center">
          <p className="text-red-600 font-semibold mb-1">Couldn't load this timesheet</p>
          <p className="text-sm text-slate-500">{loadError}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-4 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wide min-w-[180px]">Project</th>
                  {DAY_LABELS.map((d, i) => {
                    const isToday = isSameDay(addDays(weekStart, i), today);
                    const isWeekend = i >= 5;
                    const overCap = dayTotals[i] > MAX_HOURS_PER_DAY;
                    return (
                      <th
                        key={d}
                        className={`px-2 py-3.5 font-bold text-center min-w-[84px] ${
                          overCap ? "text-red-600 bg-red-50" : isToday ? "text-teal-600 bg-teal-50/60" : isWeekend ? "text-slate-400 bg-slate-50/40" : "text-slate-600"
                        }`}
                      >
                        <span className="text-xs uppercase tracking-wide">{d}</span>
                        <div className={`text-[10px] font-normal mt-0.5 ${overCap ? "text-red-500 font-bold" : "text-slate-400"}`}>
                          {overCap ? `${dayTotals[i].toFixed(1)}h` : fmtShort(addDays(weekStart, i))}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wide text-center">Total</th>
                  <th className="px-3 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wide min-w-[140px]">Comment</th>
                  {editable && <th className="px-3 py-3.5" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <select
                        value={row.projectId}
                        onChange={(e) => updateRow(i, { projectId: e.target.value })}
                        disabled={!editable}
                        className="w-full rounded-lg border border-slate-200 text-sm px-2.5 py-2 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                      >
                        <option value="">Select Project</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    {DAY_LABELS.map((_, d) => {
                      const isToday = isSameDay(addDays(weekStart, d), today);
                      const isWeekend = isWeekendDay(d);
                      const isHoliday = isHolidayDay(row, d);
                      const locked = isWeekend || isHoliday;
                      const overCap = dayTotals[d] > MAX_HOURS_PER_DAY;
                      return (
                        <td key={d} className={`px-2 py-3 text-center align-top ${overCap ? "bg-red-50/60" : isToday ? "bg-teal-50/40" : locked ? "bg-slate-50/30" : ""}`}>
                          <input
                            value={row.hours[d]}
                            onChange={(e) => updateHour(i, d, e.target.value)}
                            disabled={!editable || locked}
                            min={0}
                            placeholder={isHoliday ? "Holiday" : "—"}
                            title={isHoliday ? "Holiday — not editable" : isWeekend ? "Weekend — not editable" : undefined}
                            className={`w-16 text-center rounded-lg border px-1.5 py-1.5 text-sm font-medium tabular-nums disabled:bg-slate-50 disabled:text-slate-300 focus:outline-none focus:ring-2 ${
                              overCap ? "border-red-300 focus:ring-red-500/30 focus:border-red-400" : "border-slate-200 focus:ring-teal-500/30 focus:border-teal-400"
                            }`}
                          />
                          <label className="flex flex-col items-center gap-0.5 mt-1.5 cursor-pointer" title="Applicable for NSA">
                            <input
                              type="checkbox"
                              checked={row.nsa[d]}
                              onChange={(e) => updateNsa(i, d, e.target.checked)}
                              disabled={!editable || locked}
                              className="accent-teal-600 w-3.5 h-3.5"
                            />
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">NSA</span>
                          </label>
                          {isHoliday && <div className="text-[9px] text-amber-500 font-semibold mt-1">Holiday</div>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-slate-100 font-bold text-slate-800 tabular-nums text-sm">
                        {rowTotal(row).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.comment}
                        onChange={(e) => updateRow(i, { comment: e.target.value })}
                        disabled={!editable}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                      />
                    </td>
                    {editable && (
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeRow(i)} className="w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition flex items-center justify-center mx-auto">
                          <Icons.Trash />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable && (
            <div className="flex justify-center py-3.5 border-t border-slate-50 bg-slate-50/30">
              <button onClick={addRow} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-dashed border-slate-300 text-slate-500 text-xs font-semibold hover:border-teal-400 hover:text-teal-600 hover:bg-white transition">
                <Icons.Plus /> Add row
              </button>
            </div>
          )}

          <div className={`px-5 py-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 ${totalError || capError ? "bg-red-50/50" : "bg-emerald-50/30"}`}>
            <span className="font-bold text-slate-800">
              Total Hours (Mon–Fri): <span className="tabular-nums text-teal-700">{grandTotal.toFixed(1)}</span>
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              {editable && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Manager</span>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium bg-white ${
                      managerTouched && !managerId ? "border-red-300 ring-1 ring-red-100" : "border-slate-200"
                    }`}
                  >
                    <option value="">Select a manager...</option>
                    {managers.map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                  {managerTouched && !managerId && <span className="text-xs text-red-600 font-medium">Required before you can submit</span>}
                </div>
              )}
              {(totalError || capError) && (
                <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                  <Icons.Alert /> {capError || totalError}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
