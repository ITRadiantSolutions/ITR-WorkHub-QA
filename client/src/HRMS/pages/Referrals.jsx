import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Send, Paperclip, Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { jobPostsApi, referralsApi } from "../hrmsApi";

const STATUS_OPTIONS = ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "on_hold"];

const STATUS_TONE = {
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  shortlisted: "bg-violet-50 text-violet-700",
  interview_scheduled: "bg-cyan-50 text-cyan-700",
  selected: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  on_hold: "bg-slate-100 text-slate-600",
};

const PHONE_REGEX = /^\d{10}$/;
const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]{1,59}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {(status || "").replace(/_/g, " ")}
  </span>
);

function ReferralForm({ jobs, initialJobId, onSubmitted }) {
  const [jobId, setJobId] = useState(initialJobId || "");
  const [candidate, setCandidate] = useState({ name: "", email: "", phone: "", experienceYears: "", currentCompany: "", skills: "" });
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!jobId || !candidate.name.trim() || !candidate.email.trim()) {
      toast.warning("Job, candidate name and email are required");
      return;
    }
    if (!NAME_REGEX.test(candidate.name.trim())) {
      toast.warning("Enter a valid candidate name (letters only, 2-60 characters)");
      return;
    }
    if (!EMAIL_REGEX.test(candidate.email.trim())) {
      toast.warning("Enter a valid email address");
      return;
    }
    if (candidate.phone.trim() && !PHONE_REGEX.test(candidate.phone.trim())) {
      toast.warning("Enter a valid 10-digit phone number");
      return;
    }
    if (candidate.experienceYears !== "") {
      const exp = Number(candidate.experienceYears);
      if (!Number.isFinite(exp) || exp < 0 || exp > 99) {
        toast.warning("Experience must be between 0 and 99 years");
        return;
      }
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("notes", notes);
      formData.append("candidate", JSON.stringify({
        ...candidate,
        experienceYears: candidate.experienceYears ? Number(candidate.experienceYears) : null,
        skills: candidate.skills.split(",").map((s) => s.trim()).filter(Boolean),
      }));
      if (file) formData.append("resume", file);

      await referralsApi.create(formData);
      toast.success("Referral submitted");
      setCandidate({ name: "", email: "", phone: "", experienceYears: "", currentCompany: "", skills: "" });
      setNotes("");
      setFile(null);
      onSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit referral");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400";
  const label = "text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1";

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <h2 className="font-bold text-slate-900 flex items-center gap-2"><Send className="w-4 h-4 text-cyan-700" /> Refer someone</h2>

      <div>
        <label className={label}>Job *</label>
        <select className={input} value={jobId} onChange={(e) => setJobId(e.target.value)} required>
          <option value="">Select a job...</option>
          {jobs.map((j) => <option key={j._id} value={j._id}>{j.title}{j.department ? ` — ${j.department}` : ""}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Candidate name *</label>
          <input
            className={input}
            value={candidate.name}
            maxLength={60}
            onChange={(e) => setCandidate((p) => ({ ...p, name: e.target.value.replace(/[^A-Za-z .'-]/g, "") }))}
            required
          />
        </div>
        <div>
          <label className={label}>Email *</label>
          <input type="email" className={input} value={candidate.email} onChange={(e) => setCandidate((p) => ({ ...p, email: e.target.value }))} required />
        </div>
        <div>
          <label className={label}>Phone</label>
          <input
            type="tel"
            className={input}
            value={candidate.phone}
            maxLength={10}
            onChange={(e) => setCandidate((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
          />
        </div>
        <div>
          <label className={label}>Experience (years)</label>
          <input
            type="number"
            className={input}
            value={candidate.experienceYears}
            min={0}
            max={99}
            step={1}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "" && (Number(v) > 99 || Number(v) < 0)) return;
              setCandidate((p) => ({ ...p, experienceYears: v }));
            }}
          />
        </div>
        <div>
          <label className={label}>Current company</label>
          <input className={input} value={candidate.currentCompany} onChange={(e) => setCandidate((p) => ({ ...p, currentCompany: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Skills (comma separated)</label>
          <input className={input} value={candidate.skills} onChange={(e) => setCandidate((p) => ({ ...p, skills: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className={label}>Resume (PDF or Word)</label>
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      </div>

      <div>
        <label className={label}>Notes</label>
        <textarea rows={2} className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why are they a good fit?" />
      </div>

      <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow disabled:opacity-60">
        {saving ? "Submitting..." : "Submit referral"}
      </button>
    </form>
  );
}

export default function Referrals() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const [searchParams] = useSearchParams();
  const initialJobId = searchParams.get("jobId") || "";

  const [jobs, setJobs] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, refRes] = await Promise.all([
        jobPostsApi.list(),
        isHr ? referralsApi.all(statusFilter ? { status: statusFilter } : {}) : referralsApi.mine(),
      ]);
      setJobs((jobsRes.data || []).filter((j) => j.status === "published"));
      setReferrals(refRes.data || []);
    } catch {
      toast.error("Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }, [isHr, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadResume = async (referral) => {
    try {
      const res = await referralsApi.resumeUrl(referral._id);
      window.open(res.data.url, "_blank");
    } catch (err) {
      toast.error(err.response?.data?.message || "No resume available");
    }
  };

  const changeStatus = async (referral, status) => {
    try {
      await referralsApi.updateStatus(referral._id, { status });
      toast.success("Status updated");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Send className="w-6 h-6 text-cyan-700" /> Referrals
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isHr ? "Track every referral across the organization." : "Refer great people and follow their progress."}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <div className={isHr ? "" : "grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start"}>
          {!isHr && <ReferralForm jobs={jobs} initialJobId={initialJobId} onSubmitted={load} />}

          <div className="space-y-4">
            {isHr && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${!statusFilter ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                  All
                </button>
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${statusFilter === s ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Candidate</th>
                    <th className="text-left px-4 py-3">Job</th>
                    {isHr && <th className="text-left px-4 py-3">Referred by</th>}
                    <th className="text-left px-4 py-3">Submitted</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Resume</th>
                    {isHr && <th className="text-left px-4 py-3">Update status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {referrals.length === 0 && (
                    <tr><td colSpan={isHr ? 7 : 5} className="px-4 py-8 text-center text-slate-400 italic">No referrals yet.</td></tr>
                  )}
                  {referrals.map((r) => (
                    <tr key={r._id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{r.candidate?.name}</p>
                        <p className="text-xs text-slate-400">{r.candidate?.email}</p>
                      </td>
                      <td className="px-4 py-3">{r.job?.title}</td>
                      {isHr && <td className="px-4 py-3">{r.referredBy?.name}</td>}
                      <td className="px-4 py-3">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        {r.candidate?.resumeBlobName ? (
                          <button onClick={() => downloadResume(r)} className="text-cyan-700 font-semibold flex items-center gap-1 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        ) : (
                          <span className="text-slate-300 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> None</span>
                        )}
                      </td>
                      {isHr && (
                        <td className="px-4 py-3">
                          <select value={r.status} onChange={(e) => changeStatus(r, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
