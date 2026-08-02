import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Trash2,
  Users,
  Play,
  Building2,
  UserCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef } from "react";
import ErrorPopup from "../components/ErrorPopup";
import getAuthAxios from "../../utils/authAxios";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
export default function AssignIndividual() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [viewMode, setViewMode] = useState("create");
  const [allLibraryKras, setAllLibraryKras] = useState([]);
  const [error, setError] = useState("");
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  //const editId = query.get("edit");
  //const viewId = query.get("view");
  //const assignId = query.get("assign");
  const dropdownRef = useRef(null);
  //const templateId = editId || viewId || assignId;
  const API_BASE = import.meta.env.VITE_API_URL;
  const [status, setStatus] = useState(null);
  const [kraTypeError, setKraTypeError] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);

  // 1 = Create Template; 2 = Assign Users; 3 = Set Weights & Submit
  const [step, setStep] = useState(1);
  //const [savedTemplates, setSavedTemplates] = useState([]);
  const navigate = useNavigate();


  // const fetchTemplates = async () => {
  //   try {
  //     const api = await getAuthAxios();
  //     const res = await api.get("/kra-master-template");
  //     setSavedTemplates(res.data);
  //   } catch (err) {
  //     console.error(err);
  //     setError("Failed to load templates");
  //   }
  // };
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowAssignDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // useEffect(() => {
  //   fetchTemplates();
  // }, []);
  // useEffect(() => {
  //   const loadTemplate = async () => {
  //     if (!templateId) return;

  //     try {
  //       const api = await getAuthAxios();
  //       const res = await api.get("/kra-master-template");

  //       const template = res.data.find(
  //         (t) => t.id === templateId
  //       );

  //       if (!template) return;

  //       const combined = [
  //         ...(template.functionalKras || []),
  //         ...(template.organizationalKras || []),
  //       ].map((k) => ({
  //         ...k,
  //         instanceId: crypto.randomUUID(),
  //         isSaved: true,
  //         weight: k.weight || "",
  //         kpis: (k.kpis || []).map((kpi, i) => ({
  //           localId: `${Date.now()}-${i}`,
  //           name: kpi.name,
  //           weight: kpi.weight || "",
  //         })),
  //       }));

  //       // 🔹 VIEW MODE
  //       if (viewId) {
  //         setViewMode("viewOnly");
  //         setStep(1);
  //       }

  //       // 🔹 EDIT MODE
  //       if (editId) {
  //         setEditingTemplateId(template.id);
  //         setViewMode("create");
  //         setStep(1);
  //       }

  //       // 🔹 ASSIGN MODE
  //       if (assignId) {
  //         const cleared = combined.map((k) => ({
  //           ...k,
  //           weight: "",
  //           isSaved: false,
  //           kpis: k.kpis.map((kp) => ({
  //             ...kp,
  //             weight: "",
  //           })),
  //         }));
  //         setSelectedKras(cleared);
  //         setTemplateName(template.name);
  //         setStep(2);
  //         return;
  //       }

  //       setSelectedKras(combined);
  //       setTemplateName(template.name);

  //     } catch (err) {
  //       console.error("Template load failed", err);
  //     }
  //   };

  //   loadTemplate();
  // }, [editId, viewId, assignId]);

  const [assignees, setAssignees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [assigneeTypeFilter, setAssigneeTypeFilter] = useState("all"); // "all" | "user" | "group"
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [selectedAssignees, setSelectedAssignees] =
    useState([]); const [submittedList, setSubmittedList] = useState([]);

  const [kraType, setKraType] = useState("functional");
  const [libraryKras, setLibraryKras] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedKras, setSelectedKras] = useState([]);
  const submittedForCycle = submittedList;
  //const [templateName, setTemplateName] = useState("");
  const isSubmittedView = status === "submitted";

  const fetchAssignees = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get("/assignees/unassigned");
      setAssignees(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load assignees");
    }
  };

  useEffect(() => {
    fetchAssignees();
  }, []);

  const filteredAssignees = assignees.filter((a) => {
    if (!a.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (assigneeTypeFilter !== "all" && a.type !== assigneeTypeFilter) return false;
    return true;
  });

  const isKpiValid = (kra) => {
    if (!kra.kpis || kra.kpis.length === 0) return true;
    const total = kra.kpis.reduce((sum, k) => sum + Number(k.weight || 0), 0);
    return total === 100;
  };

  // const handleFinalSubmit = async () => {
  //   try {
  //     const savedKras = selectedKras.filter((k) => k.isSaved);
  //     if (savedKras.length === 0)
  //       return setError("Save all KRAs before creating template");

  //     const api = await getAuthAxios();
  //     const payload = {
  //       name: templateName,
  //       functionalKras: savedKras.filter((k) => k.type === "functional"),
  //       organizationalKras: savedKras.filter(
  //         (k) => k.type === "organizational",
  //       ),
  //       createdBy: loggedInUser?.id,
  //     };

  //     if (editingTemplateId) {
  //       await api.put(`/kra-master-template/${editingTemplateId}`, payload);
  //       toast.success("Template Updated");
  //     } else {
  //       await api.post("/kra-master-template", payload);
  //       toast.success("Template Created");
  //     }

  //     await fetchTemplates();
  //     setEditingTemplateId(null);
  //   } catch (err) {
  //     console.error(err);
  //     setError("Template creation failed");
  //   }
  // };

  const handleAssignedSubmit = async () => {
    try {
      const savedKras = selectedKras.filter((k) => k.isSaved);
      if (savedKras.length === 0) return setError("Save all KRAs before submitting");
      if (selectedAssignees.length === 0) return setError("Select at least one user");

      const api = await getAuthAxios();
      const editUserId = query.get("editUserId");

      if (editUserId) {
        // ✅ EDIT MODE — update existing assignment
        await api.put(`/kpi-template/update-by-user/${editUserId}`, {
          kras: savedKras,
          updatedBy: loggedInUser?.id,
        });
        toast.success("Assignment Updated");
      } else {
        // ✅ NEW ASSIGNMENT
        await api.post("/kpi-template/submit", {
          assignees: selectedAssignees.map((a) => ({ id: a.id, name: a.name, type: a.type })),
          kras: savedKras,
          createdBy: loggedInUser?.id,
        });
        toast.success("Template Assigned");
      }

      resetTemplateBuilder();
      setStep(1);
      navigate("/user-kra-search");

    } catch (err) {
      console.error(err);
      setError("Assignment failed");
    }
  };

  const handleUpdateAssignedTemplate = async () => {
    try {
      const api = await getAuthAxios();
      await api.put("/kpi-template/update", {
        assignedToId: selectedAssignees.id,
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
      if (!selectedAssignee) return;
      if (viewMode !== "view" && viewMode !== "editAssigned") return;
      try {
        const api = await getAuthAxios();
        const res = await api.get(
          `/kpi-template?assignedToId=${selectedAssignee.id}`,
        );
        if (res.data) {
          const mapped = (res.data.kras || []).map((k) => ({
            ...k,
            instanceId: crypto.randomUUID(),
            isSaved: true,
          }));
          setSelectedKras(mapped);
          setStatus(res.data.status);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadTemplate();
  }, [selectedAssignee, viewMode]);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const api = await getAuthAxios();
        const res = await api.get("/kra-library");
        setAllLibraryKras(res.data);
        const filtered = kraType
          ? res.data.filter((k) => k.type === kraType)
          : [];
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
    const saved = sessionStorage.getItem("submittedTemplateContext");
    if (!saved || assignees.length === 0) return;
    const parsed = JSON.parse(saved);
    const found = assignees.filter((a) =>
      parsed.assigneeIds?.includes(a.id)
    );
    setSelectedAssignees(found);
  }, [assignees]);

  const totalKraWeight = selectedKras.reduce(
    (sum, k) => sum + Number(k.weight || 0),
    0,
  );
  const remainingWeight = 100 - totalKraWeight;

  // Per-step "can I move on" flags — drive the disabled state on each
  // step's Next/Assign button, not just the after-the-click error popup.
  const step1Valid = selectedAssignees.length > 0;
  const step2Valid = selectedKras.length > 0;
  const step3Valid =
    selectedKras.length > 0 &&
    selectedKras.every((k) => k.isSaved) &&
    totalKraWeight === 100;

  const updateKraWeight = (kraId, value) => {

    // ⭐ If KRA weight cleared → clear KPI weights
    if (value === "") {
      setSelectedKras((prev) =>
        prev.map((k) =>
          k.instanceId === kraId
            ? {
              ...k,
              weight: "",
              isSaved: false,
              kpis: k.kpis.map((kpi) => ({
                ...kpi,
                weight: ""   // clear KPI
              })),
            }
            : k
        )
      );
      return;
    }

    const numericValue = Number(value || 0);

    setSelectedKras((prev) => {
      const currentTotal = prev.reduce((sum, k) => {
        if (k.instanceId === kraId) return sum;
        return sum + Number(k.weight || 0);
      }, 0);

      const newTotal = currentTotal + numericValue;

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
          setError("Total KPI weight cannot exceed 100%");
          return k;
        }

        // ❌ Prevent single KPI = 100 when multiple KPIs exist
        if (numericValue === 100 && k.kpis.length > 1) {
          setError("Single KPI cannot have 100% weight when multiple KPIs exist");
          return k;
        }

        return {
          ...k,
          isSaved: false,
          kpis: k.kpis.map((p, index) =>
            index === kpiIndex ? { ...p, weight: numericValue } : p,
          ),
        };
      }),
    );
  };

  // useEffect(() => {
  //   if (!templateId) return;
  //   const saved = sessionStorage.getItem("temp_kra_template");
  //   if (saved) {
  //     const parsed = JSON.parse(saved);
  //     setSelectedKras(parsed.kras);
  //   }
  // }, [templateId]);

  useEffect(() => {
    sessionStorage.removeItem("temp_kra_template");
  }, []);

  const handleSaveKraTemporarily = (kraId) => {
    setSelectedKras((prev) =>
      prev.map((k) => (k.instanceId === kraId ? { ...k, isSaved: true } : k)),
    );
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) setLoggedInUser(user);
  }, []);

  useEffect(() => {
    const stepFromUrl = query.get("step");
    if (stepFromUrl) {
      setStep(Number(stepFromUrl));
    }

    const editUserId = query.get("editUserId");
    const editUserName = query.get("editUserName");

    if (editUserId && editUserName) {
      setSelectedAssignees([{
        id: editUserId,
        name: decodeURIComponent(editUserName),
        type: "user"
      }]);

      // Load existing KRAs for this user
      (async () => {
        try {
          const api = await getAuthAxios();
          const res = await api.get(`/kpi-template/assigned/${editUserId}`);
          const raw = Array.isArray(res.data) ? res.data : [];

          if (raw.length > 0) {
            const latest = raw.sort((a, b) =>
              new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
            )[0];

            const mapped = (latest.kras || []).map((k) => ({
              originalId: k.originalId,
              type: k.type,
              instanceId: crypto.randomUUID(),
              name: k.name,
              weight: k.weight || "",
              isSaved: true,
              kpis: (k.kpis || []).map((kpi, i) => ({
                localId: `${Date.now()}-${i}`,
                name: kpi.name,
                weight: kpi.weight || "",
              })),
            }));

            setSelectedKras(mapped);
          }
        } catch (err) {
          console.error("Failed to load existing KRAs", err);
        }
      })();

      setStep(2); // skip to KRA selection
    }
  }, []);
  if (!loggedInUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="p-4 text-gray-500">Loading...</p>
      </div>
    );

  const cutKraFromSelection = (instanceId) =>
    setSelectedKras((prev) => prev.filter((k) => k.instanceId !== instanceId));

  return (
    <>
      <ErrorPopup message={error} onClose={() => setError("")} />
      <div className="h-screen overflow-y-auto bg-gray-50 p-3 md:p-5 font-sans">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">

            {/* 🔙 BACK BUTTON */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-purple-600"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-purple-600 bg-clip-text text-transparent">
                Employee KPIs Studio
              </h1>
              <p className="text-gray-500 mt-0.5 text-xs">
                Design, assign, and manage Key Performance Indicators with
                precision.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-purple-50 px-4 py-2 rounded-xl border border-purple-100">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Remaining Weight</p>
                <p
                  className={`text-lg font-bold leading-none ${remainingWeight === 0 ? "text-emerald-500" : remainingWeight < 0 ? "text-red-500" : "text-purple-600"}`}
                >
                  {remainingWeight}%
                </p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-x-auto">
            <div className="flex justify-between items-center w-full min-w-[420px] relative px-4">
              <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gray-100 -translate-y-1/2" />
              <div
                className="absolute top-1/2 left-8 right-[50%] h-0.5 bg-purple-500 -translate-y-1/2 transition-all duration-500"
                style={{
                  right: step === 1 ? "100%" : step === 2 ? "50%" : "10%",
                }}
              />

              {[
                { num: 1, label: "Select User" },
                { num: 2, label: "Select KRAs" },
                { num: 3, label: "Configure & Assign" },
              ].map((s) => {
                const isActive = step === s.num;
                const isPast = step > s.num;
                return (
                  <div
                    key={s.num}
                    className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer group"
                    onClick={() => setStep(s.num)}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-sm
                      ${isActive ? "bg-purple-600 text-white ring-4 ring-purple-100 scale-110" : isPast ? "bg-emerald-500 text-white" : "bg-white text-gray-400 border-2 border-gray-200 group-hover:border-purple-300"}`}
                    >
                      {isPast ? <CheckCircle2 size={16} /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300 ${isActive ? "text-purple-700" : isPast ? "text-gray-800" : "text-gray-400"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-gray-100 min-h-[360px]">
            {/* ====== STEP 1: BROWSE & SELECT KRAs ====== */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Select KRAs</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Browse and select KRAs to assign.</p>
                  </div>
                  {selectedKras.length > 0 && (
                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full shrink-0">
                      {selectedKras.length} selected
                    </span>
                  )}
                </div>

                {/* KRA Type Selector */}
                <div>
                  <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl border ${kraTypeError ? "border-red-400 bg-red-50" : "bg-gray-50 border-gray-200"}`}>
                    <button
                      onClick={() => {
                        setKraType("functional");
                        setKraTypeError(false);
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${kraType === "functional" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <Calendar size={16} /> Job Specified
                    </button>
                    <button
                      onClick={() => {
                        setKraType("organizational");
                        setKraTypeError(false);
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${kraType === "organizational" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <Building2 size={16} /> Organizational
                    </button>
                  </div>
                  {kraTypeError && (
                    <p className="text-xs text-red-500 mt-1.5 font-semibold">
                      Please select Job Specified or Organizational KRA
                    </p>
                  )}
                </div>

                {/* Search + Filters */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search KRA by name..."
                      onChange={(e) => {
                        const v = e.target.value.toLowerCase();
                        setLibraryKras(
                          allLibraryKras.filter(
                            (k) => k.type === kraType && k.name.toLowerCase().includes(v),
                          ),
                        );
                      }}
                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    disabled
                    title="More filters coming soon"
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed shrink-0"
                  >
                    <SlidersHorizontal size={16} /> Filters
                  </button>
                </div>

                {/* KRA grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  {libraryKras.length === 0 ? (
                    <p className="col-span-full text-center py-10 text-gray-400 text-sm">
                      No KRAs found in this category.
                    </p>
                  ) : (
                    libraryKras.map((kra) => {
                      const alreadyAdded = selectedKras.some((k) => k.originalId === kra.id);
                      return (
                        <label
                          key={kra.id}
                          className={`flex flex-col gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${alreadyAdded ? "border-purple-300 bg-purple-50/60" : "border-gray-200 bg-white hover:border-purple-200"}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-gray-800 truncate">{kra.name}</p>
                              <span className="inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                                {kra.kpis?.length || 0} KPIs
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
                            <input
                              type="checkbox"
                              checked={alreadyAdded}
                              onChange={() =>
                                alreadyAdded
                                  ? setSelectedKras((prev) => prev.filter((k) => k.originalId !== kra.id))
                                  : handleSelectKra(kra)
                              }
                              className="w-4 h-4 accent-purple-600 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-gray-600">Select</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end">
                  <motion.button
                    onClick={() => navigate("/kra-builder?from=assign_individual")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-3.5 py-2
    bg-gradient-to-r from-violet-600 to-purple-600
    text-white rounded-lg text-xs font-semibold
    shadow hover:shadow-lg transition-all duration-300"
                  >
                    <Plus size={14} />
                    Create KRA
                  </motion.button>
                </div>
              </div>
            )}

            {/* ====== STEP 2: ASSIGN TARGET ====== */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto py-4">
                <div className="text-center mb-6">
                  <div className="mx-auto w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                    <Users size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Assign to Employee or Group
                  </h3>
                  <p className="text-sm text-gray-500 mt-1.5">
                    Search for the target user or department to assign this KRA
                    template to.
                  </p>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    placeholder="Search employee or group by name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowAssignDropdown(true);
                    }}
                    onFocus={() => setShowAssignDropdown(true)}
                    className="w-full pl-11 pr-10 py-3 text-sm rounded-xl bg-white border-2 border-purple-100 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-50 transition-all shadow-sm"
                  />
                  <Users
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400"
                    size={18}
                  />
                  <ChevronDown
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={16}
                  />

                  <AnimatePresence>
                    {showAssignDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto"
                      >
                        {filteredAssignees?.length === 0 ? (
                          <p className="p-4 text-center text-gray-400">
                            No matches found.
                          </p>
                        ) : (
                          filteredAssignees?.map((item) => {
                            const isChecked =
                              selectedAssignees?.some((a) => a.id === item.id) || false;

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-4 hover:bg-purple-50 border-b border-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {/* ✅ Checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation(); // ✅ prevents dropdown closing

                                      if (isChecked) {
                                        setSelectedAssignees((prev) =>
                                          prev?.filter((a) => a.id !== item.id)
                                        );
                                      } else {
                                        setSelectedAssignees((prev) => [
                                          ...(prev || []),
                                          item,
                                        ]);
                                      }

                                      setViewMode("create");
                                    }}
                                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                                  />

                                  <UserCircle size={20} className="text-gray-400" />

                                  <span className="font-semibold text-gray-700">
                                    {item.name}
                                  </span>
                                </div>

                                <span
                                  className={`text-xs font-bold px-3 py-1 rounded-full ${item.type === "user"
                                    ? "bg-violet-100 text-violet-700"
                                    : "bg-emerald-100 text-emerald-700"
                                    }`}
                                >
                                  {item.type === "user" ? "User" : "Group"}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Quick Filters:</span>
                  {[
                    { key: "user", label: "Employees", Icon: UserCircle },
                    { key: "group", label: "User Groups", Icon: Users },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        setAssigneeTypeFilter((prev) => (prev === f.key ? "all" : f.key));
                        setShowAssignDropdown(true);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        assigneeTypeFilter === f.key
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <f.Icon size={14} />
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled
                    title="Department grouping isn't available yet"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  >
                    <Building2 size={14} />
                    Departments
                  </button>
                </div>

                {selectedAssignees.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {selectedAssignees.map((assignee) => (
                      <motion.div
                        key={assignee.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-purple-600 px-4 py-2 rounded-xl text-white shadow"
                      >
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                          {assignee.name.charAt(0)}
                        </div>

                        <div>
                          <p className="text-sm font-semibold">{assignee.name}</p>
                          <p className="text-[10px] uppercase">{assignee.type}</p>
                        </div>

                        <button
                          onClick={() =>
                            setSelectedAssignees((prev) =>
                              prev.filter((a) => a.id !== assignee.id),
                            )
                          }
                          className="ml-2"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ====== STEP 3: CONFIGURE WEIGHTS ====== */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500">
                {selectedKras.map((kra) => {
                  const totalKpiWeight = kra.kpis.reduce(
                    (sum, k) => sum + Number(k.weight || 0),
                    0,
                  );
                  const isSavedColor = kra.isSaved ? "emerald" : "indigo";

                  return (
                    <div
                      key={kra.instanceId}
                      className={`rounded-2xl border bg-white overflow-hidden transition-all duration-300 shadow-sm ${kra.isSaved ? "border-emerald-200" : "border-gray-200 hover:border-purple-300"}`}
                    >
                      {/* Accordion Header row */}
                      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {kra.isSaved && (
                              <CheckCircle2
                                size={18}
                                className="text-emerald-500"
                              />
                            )}
                            <h3 className="font-bold text-gray-800 text-base">
                              {kra.name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                            {kra.type === "functional" ? "Job Specified KRA" : "Organizational KRA"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">
                            Appraisal Weight
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={kra.weight}
                              placeholder="0"
                              className="w-16 text-center font-bold text-purple-700 bg-purple-50 border border-gray-300 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                              onWheel={(e) => e.target.blur()}   // 🚫 disable mouse scroll
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();            // 🚫 disable arrow keys
                                }
                              }}
                              onChange={(e) =>
                                updateKraWeight(kra.instanceId, e.target.value)
                              }
                            />
                            <span className="text-xs font-bold text-gray-400 pr-2">
                              %
                            </span>
                          </div>
                          <button
                            onClick={() => cutKraFromSelection(kra.instanceId)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* KPIs breakdown container */}
                      <div className="p-5 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-700">
                            KPI Distribution
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${totalKpiWeight === 100 ? "bg-emerald-500" : totalKpiWeight > 100 ? "bg-red-500" : "bg-purple-500"}`}
                                style={{
                                  width: `${Math.min(totalKpiWeight, 100)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-bold ${totalKpiWeight === 100 ? "text-emerald-600" : "text-red-500"}`}
                            >
                              {totalKpiWeight}% / 100%
                            </span>
                          </div>
                        </div>

                        {kra.kpis.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">
                            No KPIs exist for this KRA.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {kra.kpis.map((kpi, kpiIndex) => (
                              <div
                                key={kpi.localId}
                                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-700">
                                  {kpi.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={kpi.weight}
                                    placeholder="0"
                                    className="w-16 text-center font-bold text-purple-700 bg-purple-50 border border-gray-300 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    onWheel={(e) => e.target.blur()}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) =>
                                      updateKpiWeight(kra.instanceId, kpiIndex, e.target.value)
                                    }
                                  />
                                  <span className="text-xs font-bold text-gray-400">
                                    %
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Save Action Area */}
                        <div className="mt-5 flex justify-end">
                          {(() => {
                            const isValid =
                              kra.kpis.length === 0 || totalKpiWeight === 100;
                            const canSave =
                              isValid &&
                              kra.weight &&
                              Number(kra.weight) > 0 &&
                              !kra.isSaved;
                            return (
                              <button
                                disabled={!canSave && !kra.isSaved}
                                onClick={() =>
                                  handleSaveKraTemporarily(kra.instanceId)
                                }
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${kra.isSaved
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  : canSave
                                    ? "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                  }`}
                              >
                                {kra.isSaved ? (
                                  <>
                                    <CheckCircle2 size={16} /> Saved
                                  </>
                                ) : (
                                  "Save Configuration"
                                )}
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
                  }
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step === 1 && (
                <button
                  disabled={!step1Valid}
                  onClick={() => {
                    if (!step1Valid)
                      return setError("Select at least one employee or group");

                    setStep(2);
                  }}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    step1Valid
                      ? "text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                      : "text-gray-400 bg-gray-100 cursor-not-allowed"
                  }`}
                >
                  {editingTemplateId ? "Configure Weights" : "Next Step"}
                </button>
              )}

              {step === 2 && (
                <button
                  disabled={!step2Valid}
                  onClick={() => {
                    if (!step2Valid)
                      return setError("Select at least one KRA");

                    setStep(3);
                  }}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    step2Valid
                      ? "text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                      : "text-gray-400 bg-gray-100 cursor-not-allowed"
                  }`}
                >
                  Next Step
                </button>
              )}

              {step === 3 && selectedKras.length > 0 && (
                <button
                  onClick={() => {
                    // 🔥 1. Total KRA weight must be 100
                    // 🔥 Total KRA must be between 1 and 100

                    // ⭐ NEW CHECK
                    const unsavedKra = selectedKras.some((k) => !k.isSaved);
                    if (unsavedKra) {
                      setError("Please click 'Save Configuration' for all KRAs before assigning.");
                      return;
                    }
                    // 🔥 Total KRA weight must be exactly 100
                    if (totalKraWeight !== 100) {
                      setError("Total KRA weight must be exactly 100% before assigning");
                      return;
                    }

                    // 🔥 2. Every KRA must have weight
                    const missingKra = selectedKras.some((k) => !k.weight);
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
                          0,
                        );

                        if (totalKpi !== 100) {
                          setError(`KPI total must be 100% for "${kra.name}"`);
                          return;
                        }

                        // All KPI weights mandatory
                        const zeroKpi = kra.kpis.some((k) => Number(k.weight) <= 0);

                        if (zeroKpi) {
                          setError(`Each KPI must have weight greater than 0 for "${kra.name}"`);
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

                        await handleAssignedSubmit(); // ✅ ONLY THIS

                        resetTemplateBuilder();
                        setStep(1);

                      } catch (err) {
                        console.error(err);
                      }
                    })();
                  }}
                  disabled={!step3Valid}
                  title={!step3Valid ? "Save every KRA and reach 100% total weight before assigning" : undefined}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    step3Valid
                      ? "text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200"
                      : "text-gray-400 bg-gray-100 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 size={18} />
                  {viewMode === "editAssigned"
                    ? "Update Assignment"
                    : editingTemplateId
                      ? "Update Template"
                      : selectedAssignees.length > 0
                        ? "Assign"
                        : "Save Master Template"}
                </button>
              )}
            </div>
          </div>

          {/* ====== TEMPLATES GRID (List section below) ====== */}
          {/* {savedTemplates.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  Available Templates
                </h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 font-bold text-xs rounded-lg">
                  {savedTemplates.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-purple-300 hover:shadow-xl transition-all duration-300 flex flex-col"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-lg mb-4">
                        {template.name}
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-6">
                        <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          {template.functionalKras.length} Func
                        </div>
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {template.organizationalKras.length} Org
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      <button
                        onClick={() => {
                          const combined = [
                            ...template.functionalKras,
                            ...template.organizationalKras,
                          ].map((k) => ({
                            ...k,
                            instanceId: crypto.randomUUID(),
                            isSaved: true,
                            kpis: (k.kpis || []).map((kpi, i) => ({
                              localId: `${Date.now()}-${i}`,
                              name: kpi.name,
                              weight: kpi.weight || "",
                            })),
                          }));
                          setSelectedKras(combined);
                          setTemplateName(template.name);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="py-2 text-xs font-bold text-center border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          const combined = [
                            ...template.functionalKras,
                            ...template.organizationalKras,
                          ].map((k) => ({
                            ...k,
                            instanceId: crypto.randomUUID(),
                            isSaved: true,
                            kpis: (k.kpis || []).map((kpi, i) => ({
                              localId: `${Date.now()}-${i}`,
                              name: kpi.name,
                              weight: kpi.weight || "",
                            })),
                          }));
                          setSelectedKras(combined);
                          setTemplateName(template.name);
                          setEditingTemplateId(template.id);
                          setStep(1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="py-2 text-xs font-bold text-center border border-purple-200 text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          const cloned = [
                            ...template.functionalKras,
                            ...template.organizationalKras,
                          ].map((k) => ({
                            ...k,
                            instanceId: crypto.randomUUID(),
                            weight: "",
                            isSaved: false,
                            kpis: (k.kpis || []).map((kpi, i) => ({
                              localId: `${Date.now()}-${i}`,
                              name: kpi.name,
                              weight: "",
                            })),
                          }));
                          setSelectedKras(cloned);
                          setTemplateName(template.name);
                          setStep(2);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="py-2 text-xs font-bold text-center border border-transparent bg-purple-600 text-white flex items-center justify-center gap-1 rounded-xl hover:bg-purple-700 transition-colors"
                      >
                        <Play size={12} /> Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* ====== SUBMITTED HISTORY SECTION ====== */}
          {submittedForCycle.length > 0 && (
            <div className="mt-12 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowHistory(!showHistory)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      Assignment History
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {submittedForCycle.length} employees assigned
                    </p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-800 transition-colors bg-gray-50 p-2 rounded-full">
                  {showHistory ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>
              </div>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-6 border-t border-gray-100 mt-6">
                      <div className="max-w-md mx-auto mb-8">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block text-center">
                          Select Employee to View Config
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                          onChange={(e) => {
                            const selected = submittedForCycle.find(
                              (s) => s.assignedToId === e.target.value,
                            );
                            if (selected) {
                              setSelectedAssignee({
                                name: selected.assignedToName,
                                type: selected.assignedToType,
                                id: selected.assignedToId,
                              });
                              setSearchTerm("");
                              setShowAssignDropdown(false);
                              setViewMode("view");
                            }
                          }}
                        >
                          <option value="">Choose employee...</option>
                          {submittedForCycle.map((item) => (
                            <option key={item.id} value={item.assignedToId}>
                              {item.assignedToName} ({item.assignedToType})
                            </option>
                          ))}
                        </select>
                      </div>

                      {viewMode === "view" &&
                        selectedAssignee &&
                        selectedKras.length > 0 && (
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                              <div>
                                <p className="font-bold text-gray-800 text-lg">
                                  {selectedAssignee.name}
                                </p>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                                  {selectedAssignee.type}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setViewMode("editAssigned")}
                                  className="px-4 py-2 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:text-purple-600 transition-colors"
                                >
                                  Edit Config
                                </button>
                                <button
                                  onClick={() => {
                                    setViewMode("create");
                                    setSelectedAssignee(null);
                                    setSelectedKras([]);
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-500 bg-white border border-gray-200 rounded-xl transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {selectedKras.map((kra) => (
                                <div
                                  key={kra.instanceId}
                                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="font-bold text-gray-700">
                                      {kra.name}
                                    </p>
                                    <span className="font-black text-emerald-500">
                                      {kra.weight}%
                                    </span>
                                  </div>
                                  {kra.kpis.length > 0 && (
                                    <div className="space-y-2 pl-3 border-l-2 border-emerald-100">
                                      {kra.kpis.map((kpi, index) => (
                                        <div
                                          key={index}
                                          className="flex justify-between text-xs font-semibold text-gray-600"
                                        >
                                          <span className="truncate pr-4">
                                            {kpi.name}
                                          </span>
                                          <span>{kpi.weight}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-6 p-4 bg-emerald-800 rounded-xl text-emerald-50 flex items-center justify-between font-bold text-sm">
                              <span>Total KRAs: {selectedKras.length}</span>
                              <span>
                                Total Weight:{" "}
                                {selectedKras.reduce(
                                  (s, k) => s + Number(k.weight || 0),
                                  0,
                                )}
                                %
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
