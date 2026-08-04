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
const TIMER_STORAGE_KEY = "timesheet_timer_v1";
// A single leading digit (0-9, the daily cap is 8 anyway) plus at most 2
// decimal places — rejects "-", letters, multi-digit whole hours like
// "22", and anything past 2 decimals while the user is still typing.
const isValidHourInput = (value) => value === "" || /^\d?(\.\d{0,2})?$/.test(value);

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
  const [resubmitReason, setResubmitReason] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  const draftKey = (tsId) => `timesheet_edit_draft_${tsId}`;
  const clearDraft = () => {
    if (current?._id) localStorage.removeItem(draftKey(current._id));
    setDraftRestored(false);
  };
  const discardDraft = () => {
    clearDraft();
    window.location.reload();
  };

  const weekEnd = addDays(weekStart, 6);
  const today = new Date();
  const atCurrentWeek = fmtISODate(weekStart) === fmtISODate(startOfWeek(today));

  useEffect(() => {
    if (!user?._id) return;
    API.get("/projects")
      .then((res) => {
        // The shared /projects endpoint returns every project for FlowTrack
        // admins/PMs/HR-or-manager roles (it's built for project management
        // screens). For the timesheet dropdown we only ever want projects
        // this person is actually allocated to via teamMembers, regardless
        // of what their other-module roles unlock.
        const allocated = (res.data || []).filter((p) =>
          (p.teamMembers || []).some((tm) => (tm?._id || tm) === user._id),
        );
        setProjects(allocated);
      })
      .catch(() => toast.error("Failed to load projects"));
    API.get("/users/managers")
      .then((res) => setManagers(res.data || []))
      .catch(() => toast.error("Failed to load managers"));
    API.get("/company-holidays")
      .then((res) => setCompanyHolidays((res.data || []).map((h) => h.date)))
      .catch(() => toast.error("Failed to load the company holiday calendar"));
  }, [user?._id]);

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

  // Populate the editable rows whenever the loaded timesheet changes. For a
  // needs_edit/rejected week (a resubmission), prefer a locally auto-saved
  // draft over the server copy if one exists and differs — protects
  // in-progress edits from a crashed tab or accidental navigation.
  useEffect(() => {
    if (!current) {
      setRows([newRow()]);
      return;
    }
    const serverRows = (current.rows || []).length
      ? current.rows.map((r) => ({
          projectId: r.projectId?._id || r.projectId || "",
          task: r.task || "",
          hours: (r.secs || Array(7).fill(0)).map((s) => (s ? (s / 3600).toString() : "")),
          nsa: r.nsa || Array(7).fill(false),
          comment: r.comment || "",
        }))
      : [newRow()];

    if (id && ["needs_edit", "rejected"].includes(current.status)) {
      try {
        const saved = JSON.parse(localStorage.getItem(draftKey(current._id)) || "null");
        if (saved && JSON.stringify(saved.rows) !== JSON.stringify(serverRows)) {
          setRows(saved.rows);
          setResubmitReason(saved.resubmitReason || "");
          setDraftRestored(true);
          return;
        }
      } catch {
        // ignore corrupt/unparseable local storage
      }
    }
    setRows(serverRows);
  }, [current, id]);

  // Auto-save the in-progress resubmission so a crashed tab doesn't lose edits.
  useEffect(() => {
    if (!id || !current || !["needs_edit", "rejected"].includes(current.status)) return;
    localStorage.setItem(draftKey(current._id), JSON.stringify({ rows, resubmitReason, savedAt: Date.now() }));
  }, [rows, resubmitReason, id, current]);

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
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const hasHours = (parseFloat(value) || 0) > 0;
        return {
          ...r,
          hours: r.hours.map((h, d) => (d === dayIdx ? value : h)),
          // NSA only makes sense on a day that actually has logged hours —
          // clearing the hours field clears any NSA flag left over for it.
          nsa: hasHours ? r.nsa : r.nsa.map((n, d) => (d === dayIdx ? false : n)),
        };
      }),
    );
  };
  const updateNsa = (i, dayIdx, checked) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, nsa: r.nsa.map((n, d) => (d === dayIdx ? checked : n)) } : r)));
  const removeRow = (i) => {
    const row = rows[i];
    const hasData = row.hours.some((h) => (parseFloat(h) || 0) > 0) || row.comment.trim();
    if (hasData && !window.confirm("This row has logged hours. Remove it anyway? This action cannot be undone.")) return;
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };
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

  // Once other rows already account for the full daily cap, block this cell
  // from accepting new hours instead of letting the total run over and only
  // flagging it afterward. A cell that already has its own value stays
  // editable, so reducing/clearing an existing entry is never locked out.
  const isDayFullForRow = (rowIdx, d) => {
    const ownValue = parseFloat(rows[rowIdx].hours[d]) || 0;
    if (ownValue > 0) return false;
    return dayTotals[d] - ownValue >= MAX_HOURS_PER_DAY;
  };

  const totalError = rows.some((r) => r.projectId) && grandTotal === 0 ? "Please enter time in at least one cell before saving." : "";

  // A week can only be submitted once it has actually ended — otherwise an
  // employee could submit Monday's partial week as if it were final.
  const weekNotEnded = fmtISODate(today) <= fmtISODate(weekEnd);

  // Every weekday that isn't a company holiday needs at least some logged
  // time before the week can be submitted — a partially-filled week can
  // still be saved as a draft, just not sent for approval.
  const missingWeekdays = DAY_LABELS.map((label, d) => ({ label, d }))
    .filter(({ d }) => d < 5 && !companyHolidays.includes(fmtISODate(addDays(weekStart, d))))
    .filter(({ d }) => dayTotals[d] === 0)
    .map(({ label }) => label);
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

  const handleSave = async (silent = false) => {
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
      if (!silent) toast.success("Timesheet saved");
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
    if (weekNotEnded) {
      return toast.error("This week hasn't ended yet — you can submit once the week is complete.");
    }
    if (missingWeekdays.length) {
      return toast.error(`Log time for ${missingWeekdays.join(", ")} before submitting — save as a draft if you need to finish later.`);
    }
    if (submitting) return; // guards the whole save+submit round trip, not just the save half
    setSubmitting(true);
    try {
      const saved = await handleSave(true);
      if (!saved) return;
      const res = await API.post(`/timesheets/${saved._id}/submit`, { managerId, resubmitComment: resubmitReason });
      toast.success("Submitted for approval");
      setCurrent(res.data);
      setResubmitReason("");
      clearDraft();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────
  // Pausing commits only the *new* elapsed time (timerSeconds - committedSeconds)
  // to today's hours cell, then keeps the clock's value on screen so resuming
  // continues counting up instead of restarting from 00:00:00.
  const [committedSeconds, setCommittedSeconds] = useState(0);

  const toggleTimer = () => {
    if (timerRunning) {
      clearInterval(timerRef.current);
      setTimerRunning(false);
      const delta = timerSeconds - committedSeconds;
      if (delta > 0 && timerProject) {
        const todayIdx = DAY_LABELS.findIndex((_, i) => isSameDay(addDays(weekStart, i), today));
        if (todayIdx >= 0) {
          setRows((prev) => {
            let found = false;
            const next = prev.map((r) => {
              if (r.projectId !== timerProject) return r;
              found = true;
              const hrs = (parseFloat(r.hours[todayIdx]) || 0) + delta / 3600;
              return { ...r, hours: r.hours.map((h, d) => (d === todayIdx ? hrs.toFixed(2) : h)) };
            });
            if (found) return next;
            const row = { ...newRow(), projectId: timerProject };
            row.hours[todayIdx] = (delta / 3600).toFixed(2);
            return [...prev.filter((r) => r.projectId), row];
          });
          toast.success(`Added ${fmtHHMMSS(delta)} to today`);
        }
        setCommittedSeconds(timerSeconds);
      }
      return;
    }
    if (!timerProject) return toast.error("Select a project to start the timer");
    if (!atCurrentWeek) return toast.error("The timer only works for the current week");
    if (holidaysForProject(timerProject).includes(fmtISODate(today))) {
      return toast.error("Today is a holiday for this project — the timer can't be started");
    }
    setTimerRunning(true);
    timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerSeconds(0);
    setCommittedSeconds(0);
    localStorage.removeItem(TIMER_STORAGE_KEY);
  };

  // Hard-stop at the daily cap so a forgotten timer can't silently run past it.
  useEffect(() => {
    if (timerRunning && timerSeconds >= MAX_HOURS_PER_DAY * 3600) {
      toast.warning(`Timer stopped automatically at the ${MAX_HOURS_PER_DAY}-hour daily limit.`);
      toggleTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds]);

  // Restore an in-progress timer for the current week on mount (survives a
  // reload/navigation) — anything logged for a different week is discarded.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || "null");
      if (!saved || saved.weekStartISO !== fmtISODate(startOfWeek(new Date()))) return;
      setTimerProject(saved.timerProject || "");
      setCommittedSeconds(saved.committedSeconds || 0);
      if (saved.timerRunning && saved.persistedAt) {
        const elapsedSincePersist = Math.max(0, Math.floor((Date.now() - saved.persistedAt) / 1000));
        setTimerSeconds((saved.timerSeconds || 0) + elapsedSincePersist);
        setTimerRunning(true);
        timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
      } else {
        setTimerSeconds(saved.timerSeconds || 0);
      }
    } catch {
      // ignore corrupt/unparseable local storage
    }
  }, []);

  // Persist the timer's state on every tick/change so it survives a reload.
  useEffect(() => {
    if (!timerProject && timerSeconds === 0) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({
        timerProject,
        timerSeconds,
        committedSeconds,
        timerRunning,
        persistedAt: Date.now(),
        weekStartISO: fmtISODate(startOfWeek(new Date())),
      }),
    );
  }, [timerProject, timerSeconds, committedSeconds, timerRunning]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <main className="w-[92%] max-w-[1600px] mx-auto px-2 py-8">
      {draftRestored && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2 font-medium">
            <Icons.Alert /> Restored unsaved changes from your last visit to this week.
          </span>
          <button onClick={discardDraft} className="shrink-0 font-bold underline hover:text-amber-900">
            Discard draft &amp; reload
          </button>
        </div>
      )}
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
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-2xl p-1.5" title={!atCurrentWeek ? "The timer only works for the current week" : undefined}>
              <select
                value={timerProject}
                onChange={(e) => setTimerProject(e.target.value)}
                disabled={timerRunning || timerSeconds > 0 || !atCurrentWeek}
                title={timerSeconds > 0 ? "Reset the timer before switching projects" : undefined}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium bg-white disabled:opacity-60"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={toggleTimer}
                disabled={!timerRunning && !atCurrentWeek}
                title={timerRunning ? "Pause" : timerSeconds > 0 ? "Resume" : "Start"}
                className={`h-9 flex items-center gap-1.5 px-3.5 rounded-xl text-white text-sm font-bold transition disabled:opacity-50 ${
                  timerRunning ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {timerRunning ? <Icons.Pause /> : <Icons.Play />}{" "}
                {timerRunning ? fmtHHMMSS(timerSeconds) : timerSeconds > 0 ? `Resume ${fmtHHMMSS(timerSeconds)}` : "Start"}
              </button>
              <button onClick={resetTimer} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 transition" title="Reset timer">
                <Icons.Refresh />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave()}
                disabled={saving || submitting || Boolean(capError)}
                title={capError || undefined}
                className="h-10 flex items-center gap-1.5 px-4 rounded-[14px] border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition disabled:opacity-60"
              >
                <Icons.Save /> {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || submitting || Boolean(capError) || weekNotEnded}
                title={capError || (weekNotEnded ? "This week hasn't ended yet — you can submit once the week is complete." : undefined)}
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
                        {projects
                          .filter((p) => p._id === row.projectId || !rows.some((r, idx) => idx !== i && r.projectId === p._id))
                          .map((p) => (
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
                      const hasHours = (parseFloat(row.hours[d]) || 0) > 0;
                      const dayFull = !locked && isDayFullForRow(i, d);
                      return (
                        <td key={d} className={`px-2 py-3 text-center align-top ${overCap ? "bg-red-50/60" : isToday ? "bg-teal-50/40" : locked || dayFull ? "bg-slate-50/30" : ""}`}>
                          <input
                            value={row.hours[d]}
                            onChange={(e) => updateHour(i, d, e.target.value)}
                            disabled={!editable || locked || dayFull}
                            min={0}
                            placeholder={isHoliday ? "Holiday" : dayFull ? "Full" : "—"}
                            title={
                              isHoliday
                                ? "Holiday — not editable"
                                : isWeekend
                                  ? "Weekend — not editable"
                                  : dayFull
                                    ? `Other rows already log ${MAX_HOURS_PER_DAY}h for this day — the daily limit is reached`
                                    : undefined
                            }
                            className={`w-16 text-center rounded-lg border px-1.5 py-1.5 text-sm font-medium tabular-nums disabled:bg-slate-50 disabled:text-slate-300 focus:outline-none focus:ring-2 ${
                              overCap ? "border-red-300 focus:ring-red-500/30 focus:border-red-400" : "border-slate-200 focus:ring-teal-500/30 focus:border-teal-400"
                            }`}
                          />
                          <label className="flex flex-col items-center gap-0.5 mt-1.5 cursor-pointer" title={hasHours ? "Applicable for NSA" : "Enter hours for this day to enable NSA"}>
                            <input
                              type="checkbox"
                              checked={row.nsa[d]}
                              onChange={(e) => updateNsa(i, d, e.target.checked)}
                              disabled={!editable || locked || !hasHours}
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

          {editable && current && ["needs_edit", "rejected"].includes(current.status) && (
            <div className="px-5 py-4 border-t border-slate-100 bg-amber-50/40">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                What changed since your manager's feedback? (included when you resubmit)
              </label>
              <textarea
                value={resubmitReason}
                onChange={(e) => setResubmitReason(e.target.value)}
                rows={2}
                placeholder="Explain what you updated..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              />
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
