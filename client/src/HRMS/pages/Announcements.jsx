import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Megaphone, Plus, X, Pin, Trash2, Paperclip, CheckCircle2, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { announcementsApi } from "../hrmsApi";

const CATEGORY_LABELS = { company_news: "Company News", policy_update: "Policy Update", birthday: "Birthday", general: "General" };
const CATEGORY_TONE = {
  company_news: "bg-cyan-50 text-cyan-700",
  policy_update: "bg-violet-50 text-violet-700",
  birthday: "bg-pink-50 text-pink-700",
  general: "bg-slate-100 text-slate-600",
};

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function AnnouncementModal({ initial, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || "",
    body: initial?.body || "",
    category: initial?.category || "general",
    isPinned: initial?.isPinned || false,
    expiresAt: initial?.expiresAt ? initial.expiresAt.slice(0, 10) : "",
  }));
  const [file, setFile] = useState(null);
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{initial ? "Edit announcement" : "New announcement"}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <input placeholder="Title" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.title} onChange={set("title")} />
        <textarea placeholder="Body" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.body} onChange={set("body")} />
        <div className="grid grid-cols-2 gap-3">
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.category} onChange={set("category")}>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" placeholder="Expires (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.expiresAt} onChange={set("expiresAt")} />
        </div>
        <p className="text-[11px] text-slate-400 -mt-2">Visible through the end of the selected day. Leave blank to never expire.</p>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.isPinned} onChange={set("isPinned")} className="rounded border-slate-300" />
          Pin to top
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer border border-dashed border-slate-300 rounded-xl px-3 py-2">
          <Paperclip className="w-4 h-4" />
          {file ? file.name : initial?.attachmentFileName || "Attach a file (optional)"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !form.title.trim()}
            onClick={() => onSubmit({ ...form, expiresAt: form.expiresAt || "" }, file)}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : initial ? "Save changes" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcknowledgedByModal({ announcement, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Acknowledged by</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto space-y-1.5">
          {announcement.acknowledgedBy.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No one yet.</p>
          ) : (
            announcement.acknowledgedBy.map((a, i) => (
              <div key={i} className="flex justify-between text-sm px-3 py-2 rounded-xl bg-slate-50">
                <span className="text-slate-700">{a.user?.name || "—"}</span>
                <span className="text-slate-400 text-xs">{fmtDate(a.at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Announcements() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ackViewing, setAckViewing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    announcementsApi.list().then((r) => setAnnouncements(r.data || [])).catch(() => toast.error("Failed to load announcements")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toFormData = (form, file) => {
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("body", form.body);
    fd.append("category", form.category);
    fd.append("isPinned", form.isPinned);
    fd.append("expiresAt", form.expiresAt);
    if (file) fd.append("attachment", file);
    return fd;
  };

  const handleSubmit = async (form, file) => {
    setSaving(true);
    try {
      if (editing) {
        await announcementsApi.update(editing._id, toFormData(form, file));
        toast.success("Announcement updated");
      } else {
        await announcementsApi.create(toFormData(form, file));
        toast.success("Announcement published");
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    try {
      await announcementsApi.remove(a._id);
      toast.success("Announcement removed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove announcement");
    }
  };

  const handleAcknowledge = async (a) => {
    try {
      await announcementsApi.acknowledge(a._id);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to acknowledge");
    }
  };

  const handleOpenAttachment = async (a) => {
    try {
      const res = await announcementsApi.attachmentUrl(a._id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to open attachment");
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-cyan-700" /> Announcements
          </h1>
          <p className="text-sm text-slate-500 mt-1">Company news, policy updates and celebrations.</p>
        </div>
        {isHr && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> New announcement
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const iAcknowledged = a.acknowledgedBy?.some((ack) => ack.user?._id === user?._id || ack.user === user?._id);
            return (
              <div key={a._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <Pin className="w-4 h-4 text-cyan-700 fill-cyan-100" />}
                    <h3 className="font-bold text-slate-900">{a.title}</h3>
                  </div>
                  <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${CATEGORY_TONE[a.category] || "bg-slate-100 text-slate-600"}`}>
                    {CATEGORY_LABELS[a.category] || a.category}
                  </span>
                </div>
                {a.body && <p className="text-sm text-slate-600 whitespace-pre-wrap mb-3">{a.body}</p>}
                {a.attachmentFileName && (
                  <button onClick={() => handleOpenAttachment(a)} className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:underline mb-3">
                    <Paperclip className="w-3.5 h-3.5" /> {a.attachmentFileName}
                  </button>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                  <span>{a.createdBy?.name} · {fmtDate(a.createdAt)}</span>
                  <div className="flex items-center gap-3">
                    {isHr && (
                      <button onClick={() => setAckViewing(a)} className="flex items-center gap-1 text-slate-500 font-semibold hover:underline">
                        <Users className="w-3.5 h-3.5" /> {a.acknowledgedBy?.length || 0} acknowledged
                      </button>
                    )}
                    {iAcknowledged ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                      </span>
                    ) : (
                      <button onClick={() => handleAcknowledge(a)} className="flex items-center gap-1 text-cyan-700 font-semibold hover:underline">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
                      </button>
                    )}
                    {isHr && (
                      <div className="flex gap-3">
                        <button onClick={() => { setEditing(a); setShowForm(true); }} className="text-cyan-700 font-semibold hover:underline">Edit</button>
                        <button onClick={() => handleDelete(a)} className="text-red-600 font-semibold hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <AnnouncementModal initial={editing} saving={saving} onClose={() => { setShowForm(false); setEditing(null); }} onSubmit={handleSubmit} />}
      {ackViewing && <AcknowledgedByModal announcement={ackViewing} onClose={() => setAckViewing(null)} />}
    </main>
  );
}
