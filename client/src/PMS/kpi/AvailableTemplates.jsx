import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2, Search, RefreshCw, FileText } from "lucide-react";
import Swal from "sweetalert2";
import getAuthAxios from "../../utils/authAxios";
import { ArrowLeft } from "lucide-react";

export default function AvailableTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError("");
      const api = await getAuthAxios();
      const res = await api.get("/kra-master-template");
      setTemplates(res.data || []);
    } catch (err) {
      console.error("Template fetch error:", err);
      setError("Failed to load templates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);
  const uniqueTemplates = useMemo(() => {
    const map = new Map();

    templates.forEach((template) => {
      const key = (template.name || "").trim().toLowerCase();

      if (!map.has(key)) {
        map.set(key, template);
      }
    });

    return Array.from(map.values());
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const text = query.trim().toLowerCase();

    return uniqueTemplates.filter((template) => {
      const functionalCount = template.functionalKras?.length || 0;
      const organizationalCount = template.organizationalKras?.length || 0;

      const matchesQuery =
        !text || (template.name || "").toLowerCase().includes(text);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "functional" && functionalCount > 0) ||
        (typeFilter === "organizational" && organizationalCount > 0);

      return matchesQuery && matchesType;
    });
  }, [uniqueTemplates, query, typeFilter]);
  const totalFunctional = useMemo(
    () => uniqueTemplates.reduce((sum, t) => sum + (t.functionalKras?.length || 0), 0),
    [uniqueTemplates]
  );
  const totalOrganizational = useMemo(
    () => uniqueTemplates.reduce((sum, t) => sum + (t.organizationalKras?.length || 0), 0),
    [uniqueTemplates]
  );

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete Template?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!confirm.isConfirmed) return;

    try {
      const api = await getAuthAxios();
      const handleDelete = async (template) => {
        const confirm = await Swal.fire({
          title: "Delete Template?",
          text: "All templates with this name will be deleted.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc2626",
          confirmButtonText: "Delete",
        });

        if (!confirm.isConfirmed) return;

        try {
          const api = await getAuthAxios();

          // 🔥 Find all templates with same name
          const sameTemplates = templates.filter(
            (t) => t.name.trim().toLowerCase() === template.name.trim().toLowerCase()
          );

          // 🔥 Delete all of them
          await Promise.all(
            sameTemplates.map((t) =>
              api.delete(`/kra-master-template/${t.id}`)
            )
          );

          Swal.fire({
            icon: "success",
            title: "Deleted",
            timer: 1000,
            showConfirmButton: false,
          });

          fetchTemplates();

        } catch (err) {
          console.error(err);
          Swal.fire("Delete failed", "", "error");
        }
      };
      Swal.fire({
        icon: "success",
        title: "Deleted",
        timer: 1000,
        showConfirmButton: false,
      });
      fetchTemplates();
    } catch (err) {
      console.error("Delete error:", err);
      Swal.fire("Delete failed", "Could not delete the template.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            {/* 🔙 BACK BUTTON */}
            <button
              onClick={() => navigate("/employeetemplate")}   // or navigate(-1)
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Available Templates</h2>
              <p className="text-sm text-slate-500 mt-1">
                Browse, edit, assign, and manage KRA templates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg">
                {filteredTemplates.length} shown
              </span>
              <button
                onClick={fetchTemplates}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs text-indigo-700">Templates</p>
              <p className="text-xl font-bold text-indigo-900">{uniqueTemplates.length}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">Job Specified KRAs</p>
              <p className="text-xl font-bold text-blue-900">{totalFunctional}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Organizational KRAs</p>
              <p className="text-xl font-bold text-emerald-900">{totalOrganizational}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mt-5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates by name"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="all">All Types</option>
              <option value="functional">Job Specified</option>
              <option value="organizational">Organizational</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && filteredTemplates.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-800 font-semibold">No templates found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try a different search keyword or filter.
            </p>
          </div>
        )}

        {!loading && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const functionalCount = template.functionalKras?.length || 0;
              const organizationalCount = template.organizationalKras?.length || 0;
              const totalKras = functionalCount + organizationalCount;

              return (
                <div
                  key={template.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-200 flex flex-col justify-between h-full"
                >
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-lg leading-tight">
                      {template.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Total KRAs: {totalKras}
                    </p>
                    {/* <p className="text-xs text-indigo-600 font-semibold">
                      Assigned: {template.assignedUsers?.length || 0}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.assignedUsers?.slice(0, 3).map((u) => (
                        <span
                          key={u.id}
                          className="text-xs bg-gray-100 px-2 py-1 rounded"
                        >
                          {u.name}
                        </span>
                      ))}
                    </div> */}

                    <div className="flex gap-2 flex-wrap">
                      <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                        {functionalCount} Job Specified
                      </div>
                      <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                        {organizationalCount} Organizational
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 mt-4">
                    <button
                      onClick={() => navigate(`/create_template?view=${template.id}`)}
                      className="py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      View
                    </button>

                    <button
                      onClick={() => navigate(`/create_template?edit=${template.id}`)}
                      className="py-2.5 text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => navigate(`/create_template?assign=${template.id}`)}
                      className="py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1"
                    >
                      <Play size={12} />
                      Assign
                    </button>

                    {/* <button
                      onClick={() => handleDelete(template)}
                      className="py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button> */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
