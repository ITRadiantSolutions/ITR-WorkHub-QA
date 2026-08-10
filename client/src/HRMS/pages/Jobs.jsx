import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Plus, Search, MapPin, Users as UsersIcon, X, Check, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { jobPostsApi, jobRequestsApi } from "../hrmsApi";
import JobRequestForm from "../components/JobRequestForm";
import JobRequestClarificationThread from "../components/JobRequestClarificationThread";

const STATUS_TONE = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  clarification_required: "bg-orange-50 text-orange-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  published: "bg-cyan-50 text-cyan-700",
  closed: "bg-slate-100 text-slate-600",
  archived: "bg-slate-100 text-slate-400",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {(status || "").replace(/_/g, " ")}
  </span>
);

function JobPostCard({ job, isHr, isManager, isEmployee, onRefer, onPublish, onClose, onArchive }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-bold text-slate-900">{job.title}</h3>
          <p className="text-xs text-slate-500">{job.department}</p>
        </div>
        <Badge status={job.status} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
        {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
        <span>{job.employmentType}</span>
        {job.experienceRequired && <span>{job.experienceRequired}</span>}
        <span className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" />{job.positions} opening{job.positions === 1 ? "" : "s"}</span>
      </div>
      {job.skillsRequired?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {job.skillsRequired.map((s) => (
            <span key={s} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">{s}</span>
          ))}
        </div>
      )}
      {job.description && <p className="text-sm text-slate-600 mb-3 line-clamp-3">{job.description}</p>}
      <div className="flex gap-2">
        {(isManager || isEmployee) && job.status === "published" && (
          <button onClick={() => onRefer(job)} className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold">
            Refer Someone
          </button>
        )}
        {isHr && (
          <>
            {job.status !== "published" && (
              <button onClick={() => onPublish(job)} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                Publish
              </button>
            )}
            {job.status === "published" && (
              <button onClick={() => onClose(job)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                Close
              </button>
            )}
            {job.status !== "archived" && (
              <button onClick={() => onArchive(job)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                Archive
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateJobPostForm({ onSubmit, onClose, saving }) {
  const [form, setForm] = useState({ title: "", department: "", location: "", positions: 1, employmentType: "Full-time", description: "" });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Create job post</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <input placeholder="Job title" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.title} onChange={set("title")} />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Department" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.department} onChange={set("department")} />
          <input placeholder="Location" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.location} onChange={set("location")} />
        </div>
        <textarea placeholder="Description" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={set("description")} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving || !form.title.trim()} onClick={() => onSubmit(form)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobRequestDetailModal({ jobRequest, isHr, isOwner, onClose, onReview, onAskQuestion, onRespond, onPublish }) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{jobRequest.title}</h2>
            <p className="text-xs text-slate-500">Requested by {jobRequest.requestedBy?.name}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
          <Badge status={jobRequest.status} />
          <div className="grid grid-cols-2 gap-3 text-slate-600">
            <p><span className="font-semibold">Department:</span> {jobRequest.department || "—"}</p>
            <p><span className="font-semibold">Positions:</span> {jobRequest.positions}</p>
            <p><span className="font-semibold">Location:</span> {jobRequest.location || "—"}</p>
            <p><span className="font-semibold">Priority:</span> {jobRequest.priority}</p>
          </div>
          {jobRequest.description && <p className="text-slate-600">{jobRequest.description}</p>}
          {jobRequest.businessJustification && (
            <p className="text-slate-600"><span className="font-semibold">Business justification:</span> {jobRequest.businessJustification}</p>
          )}
          {jobRequest.rejectionReason && (
            <p className="text-red-600"><span className="font-semibold">Rejection reason:</span> {jobRequest.rejectionReason}</p>
          )}

          <JobRequestClarificationThread jobRequest={jobRequest} isHr={isHr} isOwner={isOwner} onAskQuestion={onAskQuestion} onRespond={onRespond} />
        </div>

        {isHr && (
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
            {["submitted", "under_review"].includes(jobRequest.status) && (
              <>
                {showReject ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button onClick={() => onReview("reject", rejectionReason)} className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">
                      Confirm reject
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowReject(true)} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                )}
                <button onClick={() => onReview("approve")} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Approve
                </button>
              </>
            )}
            {jobRequest.status === "approved" && (
              <button onClick={onPublish} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold">
                Publish as job post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Jobs() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const isManager = user?.roles?.hrms === "manager";
  const isEmployee = !isHr && !isManager;
  const navigate = useNavigate();

  const [tab, setTab] = useState(isHr ? "requests" : "published");
  const [publishedJobs, setPublishedJobs] = useState([]);
  const [jobRequests, setJobRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPublished = useCallback(() => {
    jobPostsApi.list().then((res) => setPublishedJobs(res.data || [])).catch(() => toast.error("Failed to load jobs"));
  }, []);
  const loadRequests = useCallback(() => {
    jobRequestsApi.list().then((res) => setJobRequests(res.data || [])).catch(() => toast.error("Failed to load job requests"));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPublished(), loadRequests()]).finally(() => setLoading(false));
  }, [loadPublished, loadRequests]);

  const filteredPublished = publishedJobs.filter((j) => {
    if (isHr) return true;
    return j.status === "published";
  }).filter((j) => !search.trim() || j.title.toLowerCase().includes(search.toLowerCase()) || j.department?.toLowerCase().includes(search.toLowerCase()));

  const handleRefer = (job) => navigate(`/hrms/referrals?jobId=${job._id}`);

  const handleCreateRequest = async (data) => {
    setSaving(true);
    try {
      await jobRequestsApi.create(data);
      toast.success("Job request submitted");
      setShowRequestForm(false);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePost = async (data) => {
    setSaving(true);
    try {
      await jobPostsApi.create(data);
      toast.success("Job post created");
      setShowCreatePost(false);
      loadPublished();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create job post");
    } finally {
      setSaving(false);
    }
  };

  const refreshSelected = async (id) => {
    const res = await jobRequestsApi.byId(id);
    setSelectedRequest(res.data);
  };

  const handleReview = async (action, rejectionReason) => {
    try {
      await jobRequestsApi.review(selectedRequest._id, action, rejectionReason);
      toast.success(`Request ${action}d`);
      await refreshSelected(selectedRequest._id);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to review request");
    }
  };

  const handleAskQuestion = async (question) => {
    try {
      await jobRequestsApi.askClarification(selectedRequest._id, question);
      await refreshSelected(selectedRequest._id);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to ask question");
    }
  };

  const handleRespond = async (response) => {
    try {
      await jobRequestsApi.respondClarification(selectedRequest._id, response);
      await refreshSelected(selectedRequest._id);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to respond");
    }
  };

  const handlePublishRequest = async () => {
    try {
      await jobRequestsApi.publish(selectedRequest._id);
      toast.success("Published as a job post");
      setSelectedRequest(null);
      loadRequests();
      loadPublished();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to publish");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-cyan-700" /> Jobs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isHr ? "Review requests and manage published openings." : "Browse open roles and refer great people."}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowRequestForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Request a new job
          </button>
        )}
        {isHr && (
          <button onClick={() => setShowCreatePost(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Create job post
          </button>
        )}
      </div>

      {(isHr || isManager) && (
        <div className="flex gap-2 mb-5">
          {isHr && (
            <button onClick={() => setTab("requests")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "requests" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              Job Requests
            </button>
          )}
          <button onClick={() => setTab("published")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "published" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            Published Jobs
          </button>
          {isManager && (
            <button onClick={() => setTab("mine")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "mine" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              My Requests
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {(tab === "published" || isEmployee) && (
            <div className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or department..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              {filteredPublished.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No open jobs right now.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPublished.map((job) => (
                    <JobPostCard
                      key={job._id}
                      job={job}
                      isHr={isHr}
                      isManager={isManager}
                      isEmployee={isEmployee}
                      onRefer={handleRefer}
                      onPublish={(j) => jobPostsApi.publish(j._id).then(() => { toast.success("Published"); loadPublished(); })}
                      onClose={(j) => jobPostsApi.close(j._id).then(() => { toast.success("Closed"); loadPublished(); })}
                      onArchive={(j) => jobPostsApi.archive(j._id).then(() => { toast.success("Archived"); loadPublished(); })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "requests" && isHr && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Title</th>
                    <th className="text-left px-4 py-3">Manager</th>
                    <th className="text-left px-4 py-3">Department</th>
                    <th className="text-left px-4 py-3">Positions</th>
                    <th className="text-left px-4 py-3">Priority</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobRequests.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No job requests yet.</td></tr>
                  )}
                  {jobRequests.map((r) => (
                    <tr key={r._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.title}</td>
                      <td className="px-4 py-3">{r.requestedBy?.name}</td>
                      <td className="px-4 py-3">{r.department || "—"}</td>
                      <td className="px-4 py-3">{r.positions}</td>
                      <td className="px-4 py-3">{r.priority}</td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedRequest(r)} className="text-cyan-700 font-semibold hover:underline">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "mine" && isManager && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobRequests.length === 0 && <p className="text-sm text-slate-400 italic">You haven't requested any openings yet.</p>}
              {jobRequests.map((r) => (
                <button key={r._id} onClick={() => setSelectedRequest(r)} className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{r.title}</h3>
                    <Badge status={r.status} />
                  </div>
                  <p className="text-xs text-slate-500">{r.department} · {r.positions} opening{r.positions === 1 ? "" : "s"}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showRequestForm && (
        <JobRequestForm saving={saving} onClose={() => setShowRequestForm(false)} onSubmit={handleCreateRequest} />
      )}
      {showCreatePost && (
        <CreateJobPostForm saving={saving} onClose={() => setShowCreatePost(false)} onSubmit={handleCreatePost} />
      )}
      {selectedRequest && (
        <JobRequestDetailModal
          jobRequest={selectedRequest}
          isHr={isHr}
          isOwner={isManager && selectedRequest.requestedBy?._id === (user?._id || user?.id)}
          onClose={() => setSelectedRequest(null)}
          onReview={handleReview}
          onAskQuestion={handleAskQuestion}
          onRespond={handleRespond}
          onPublish={handlePublishRequest}
        />
      )}
    </main>
  );
}
