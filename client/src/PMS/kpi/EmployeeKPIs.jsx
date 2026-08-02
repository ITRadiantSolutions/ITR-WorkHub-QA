import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronUp, X, Calendar, TrendingUp, CheckCircle2, Trash2, Minus, Users, Play, Building2, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import ErrorPopup from "../components/ErrorPopup";
import EmployeeKPIForm from "./EmployeeKPIForm";
import getAuthAxios from "../../utils/authAxios";
import { toast } from "sonner";

export function EmployeeKPIs() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [viewMode, setViewMode] = useState("create");
  const [allLibraryKras, setAllLibraryKras] = useState([]);
  const [error, setError] = useState("");
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const templateId = query.get("edit");
  const API_BASE = import.meta.env.VITE_API_URL;
  const [status, setStatus] = useState(null);
  const [kraTypeError, setKraTypeError] = useState(false);

  // 1 = Create Template; 2 = Assign Users; 3 = Set Weights & Submit
  const [step, setStep] = useState(1);
  const [savedTemplates, setSavedTemplates] = useState([]);

  const fetchTemplates = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get("/kra-master-template");
      setSavedTemplates(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load templates");
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const [assignees, setAssignees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [submittedList, setSubmittedList] = useState([]);

  const [kraType, setKraType] = useState("");
  const [libraryKras, setLibraryKras] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedKras, setSelectedKras] = useState([]);
  const [showLibraryDropdown, setShowLibraryDropdown] = useState(false);
  const submittedForCycle = submittedList;
  const [templateName, setTemplateName] = useState("");
  const isSubmittedView = status === "submitted";

  const fetchAssignees = async () => {
    try {
      const api = await getAuthAxios();
      const [usersRes, groupsRes] = await Promise.all([api.get("/users"), api.get("/usersgroup")]);
      const formattedUsers = (usersRes.data || []).map((u) => ({ id: u.id, name: u.name || u.username, type: "user" }));
      const formattedGroups = (groupsRes.data || []).map((g) => ({ id: g.id, name: g.name, type: "group" }));
      setAssignees([...formattedUsers, ...formattedGroups]);
    } catch (err) {
      console.error(err);
      setError("Failed to load assignees");
    }
  };

  useEffect(() => { fetchAssignees(); }, []);

  const filteredAssignees = assignees.filter((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const isKpiValid = (kra) => {
    if (!kra.kpis || kra.kpis.length === 0) return true;
    const total = kra.kpis.reduce((sum, k) => sum + Number(k.weight || 0), 0);
    return total === 100;
  };

  const handleFinalSubmit = async () => {
    try {
      const savedKras = selectedKras.filter((k) => k.isSaved);
      if (savedKras.length === 0) return setError("Save all KRAs before creating template");

      const api = await getAuthAxios();
      const payload = {
        name: templateName,
        functionalKras: savedKras.filter((k) => k.type === "functional"),
        organizationalKras: savedKras.filter((k) => k.type === "organizational"),
        createdBy: loggedInUser?.id,
      };

      if (editingTemplateId) {
        await api.put(`/kra-master-template/${editingTemplateId}`, payload);
        toast.success("Template Updated");
      } else {
        await api.post("/kra-master-template", payload);
        toast.success("Template Created");
      }

      await fetchTemplates();
      setEditingTemplateId(null);
    } catch (err) {
      console.error(err);
      setError("Template creation failed");
    }
  };

  const handleAssignedSubmit = async () => {
    try {
      const savedKras = selectedKras.filter((k) => k.isSaved);
      if (savedKras.length === 0) return setError("Save all KRAs before submitting");

      const api = await getAuthAxios();
      const payload = {
        assignedToId: selectedAssignees.id,
        assignedToName: selectedAssignees.name,
        assignedToType: selectedAssignees.type,
        kras: savedKras,
        createdBy: loggedInUser?.id,
      };

      await api.post("/kpi-template/submit", payload);
      toast.success("Template Assigned");
      resetTemplateBuilder();
      setStep(1);
    } catch (err) {
      console.error(err);
      setError("Assignment failed");
    }
  };

  const handleUpdateAssignedTemplate = async () => {
    try {
      const api = await getAuthAxios();
      const assignee = selectedAssignees[0];
      await api.put("/kpi-template/update", {
        assignedToId: assignee.id,
        kras: selectedKras,
      });
      toast.success("Assigned Template Updated");
      setViewMode("view");
    } catch (err) {
      console.error(err);
      setError("Failed to update assigned template");
    }
  };

  useEffect(() => {
    const loadTemplate = async () => {
      if (selectedAssignees.length === 0) return;
      if (viewMode !== "view" && viewMode !== "editAssigned") return;
      try {
        const api = await getAuthAxios();
        const assignee = selectedAssignees[0];
        if (!assignee) return;

        const res = await api.get(`/kpi-template?assignedToId=${assignee.id}`);
        if (res.data) {
          const mapped = (res.data.kras || []).map((k) => ({ ...k, instanceId: crypto.randomUUID(), isSaved: true }));
          setSelectedKras(mapped);
          setStatus(res.data.status);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadTemplate();
  }, [selectedAssignees, viewMode]);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const api = await getAuthAxios();
        const res = await api.get("/kra-library");
        setAllLibraryKras(res.data);
        const filtered = kraType ? res.data.filter((k) => k.type === kraType) : [];
        setLibraryKras(filtered);
      } catch (err) {
        console.error("KRA LIBRARY ERROR:", err);
        setLibraryKras([]);
      }
    };
    loadLibrary();
  }, [kraType]);

  const handleSelectKra = (kra) => {
    setSelectedKras((prev) => {
      const exists = prev.some((k) => k.originalId === kra.id);
      if (exists) return prev;
      return [
        ...prev,
        {
          originalId: kra.id,
          type: kra.type,
          instanceId: crypto.randomUUID(),
          name: kra.name,
          weight: "",
          isSaved: false,
          kpis: kra.kpis.map((kpi, index) => ({
            localId: `${Date.now()}-${index}`,
            name: kpi.name || kpi.title || kpi.kpiName || "",
            weight: "",
          })),
        },
      ];
    });
  };

  const resetTemplateBuilder = () => {
    setSelectedKras([]);
    setSelectedAssignees([]);
    setSearchTerm("");
    setKraType("");
    setStatus(null);
    setViewMode("create");
  };

  useEffect(() => {
    if (viewMode !== "view") return;   // 👈 IMPORTANT

    const saved = sessionStorage.getItem("submittedTemplateContext");
    if (!saved || assignees.length === 0) return;

    const parsed = JSON.parse(saved);
    const found = assignees.find((a) => a.id === parsed.assigneeId);

    if (found) {
      setSelectedAssignees(prev => {
        const exists = prev.some(a => a.id === found.id);
        if (exists) return prev;
        return [...prev, found];
      });
    }
  }, [assignees, viewMode]);

  const totalKraWeight = selectedKras.reduce((sum, k) => sum + Number(k.weight || 0), 0);
  const remainingWeight = 100 - totalKraWeight;

  const updateKraWeight = (kraId, value) => {
    const numericValue = Number(value || 0);

    setSelectedKras((prev) => {
      const currentTotal = prev.reduce((sum, k) => {
        if (k.instanceId === kraId) return sum;
        return sum + Number(k.weight || 0);
      }, 0);

      const newTotal = currentTotal + numericValue;

      // ❌ Prevent more than 100
      if (newTotal > 100) {
        setError("Total KRA weight cannot exceed 100%");
        return prev;
      }

      return prev.map((k) =>
        k.instanceId === kraId
          ? { ...k, weight: numericValue, isSaved: false }
          : k
      );
    });
  };


  const updateKpiWeight = (kraId, kpiIndex, value) => {
    const numericValue = Number(value || 0);

    setSelectedKras((prev) =>
      prev.map((k) => {
        if (k.instanceId !== kraId) return k;

        const otherTotal = k.kpis.reduce((sum, p, index) => {
          if (index === kpiIndex) return sum;
          return sum + Number(p.weight || 0);
        }, 0);

        const newTotal = otherTotal + numericValue;

        // ❌ Prevent >100
        if (newTotal > 100) {
          setError("Total KPI weight must be 100%");
          return k;
        }

        return {
          ...k,
          isSaved: false,
          kpis: k.kpis.map((p, index) =>
            index === kpiIndex ? { ...p, weight: numericValue } : p
          ),
        };
      })
    );
  };


  useEffect(() => {
    if (!templateId) return;
    const saved = sessionStorage.getItem("temp_kra_template");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSelectedKras(parsed.kras);
    }
  }, [templateId]);

  useEffect(() => { sessionStorage.removeItem("temp_kra_template"); }, []);

  const handleSaveKraTemporarily = (kraId) => {
    setSelectedKras((prev) => prev.map((k) => (k.instanceId === kraId ? { ...k, isSaved: true } : k)));
  };

  useEffect(() => { setShowLibraryDropdown(!!kraType); }, [kraType]);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) setLoggedInUser(user);
  }, []);

  if (!loggedInUser) return (<div className="flex items-center justify-center h-screen"><p className="p-4 text-gray-500">Loading...</p></div>);

  const cutKraFromSelection = (instanceId) => setSelectedKras((prev) => prev.filter((k) => k.instanceId !== instanceId));
  const functionalCount = selectedKras.filter((k) => k.type === "functional").length;
  const organizationalCount = selectedKras.filter((k) => k.type === "organizational").length;

  return (
    <>
      <ErrorPopup message={error} onClose={() => setError("")} />
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-600 bg-clip-text text-transparent">Employee KPIs Studio</h1>
              <p className="text-gray-500 mt-1 text-sm">Design, assign, and manage Key Performance Indicators with precision.</p>
            </div>
            <div className="flex items-center gap-3 bg-purple-50 px-5 py-3 rounded-2xl border border-purple-100">
              <span className="text-sm font-semibold text-purple-700">Remaining Weight</span>
              <span className={`text-2xl font-bold ${remainingWeight === 0 ? 'text-emerald-500' : remainingWeight < 0 ? 'text-red-500' : 'text-purple-600'}`}>
                {remainingWeight}%
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
            <div className="flex justify-between items-center w-full min-w-[500px] relative px-4">
              <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-100 -translate-y-1/2" />
              <div className="absolute top-1/2 left-10 right-[50%] h-0.5 bg-purple-500 -translate-y-1/2 transition-all duration-500" style={{ right: step === 1 ? '100%' : step === 2 ? '50%' : '10%' }} />

              {[{ num: 1, label: "Create Template" }, { num: 2, label: "Assign Targets" }, { num: 3, label: "Configure Weights" }].map((s) => {
                const isActive = step === s.num;
                const isPast = step > s.num;
                return (
                  <div key={s.num} className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setStep(s.num)}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm
                      ${isActive ? 'bg-purple-600 text-white ring-4 ring-purple-100 scale-110' : isPast ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400 border-2 border-gray-200 group-hover:border-purple-300'}`}>
                      {isPast ? <CheckCircle2 size={20} /> : s.num}
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-purple-700' : isPast ? 'text-gray-800' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-[400px]">

            {/* ====== STEP 1: CREATE TEMPLATE ====== */}
            {(step === 1 || viewMode === "editAssigned") && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Template Name Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Template Name</label>
                    <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Q3 Engineering Core"
                      className="w-full px-5 py-4 text-sm font-medium text-gray-800 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                  </div>

                  {/* KRA Type Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Browse KRA Library</label>
                    <div
                      className={`flex bg-gray-50 rounded-2xl p-1.5 border 
  ${kraTypeError ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                    >
                      <button
                        onClick={() => {
                          setKraType("functional");
                          setKraTypeError(false);
                        }}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${kraType === 'functional' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Job Specified
                      </button>
                      <button
                        onClick={() => {
                          setKraType("organizational");
                          setKraTypeError(false);
                        }}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${kraType === 'organizational' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Organizational
                      </button>
                    </div>
                  </div>
                </div>
                {kraTypeError && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">
                    Please select Job Specified or Organizational KRA
                  </p>
                )}


                {/* Library Dropdown Panel */}
                <AnimatePresence>
                  {showLibraryDropdown && step === 1 && viewMode !== "viewAssigned" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="bg-purple-50/50 rounded-3xl border border-purple-100 p-6 mt-2 relative">
                        <button onClick={() => setShowLibraryDropdown(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-full transition-all">
                          <X size={20} />
                        </button>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Building2 size={20} /></div>
                          <h4 className="font-bold text-gray-800 capitalize text-lg">{kraType} KRAs</h4>
                        </div>
                        <input type="text" placeholder="Search library..." onChange={(e) => {
                          const v = e.target.value.toLowerCase();
                          setLibraryKras(allLibraryKras.filter((k) => k.type === kraType && k.name.toLowerCase().includes(v)));
                        }} className="w-full px-5 py-3 mb-6 text-sm rounded-xl bg-white border border-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-sm" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-2 pb-2">
                          {libraryKras.length === 0 ? <p className="col-span-full text-center py-8 text-gray-400">No KRAs found in this category.</p> :
                            libraryKras.map((kra) => {
                              const alreadyAdded = selectedKras.some(k => k.originalId === kra.id);
                              return (
                                <div key={kra.id} className={`flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 ${alreadyAdded ? 'bg-purple-600 border-purple-700 text-white shadow-md' : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'}`}>
                                  <div>
                                    <p className={`font-semibold text-sm mb-2 line-clamp-2 ${alreadyAdded ? 'text-white' : 'text-gray-800'}`}>{kra.name}</p>
                                    <span className={`text-xs inline-flex px-2 py-1 rounded-md font-medium ${alreadyAdded ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{kra.kpis?.length || 0} KPIs</span>
                                  </div>
                                  <button onClick={() => alreadyAdded ? setSelectedKras(prev => prev.filter(k => k.originalId !== kra.id)) : handleSelectKra(kra)} className={`mt-4 py-2 w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${alreadyAdded ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
                                    {alreadyAdded ? <><Minus size={16} /> Remove</> : <><Plus size={16} /> Add to Template</>}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected KRAs Preview List */}
                {(functionalCount > 0 || organizationalCount > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    {functionalCount > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500" /> Job Specified KRAs</h4>
                          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md">{functionalCount} Selected</span>
                        </div>
                        {selectedKras.filter(k => k.type === "functional").map(kra => (
                          <div key={kra.instanceId} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-xl hover:border-purple-300 transition-colors">
                            <span className="text-sm font-medium text-gray-700 truncate pr-4">{kra.name}</span>
                            <button onClick={() => setSelectedKras(prev => prev.filter(k => k.instanceId !== kra.instanceId))} className="text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {organizationalCount > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Organizational KRAs</h4>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{organizationalCount} Selected</span>
                        </div>
                        {selectedKras.filter(k => k.type === "organizational").map(kra => (
                          <div key={kra.instanceId} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-xl hover:border-emerald-300 transition-colors">
                            <span className="text-sm font-medium text-gray-700 truncate pr-4">{kra.name}</span>
                            <button onClick={() => setSelectedKras(prev => prev.filter(k => k.instanceId !== kra.instanceId))} className="text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====== STEP 2: ASSIGN TARGET ====== */}
            {step === 2 && selectedKras.length > 0 && viewMode === "create" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-2xl mx-auto py-8">
                <div className="text-center mb-8">
                  <div className="mx-auto w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4"><Users size={32} /></div>
                  <h3 className="text-xl font-bold text-gray-800">Assign to Employee or Group</h3>
                  <p className="text-sm text-gray-500 mt-2">Search for the target user or department to assign this KRA template to.</p>
                </div>

                <div className="relative">
                  <input type="text" placeholder="Search employee or group by name..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowAssignDropdown(true); }} onFocus={() => setShowAssignDropdown(true)}
                    className="w-full pl-12 pr-4 py-4 text-base rounded-2xl bg-white border-2 border-purple-100 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-50 transition-all shadow-sm" />
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" size={20} />

                  <AnimatePresence>
                    {showAssignDropdown && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto">
                        {filteredAssignees.length === 0 ? <p className="p-4 text-center text-gray-400">No matches found.</p> :
                          filteredAssignees.map(item => {
  const isChecked = selectedAssignees.some(a => a.id === item.id);

  return (
    <div
      key={item.id}
      className="flex items-center justify-between p-4 hover:bg-purple-50 border-b border-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">

        {/* ✅ CHECKBOX ADDED */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => {
            setSelectedAssignees(prev => {
              const exists = prev.some(a => a.id === item.id);

              if (exists) {
                return prev.filter(a => a.id !== item.id);
              } else {
                return [...prev, item];
              }
            });
          }}
          className="w-4 h-4 accent-purple-600 cursor-pointer"
        />

        <UserCircle size={20} className="text-gray-400" />

        <span className="font-semibold text-gray-700">
          {item.name}
        </span>
      </div>

      <span
        className={`text-xs font-bold px-3 py-1 rounded-full ${
          item.type === "user"
            ? "bg-violet-100 text-violet-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {item.type === "user" ? "Employee" : "Group"}
      </span>
    </div>
  );
})}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedAssignees.length > 0 && (
                  <div className="mt-8 space-y-3">
                    {selectedAssignees.map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-600 p-4 rounded-2xl text-white shadow-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
                            {assignee.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold">{assignee.name}</p>
                            <p className="text-xs uppercase tracking-wider">
                              {assignee.type}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setSelectedAssignees(prev =>
                              prev.filter(a => a.id !== assignee.id)
                            )
                          }
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-full"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ====== STEP 3: CONFIGURE WEIGHTS ====== */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500">
                {selectedKras.map(kra => {
                  const totalKpiWeight = kra.kpis.reduce((sum, k) => sum + Number(k.weight || 0), 0);
                  const isSavedColor = kra.isSaved ? 'emerald' : 'indigo';

                  return (
                    <div key={kra.instanceId} className={`rounded-2xl border bg-white overflow-hidden transition-all duration-300 shadow-sm ${kra.isSaved ? 'border-emerald-200' : 'border-gray-200 hover:border-purple-300'}`}>

                      {/* Accordion Header row */}
                      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {kra.isSaved && <CheckCircle2 size={18} className="text-emerald-500" />}
                            <h3 className="font-bold text-gray-800 text-base">{kra.name}</h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">{kra.type} KRA</p>
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">Appraisal Weight</label>
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" max="100" value={kra.weight} onChange={(e) => updateKraWeight(kra.instanceId, e.target.value)}
                              className="w-16 text-right font-bold text-purple-700 bg-purple-50 px-2 py-1 object-center rounded-lg border-none focus:ring-2 focus:ring-purple-400 outline-none" placeholder="0" />
                            <span className="text-xs font-bold text-gray-400 pr-2">%</span>
                          </div>
                          <button onClick={() => cutKraFromSelection(kra.instanceId)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>

                      {/* KPIs breakdown container */}
                      <div className="p-5 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-700">KPI Distribution</h4>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-500 ${totalKpiWeight === 100 ? 'bg-emerald-500' : totalKpiWeight > 100 ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(totalKpiWeight, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${totalKpiWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>{totalKpiWeight}% / 100%</span>
                          </div>
                        </div>

                        {kra.kpis.length === 0 ? <p className="text-sm text-gray-400 italic">No KPIs exist for this KRA.</p> :
                          <div className="space-y-2">
                            {kra.kpis.map((kpi, kpiIndex) => (
                              <div key={kpi.localId} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                <span className="text-sm font-medium text-gray-700">{kpi.name}</span>
                                <div className="flex items-center gap-2">
                                  <input type="number" min="0" max="100" value={kpi.weight} onChange={(e) => updateKpiWeight(kra.instanceId, kpiIndex, e.target.value)}
                                    className="w-16 text-right text-sm font-semibold rounded-lg bg-gray-50 border border-gray-200 px-2 py-1 focus:ring-2 focus:ring-purple-400 outline-none" placeholder="0" />
                                  <span className="text-xs font-bold text-gray-400">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        }

                        {/* Save Action Area */}
                        <div className="mt-5 flex justify-end">
                          {(() => {
                            const isValid = kra.kpis.length === 0 || totalKpiWeight === 100;
                            const canSave =
                              isValid &&
                              kra.weight &&
                              Number(kra.weight) > 0 &&
                              !kra.isSaved;
                            return (
                              <button disabled={!canSave && !kra.isSaved} onClick={() => handleSaveKraTemporarily(kra.instanceId)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${kra.isSaved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                  canSave ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                  }`}>
                                {kra.isSaved ? <><CheckCircle2 size={16} /> Saved</> : 'Save Configuration'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ====== BOTTOM NAVIGATION Action Bar ====== */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={() =>
                    setStep(editingTemplateId && step === 3 ? 1 : step - 1)
                  } className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Back</button>
              ) : <div />}

              {step === 1 && (
                <button
                  onClick={() => {
                    if (!templateName) return setError("Enter template name");

                    // ✅ If editing → skip validations
                    if (editingTemplateId) {
                      setStep(3);
                      return;
                    }

                    // 🔥 Only validate for NEW template
                    if (!kraType) {
                      setKraTypeError(true);
                      return;
                    }

                    if (selectedKras.length === 0)
                      return setError("Select at least one KRA");

                    setStep(2);
                  }}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-md shadow-purple-200"
                >
                  {editingTemplateId ? "Configure Weights" : "Next Step"}
                </button>
              )}

              {step === 2 && (
                <button
                  onClick={() => {
                    if (selectedAssignees.length === 0)
                      return setError("Select at least one employee or group");
                    setStep(3);
                  }} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-md shadow-purple-200">Next Step</button>
              )}

              {step === 3 && selectedKras.length > 0 && (
                <button
                  onClick={() => {

                    // 🔥 1. Total KRA weight must be 100
                    // 🔥 Total KRA must be between 1 and 100
                    if (totalKraWeight <= 0 || totalKraWeight > 100) {
                      setError("Total KRA weight must be between 1 and 100%");
                      return;
                    }

                    // 🔥 2. Every KRA must have weight
                    const missingKra = selectedKras.some(k => !k.weight);
                    if (missingKra) {
                      setError("Each KRA must have weight");
                      return;
                    }

                    // 🔥 3. KPI validation
                    for (let kra of selectedKras) {

                      // If KPIs exist
                      if (kra.kpis.length > 0) {

                        // Total KPI must be 100
                        const totalKpi = kra.kpis.reduce(
                          (sum, k) => sum + Number(k.weight || 0),
                          0
                        );

                        if (totalKpi !== 100) {
                          setError(`KPI total must be 100% for "${kra.name}"`);
                          return;
                        }

                        // All KPI weights mandatory
                        const emptyKpi = kra.kpis.some(k => !k.weight);
                        if (emptyKpi) {
                          setError(`All KPI weights required for "${kra.name}"`);
                          return;
                        }
                      }
                    }

                    // ✅ If all validations pass → submit
                    (async () => {
                      try {

                        if (viewMode === "editAssigned") {
                          await handleUpdateAssignedTemplate();
                          return;
                        }

                        // ✅ If assigning, FIRST save as master template
                        if (selectedAssignees.length > 0) {
                          await handleFinalSubmit();

                          const api = await getAuthAxios();

                          for (const assignee of selectedAssignees) {
                            await api.post("/kpi-template/submit", {
                              assignedToId: assignee.id,
                              assignedToName: assignee.name,
                              assignedToType: assignee.type,
                              kras: selectedKras.filter(k => k.isSaved),
                              createdBy: loggedInUser?.id,
                            });
                          }

                          toast.success("Template Assigned to Multiple Users");

                          resetTemplateBuilder();
                          setStep(1);
                          return;
                        }

                        // ✅ Otherwise just save master template
                        await handleFinalSubmit();

                      } catch (err) {
                        console.error(err);
                      }
                    })();
                  }}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  {viewMode === "editAssigned"
                    ? "Update Assignment"
                    : editingTemplateId
                      ? "Update Template"
                      : selectedAssignees.length > 0
                        ? "Assign Template"
                        : "Save Master Template"}
                </button>
              )}
            </div>
          </div>

          {/* ====== TEMPLATES GRID (List section below) ====== */}
          {savedTemplates.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-gray-800">Available Templates</h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 font-bold text-xs rounded-lg">{savedTemplates.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedTemplates.map(template => (
                  <div key={template.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-purple-300 hover:shadow-xl transition-all duration-300 flex flex-col">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-lg mb-4">{template.name}</h4>
                      <div className="flex flex-wrap gap-2 mb-6">
                        <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />{template.functionalKras.length} Func</div>
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{template.organizationalKras.length} Org</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      <button onClick={() => {
                        const combined = [...template.functionalKras, ...template.organizationalKras].map(k => ({ ...k, instanceId: crypto.randomUUID(), isSaved: true, kpis: (k.kpis || []).map((kpi, i) => ({ localId: `${Date.now()}-${i}`, name: kpi.name, weight: kpi.weight || "" })) }));
                        setSelectedKras(combined); setTemplateName(template.name);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }} className="py-2 text-xs font-bold text-center border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">View</button>
                      <button onClick={() => {
                        const combined = [...template.functionalKras, ...template.organizationalKras].map(k => ({ ...k, instanceId: crypto.randomUUID(), isSaved: true, kpis: (k.kpis || []).map((kpi, i) => ({ localId: `${Date.now()}-${i}`, name: kpi.name, weight: kpi.weight || "" })) }));
                        setSelectedKras(combined); setTemplateName(template.name); setEditingTemplateId(template.id); setStep(1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }} className="py-2 text-xs font-bold text-center border border-purple-200 text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">Edit</button>
                      <button onClick={() => {
                        const cloned = [...template.functionalKras, ...template.organizationalKras].map(k => ({ ...k, instanceId: crypto.randomUUID(), weight: "", isSaved: false, kpis: (k.kpis || []).map((kpi, i) => ({ localId: `${Date.now()}-${i}`, name: kpi.name, weight: "" })) }));
                        setSelectedKras(cloned); setTemplateName(template.name); setStep(2);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }} className="py-2 text-xs font-bold text-center border border-transparent bg-purple-600 text-white flex items-center justify-center gap-1 rounded-xl hover:bg-purple-700 transition-colors"><Play size={12} /> Assign</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====== SUBMITTED HISTORY SECTION ====== */}
          {submittedForCycle.length > 0 && (
            <div className="mt-12 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={20} /></div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Assignment History</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{submittedForCycle.length} employees assigned</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-800 transition-colors bg-gray-50 p-2 rounded-full">
                  {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              <AnimatePresence>
                {showHistory && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-6 border-t border-gray-100 mt-6">
                      <div className="max-w-md mx-auto mb-8">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block text-center">Select Employee to View Config</label>
                        <select className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                          onChange={(e) => {
                            const selected = submittedForCycle.find(
                              s => s.assignedToId === e.target.value
                            );

                            if (selected) {
                              setSelectedAssignees(prev => {
                                const exists = prev.some(a => a.id === selected.assignedToId);
                                if (exists) return prev;

                                return [
                                  ...prev,
                                  {
                                    name: selected.assignedToName,
                                    type: selected.assignedToType,
                                    id: selected.assignedToId
                                  }
                                ];
                              });

                              setSearchTerm("");
                              setShowAssignDropdown(false);
                              setViewMode("view");
                            }
                          }}>
                          <option value="">Choose employee...</option>
                          {submittedForCycle.map(item => <option key={item.id} value={item.assignedToId}>{item.assignedToName} ({item.assignedToType})</option>)}
                        </select>
                      </div>

                      {viewMode === "view" && selectedAssignees.length > 0 && selectedKras.length > 0 && (() => {
                        const selected = selectedAssignees[0];
                        return (
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                              <div>
                                <p className="font-bold text-gray-800 text-lg">{selected.name}</p>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{selected.type}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setViewMode("editAssigned")} className="px-4 py-2 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:text-purple-600 transition-colors">Edit Config</button>
                                <button onClick={() => { setViewMode("create"); setSelectedAssignees([]); setSelectedKras([]); }} className="p-2 text-gray-400 hover:text-red-500 bg-white border border-gray-200 rounded-xl transition-colors"><X size={16} /></button>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {selectedKras.map(kra => (
                                <div key={kra.instanceId} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="font-bold text-gray-700">{kra.name}</p>
                                    <span className="font-black text-emerald-500">{kra.weight}%</span>
                                  </div>
                                  {kra.kpis.length > 0 && <div className="space-y-2 pl-3 border-l-2 border-emerald-100">
                                    {kra.kpis.map((kpi, index) => (
                                      <div key={index} className="flex justify-between text-xs font-semibold text-gray-600"><span className="truncate pr-4">{kpi.name}</span><span>{kpi.weight}%</span></div>
                                    ))}
                                  </div>}
                                </div>
                              ))}
                            </div>
                            <div className="mt-6 p-4 bg-emerald-800 rounded-xl text-emerald-50 flex items-center justify-between font-bold text-sm">
                              <span>Total KRAs: {selectedKras.length}</span>
                              <span>Total Weight: {selectedKras.reduce((s, k) => s + Number(k.weight || 0), 0)}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

        </div>
      </div >
    </>
  );
}
