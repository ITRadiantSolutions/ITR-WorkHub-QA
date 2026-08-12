import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import { confirmDialog } from "../../components/ConfirmDialog";
import Icons from "../../components/Icons";

export default function TemplatesList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    API.get("/pms/kra/templates")
      .then((res) => setTemplates(res.data || []))
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [templates, query]);

  const handleDelete = async (template) => {
    const confirmed = await confirmDialog({
      title: "Delete template?",
      text: `"${template.name}" will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await API.delete(`/pms/kra/templates/${template._id}`);
      toast.success("Template deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete template");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">KPI Templates</h1>
            <p className="text-sm text-slate-500">Curated KRA/KPI bundles you can assign to a person or a group.</p>
          </div>
          <button
            onClick={() => navigate("/pms/templates/new")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold shadow-sm"
          >
            <Icons.Plus /> New Template
          </button>
        </div>

        <div className="relative max-w-sm mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates by name..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
            {templates.length === 0 ? "No templates yet — create one to get started." : "No templates match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((t) => {
              const functionalCount = t.kras?.filter((k) => k.type === "functional").length || 0;
              const organizationalCount = t.kras?.filter((k) => k.type === "organizational").length || 0;
              return (
                <div key={t._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
                  <h3 className="font-bold text-slate-900">{t.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t.kras?.length || 0} KRAs total</p>
                  <div className="flex gap-2 flex-wrap mt-3 mb-4">
                    <span className="bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {functionalCount} Functional
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {organizationalCount} Organizational
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 mt-auto">
                    <button
                      onClick={() => navigate(`/pms/templates/${t._id}`)}
                      className="py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/pms/assign/${t._id}`)}
                      className="py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center justify-center"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
