import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileText, Plus, X, Download, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { documentsApi, employeesApi } from "../hrmsApi";

const CATEGORY_LABELS = {
  offer_letter: "Offer Letter",
  id_proof: "ID Proof",
  education_certificate: "Education Certificate",
  experience_letter: "Experience Letter",
  policy_acknowledgement: "Policy Acknowledgement",
  other: "Other",
};

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function UploadModal({ onClose, onSubmit, saving }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Upload document</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <input placeholder="Title" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer border border-dashed border-slate-300 rounded-xl px-3 py-3">
          <Plus className="w-4 h-4" />
          <span>{file ? file.name : "Choose a file"}</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !title.trim() || !file}
            onClick={() => onSubmit({ title, category, file })}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const myId = user?._id || user?.id;

  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(myId);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isHr) employeesApi.list().then((r) => setEmployees(r.data || [])).catch(() => {});
  }, [isHr]);

  const load = useCallback(() => {
    if (!employeeId) return;
    setLoading(true);
    documentsApi.forEmployee(employeeId).then((r) => setDocuments(r.data || [])).catch(() => toast.error("Failed to load documents")).finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async ({ title, category, file }) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("employeeId", employeeId);
      formData.append("title", title);
      formData.append("category", category);
      formData.append("file", file);
      await documentsApi.upload(formData);
      toast.success("Document uploaded");
      setShowUpload(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await documentsApi.url(doc._id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to open document");
    }
  };

  const handleDelete = async (doc) => {
    try {
      await documentsApi.remove(doc._id);
      toast.success("Document deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete document");
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-700" /> Documents
          </h1>
          <p className="text-sm text-slate-500 mt-1">{isHr ? "Employee documents, controlled access." : "Your documents on file."}</p>
        </div>
        {isHr && (
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Upload document
          </button>
        )}
      </div>

      {isHr && (
        <select className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm mb-5" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value={myId}>Me</option>
          {employees.filter((e) => e._id !== myId).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="text-left px-4 py-3">Title</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Uploaded</th><th className="text-left px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No documents yet.</td></tr>}
              {documents.map((d) => (
                <tr key={d._id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{d.title}</td>
                  <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[d.category] || d.category}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(d.createdAt)} · {d.uploadedBy?.name}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <button onClick={() => handleDownload(d)} className="text-cyan-700 font-semibold hover:underline text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Open</button>
                    {isHr && (
                      <button onClick={() => handleDelete(d)} className="text-red-600 font-semibold hover:underline text-xs flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && <UploadModal saving={saving} onClose={() => setShowUpload(false)} onSubmit={handleUpload} />}
    </main>
  );
}
