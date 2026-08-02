import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { confirmDialog } from "../components/ConfirmDialog";
import getAuthAxios from "../utils/authAxios";
import {
  FileText,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  Building2,
  Briefcase,
  X,
  LayoutTemplateIcon,
  Users,
} from "lucide-react";

import TemplateHeader from "./templates/TemplateHeader";
import TemplateCard from "./TemplateCard";
import Loader from "./components/Loader";
import { isPMS_Employee, isPMS_HR, isPMS_Manager,getPmsRole } from "../utils/pmsrolecheck";
// import EmployeeKraBuilder from "./templates/EmployeeKraBuilder";

export default function TemplatePage({ mode = "my", lockedView = false }) {
  const templateView = mode;

  const navigate = useNavigate();
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [openKRA, setOpenKRA] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [kraResponses, setKraResponses] = useState({});
  const [kraRatings, setKraRatings] = useState({});
  const [kraResponseFiles, setKraResponseFiles] = useState({});
  // const [templateView, setTemplateView] = useState(mode);..
  const [submittedTemplates, setSubmittedTemplates] = useState({});
  const [draftKras, setDraftKras] = useState({});
  const [openSavedKra, setOpenSavedKra] = useState(null);
  const [managerList, setManagerList] = useState([]);
  const [selectedManager, setSelectedManager] = useState("");

  const [hrEnableResponseRating, setHrEnableResponseRating] = useState(false);

  const [kraWeightDrafts, setKraWeightDrafts] = useState({});

  const [extraKras, setExtraKras] = useState({});
  const [kraErrors, setKraErrors] = useState({});
  const [kpiErrors, setKpiErrors] = useState({});
  const [cycles, setCycles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [functionalKras, setFunctionalKras] = useState([]);
  const [orgKras, setOrgKras] = useState([]);
  const [functionalSearch, setFunctionalSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [openLibraryKra, setOpenLibraryKra] = useState(null);
  const [showAllFunctional, setShowAllFunctional] = useState(false);
  const functionalSectionRef = useRef(null);
  const dropdownRef = useRef(null);
  const [showAllOrg, setShowAllOrg] = useState(false);
  const [selectedLibraryKras, setSelectedLibraryKras] = useState([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [kraActuals, setKraActuals] = useState({});
  const [savedKraKeys, setSavedKraKeys] = useState(new Set());
  useEffect(() => {
    if (!functionalSectionRef.current) return;

    if (showAllFunctional) {
      functionalSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    } else {
      functionalSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showAllFunctional]);

  // handle adding :
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current) return;

      if (!dropdownRef.current.contains(event.target)) {
        setShowTemplateDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const loadKras = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get("/kra-library");

      let all = [];

      if (Array.isArray(res.data)) {
        all = res.data;
      } else if (Array.isArray(res.data?.kras)) {
        all = res.data.kras;
      } else if (Array.isArray(res.data?.data)) {
        all = res.data.data;
      }

      // console.log("KRA LIBRARY RESPONSE aksdfhkasdh:", all);

      setFunctionalKras(
        all.filter((k) => k.type?.toLowerCase() === "functional"),
      );

      setOrgKras(all.filter((k) => k.type?.toLowerCase() === "organizational"));
    } catch (err) {
      console.error("Failed to load KRAs", err);
    }
  };

  useEffect(() => {
    loadKras();
  }, []);

  // Delete Funcational and Org
  const handleDeleteLibraryKra = async (kraId) => {
    const confirmed = await confirmDialog({
      title: "Delete KRA?",
      text: "This will permanently delete this KRA and its KPIs.",
      confirmText: "Delete",
      danger: true,
    });

    if (!confirmed) return;
    // ḍelete
    try {
      const api = await getAuthAxios();
      await api.delete(`/kra-library/${kraId}`);

      loadKras(); // reload list
      toast.success("KRA deleted successfully");
    } catch (err) {
      console.error(err);

      const message =
        err.response?.data?.detail ||
        "Cannot delete. This KRA is already used in a template.";

      toast.error(message);
    }
  };
  // edit
  const handleEditLibraryKra = (kra) => {
    navigate(`/kra-builder/${kra.id}`);
  };

  const getTotalKraWeight = (temp) => {
    const baseWeight = (temp.kras || []).reduce(
      (sum, k) => sum + Number(k.weight || 0),
      0,
    );
    const employeeWeight = (draftKras[temp.id] || []).reduce(
      (sum, k) => sum + Number(k.weight ?? 0),
      0,
    );
    return baseWeight + employeeWeight;
  };

  const getRemainingKraWeight = (temp) => {
    return Math.max(0, 100 - getTotalKraWeight(temp));
  };
  // if (getRemainingKraWeight(temp) <= 0) {
  //   toast.warning("You already reached 100%");
  //   return;
  // }
  const isManager = (u) => isPMS_Manager(u);
  const isEmployee = (u) => isPMS_Employee(u);

  const role = getPmsRole(loggedInUser);

  const isManagerRole = isPMS_Manager(loggedInUser);
  const isHrRole = isPMS_HR(loggedInUser);

  const canViewTemplate = !!role;

  const canRespondEffective =
    isPMS_Employee(loggedInUser) ||
    isPMS_Manager(loggedInUser) ||
    (isPMS_HR(loggedInUser) && templateView === "my");

  const showAssignedTemplates =
    templateView === "my" || isPMS_Employee(loggedInUser);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    setLoggedInUser(user || null);
  }, []);

  const getCycleById = (cycleId) => {
    if (!Array.isArray(cycles)) return null;

    return cycles.find((c) => c.id === cycleId);
  };

  useEffect(() => {
    async function loadCycles() {
      try {
        const api = await getAuthAxios();
        const res = await api.get("/cycles/");
        const raw = Array.isArray(res.data) ? res.data : res.data?.cycles || [];

        setCycles(raw);
      } catch (e) {
        console.error("Failed to load cycles", e);
        setCycles([]);
      }
    }
    loadCycles();
  }, []);
  // console.log("CYCLES:", cycles);
  // console.log("Is Array:", Array.isArray(cycles));

  useEffect(() => {
    async function fetchManagers() {
      const api = await getAuthAxios();
      const res = await api.get("/managers/");
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.managers)
          ? res.data.managers
          : [];

      setManagerList(raw);
    }
    fetchManagers();
  }, []);

  useEffect(() => {
    if (!loggedInUser?._id && !loggedInUser?.id) {
      setLoading(false);
      return;
    }
  }, [loggedInUser]);

  // const loadTemplates = async () => {
  //   setLoading(true);
  //   try {
  //     const api = await getAuthAxios();
  //     const employeeId = loggedInUser?._id || loggedInUser?.id;

  //     const res = await api.get(`/kpi-template/assigned/${employeeId}`);

  //     const raw = Array.isArray(res.data) ? res.data : [];

  //     const mapped = raw.map(t => ({
  //       id: t._id,
  //       name: "Assigned KPI Template",
  //       cycleId: t.cycleId,
  //       kras: t.kras || [],
  //       assignedToId: employeeId,
  //       assignedToType: "user",
  //       status: t.status
  //     }));

  //     setTemplates(mapped);

  //   } catch (err) {
  //     console.error(err);
  //     setTemplates([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const api = await getAuthAxios();
      const employeeId = loggedInUser?._id || loggedInUser?.id;

      const res = await api.get(`/kpi-template/assigned/${employeeId}`);
      const raw = Array.isArray(res.data) ? res.data : [];

      // ⭐ REMOVE DUPLICATES BY cycleId
      const uniqueMap = new Map();

      raw.forEach((t) => {
        const key = t.cycleId; // unique per cycle
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, t);
        }
      });

      const uniqueTemplates = Array.from(uniqueMap.values());

      const mapped = uniqueTemplates.map((t) => ({
        id: t._id,
        //name: "Assigned KPI Template",
        cycleId: t.cycleId,
        kras: t.kras || [],
        assignedToId: employeeId,
        assignedToType: "user",
        status: t.status,
      }));

      //console.log(mapped, "mapped");

      setTemplates(mapped);
    } catch (err) {
      console.error(err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const userId = loggedInUser?._id || loggedInUser?.id;

  const filteredTemplates = templates.filter((temp) => {
    // console.log("CALLING API FOR TEMPLATE:", temp.id);

    // HR can see everything
    if (role === "hr") return true;

    // Employee or manager → only their assigned templates
    if (role === "employee" || role === "manager") {
      return temp.assignedToId === userId && temp.assignedToType === "user";
    }

    return false;
  });

  useEffect(() => {
    if (!loggedInUser) return;
    loadTemplates();
  }, [loggedInUser]);

  const loadEmployeeKra = async () => {
    const api = await getAuthAxios();
    const employeeId = loggedInUser._id || loggedInUser.id;

    const newDrafts = {};
    const newResponses = {};
    const newRatings = {};
    const newSubmitted = {};

    for (const temp of filteredTemplates) {
      try {
        const res = await api.get(`/kra/by-template/${temp.id}/${employeeId}`);

        const data = res.data;

        if (!data.exists) continue;

        // ⭐ EMPLOYEE CREATED KRAs
        const employeeOnly = (data.kras || []).filter(
          (k) => !k.kraId?.includes("-base-"),
        );

        newDrafts[temp.id] = employeeOnly.map((k) => ({
          id: k.kraId,
          name: k.name,
          weight: k.weight,
          kpis: k.kpis || [],
          isEmployeeKra: true,
        }));

        // ⭐ RESPONSES
        if (data.responses) {
          Object.entries(data.responses).forEach(([kraId, value]) => {
            const key = `${temp.id}::${employeeId}::${kraId}`;
            newResponses[key] = value;
          });
        }

        // ⭐ RATINGS
        if (data.ratings) {
          Object.entries(data.ratings).forEach(([kraId, value]) => {
            const key = `${temp.id}::${employeeId}::${kraId}`;
            newRatings[key] = value;
          });
        }

        // ⭐ SUBMISSION STATUS
        if (data.status) {
          newSubmitted[temp.id] = { status: data.status };
        }
      } catch (err) {
        console.error("Failed to load employee KRA", err);
      }
    }

    setDraftKras(newDrafts);
    setKraResponses(newResponses);
    setKraRatings(newRatings);
    setSubmittedTemplates(newSubmitted);
  };
  useEffect(() => {
    if (!loggedInUser || templates.length === 0) return;
    loadEmployeeKra();
  }, [loggedInUser, templates]);

  const handleDeleteTemplate = async (templateId) => {
    const confirmed = await confirmDialog({
      title: "Are you sure?",
      text: "This template will be permanently deleted!",
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const api = await getAuthAxios();
      await api.delete(`/templates/${templateId}`);

      await loadTemplates();
    } catch (err) {
      toast.error("Failed to delete template!");
    }
  };

  const handleApplyTemplate = async () => {
    setErrorMessage("");

    if (selectedTemplates.length === 0) {
      setErrorMessage("Please select at least one template!");
      return;
    }

    try {
      const api = await getAuthAxios();
      await api.post("/templates/assign", {
        templateIds: selectedTemplates,
      });

      await loadTemplates();
      setSelectedTemplates([]);
      setErrorMessage("");
      toast.success("Templates assigned successfully!");
    } catch (err) {
      setErrorMessage("Something went wrong!");
      toast.error("Failed to assign templates");
    }
  };

  // Step 1: Send employee-created KRAs for approval (no self response/rating for employee KRAs yet)
  const sendForApproval = async (temp) => {
    try {
      const employeeId = loggedInUser._id || loggedInUser.id;

      const getResponseKey = (kraId) => `${temp.id}::${employeeId}::${kraId}`;

      if (hasIncompleteExtraKra(temp.id)) {
        toast.warning("Please complete and save all custom KRAs before submitting.");
        return;
      }

      const krasPayload = [];

      // Employee KRAs ONLY (approval gate applies to employee-created KRAs)
      (draftKras[temp.id] || []).forEach((kra) => {
        krasPayload.push({
          kraId: kra.id,
          name: kra.name,
          weight: kra.weight,
          kpis: kra.kpis || [],
          // keep empty until approved and self-review is submitted
          response: "",
          rating: 0,
        });
      });

      const api = await getAuthAxios();
      const res = await api.post("/kra/submit", {
        templateId: temp.id,
        employeeId,
        managerId: selectedManager,
        kras: krasPayload,
      });

      toast.success("Data sent to Manager");

      setSubmittedTemplates((prev) => ({
        ...prev,
        [temp.id]: { status: "pending_manager_approval" },
      }));

      // Do NOT clear KRAs. Employee needs them after approval to fill self-response & rating.
    } catch (err) {
      console.error("KRA SUBMIT ERROR ❌", err);
      const detail = err.response?.data?.detail;
      if (detail === "Template already submitted") {
        toast.info("This template was already submitted.");
        setSubmittedTemplates((prev) => ({
          ...prev,
          [temp.id]: true,
        }));
        return;
      }
      toast.error(detail || "Something went wrong");
    }
  };

  // Step 2: After approval, employee submits self review (HR KRAs + approved employee KRAs)
  const submitSelfReview = async (temp) => {
    try {
      const employeeId = loggedInUser._id || loggedInUser.id;

      if (!selectedManager) {
        toast.warning("Please select a reporting manager");
        return;
      }

      const submission = submittedTemplates?.[temp.id];
      const rawStatus = submission?.status;

      // ✅ if HR assigned full 100%, allow directly
      const hrWeight = (temp.kras || []).reduce(
        (sum, k) => sum + Number(k.weight || 0),
        0
      );

      const isFullyAssignedByHR = hrWeight === 100;

      const status = isFullyAssignedByHR
        ? "manager_approved"
        : rawStatus;

      if (status !== "manager_approved") {
        toast.warning("Manager/HR approval is required before submitting self review for employee KRAs.");
        return;
      }

      const getResponseKey = (kraId) => `${temp.id}::${employeeId}::${kraId}`;

      const krasPayload = [];

      // HR KRAs (employee can always respond when enabled)
      (temp.kras || []).forEach((kra, index) => {
        const kraId = kra._id || `${temp.id}-base-${index}`;
        krasPayload.push({
          id: kraId,
          name: kra.name,
          weight: kra.weight,
          kpis: kra.kpis || [],
          response: kraResponses[getResponseKey(kraId)] || "",
          rating: kraRatings[getResponseKey(kraId)] || 0,
        });
      });

      // Employee KRAs (now approved, so allow self response/rating submission)
      (draftKras[temp.id] || []).forEach((kra) => {
        const kraId = kra.id;
        krasPayload.push({
          id: kraId,
          name: kra.name,
          weight: kra.weight,
          kpis: kra.kpis || [],
          response: kraResponses[getResponseKey(kraId)] || "",
          rating: kraRatings[getResponseKey(kraId)] || 0,
        });
      });

      const api = await getAuthAxios();
      await api.post("/reports/employee-submit", {
        employeeId,
        templateId: temp.id,
        managerId: selectedManager,
        kras: krasPayload,
      });

      toast.success("Self review submitted to Manager/HR");
      setSubmittedTemplates((prev) => ({
        ...prev,
        [temp.id]: { status: "final_employee_submitted" },
      }));
    } catch (err) {
      console.error("SELF REVIEW SUBMIT ERROR ❌", err);
      const detail =
        err.response?.data?.detail || err.message || "Something went wrong";
      toast.error(detail);
    }
  };

  const hasIncompleteExtraKra = (tempId) => {
    const kras = extraKras[tempId] || [];
    if (kras.length === 0) return false;
    return kras.some((kra, idx) => {
      const key = `${tempId}-${idx}`;
      if (!kra.name?.trim()) return true;
      if (!kra.weight || Number(kra.weight) <= 0) return true;
      if (kraErrors[key]?.name || kraErrors[key]?.weight) return true;
      const hasKpiError = Object.keys(kpiErrors).some((k) =>
        k.startsWith(`${tempId}-${idx}-`),
      );
      if (hasKpiError) return true;
      return false;
    });
  };

  const validateKra = (tempId, idx, kra, weight) => {
    const errors = {};
    const temp = Array.isArray(templates)
      ? templates.find((t) => t.id === tempId)
      : null;

    if (!temp) return {};

    const maxAllowedKraWeight = 100 - getTotalKraWeight(temp);

    if (!kra.name?.trim()) {
      errors.name = "KRA name is required";
    }

    if (!weight || Number(weight) <= 0) {
      errors.weight = "KRA weight is required";
    } else if (Number(weight) > maxAllowedKraWeight) {
      errors.weight = `Max allowed is ${maxAllowedKraWeight}%`;
    }

    return errors;
  };

  const getTemplateValidationErrors = (temp) => {
    if (submittedTemplates[temp.id]) {
      return [];
    }

    const errors = [];

    if ((extraKras[temp.id] || []).length > 0) {
      errors.push("You have unsaved KRAs. Please save them.");
    }

    const baseWeight = (temp.kras || []).reduce(
      (sum, k) => sum + Number(k.weight || 0),
      0,
    );

    const savedWeight = (draftKras[temp.id] || []).reduce(
      (sum, k) => sum + Number(k.weight || 0),
      0,
    );

    const totalWeight = getTotalKraWeight(temp);

    if (totalWeight !== 100) {
      errors.push(
        `Total KRA weight must be exactly 100%. Current: ${totalWeight}%`,
      );
    }
    if (!selectedManager) {
      errors.push("Please select a Reporting Manager.");
    }

    return errors;
  };

  const showSearchBar =
    filteredTemplates.length > 0 &&
    !((isPMS_HR(loggedInUser) || isPMS_Manager(loggedInUser)) && templateView === "my");

  // Filter by search query
  const searchFilteredTemplates = filteredTemplates.filter((temp) => {
    if (!showSearchBar) return true;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    const cycle = getCycleById(temp.cycleId);
    return (
      temp.name?.toLowerCase().includes(query) ||
      cycle?.name?.toLowerCase().includes(query) ||
      temp.kras?.some((kra) => kra.name?.toLowerCase().includes(query))
    );
  });

  // Calculate statistics
  const isSubmittedStatus = (status) =>
    status === "employee_submitted" ||
    status === "final_employee_submitted" ||
    status === "final_manager_reviewed";

  const stats = {
    total: filteredTemplates.length,
    submitted: filteredTemplates.filter((t) =>
      isSubmittedStatus(submittedTemplates[t.id]?.status)
    ).length,

    pending: filteredTemplates.filter((t) =>
      !isSubmittedStatus(submittedTemplates[t.id]?.status)
    ).length,
  };

  if (loading || !loggedInUser) {
    return (
      <Loader containerClass="flex flex-col mt-20 items-center justify-center h-[60vh] gap-3" />
    );
  }
  const filteredFunctional = functionalKras.filter((k) =>
    k.name.toLowerCase().includes(functionalSearch.toLowerCase()),
  );

  const displayedFunctional = showAllFunctional
    ? filteredFunctional
    : filteredFunctional.slice(0, 5);
  const filteredOrg = orgKras.filter((k) =>
    k.name?.toLowerCase().includes(orgSearch.trim().toLowerCase()),
  );

  const displayedOrg = showAllOrg ? filteredOrg : filteredOrg.slice(0, 5);

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8 space-y-5">
      {/* Header */}
      <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {templateView === "my" && (
                <h1 className="text-2xl font-extrabold text-slate-900">
                  My KRA & KPI's
                </h1>
              )}
              {(isPMS_HR(loggedInUser) || isPMS_Manager(loggedInUser)) &&
                templateView === "employees" && (
                  <>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                      Define KRA & KPI's
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Create and manage Key Result Areas and their Key Performance Indicators
                    </p>
                  </>
                )}
            </div>

            {templateView === "employees" && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => navigate("/kra-builder")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold shadow-sm transition"
                >
                  <Plus size={16} />
                  Create KRA
                </button>

                {["hr", "manager"].includes(loggedInUser?.roles?.pms?.toLowerCase()) && (
                  <>
                    <button
                      onClick={() => navigate("/assign-individual")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-200 bg-white text-violet-700 text-sm font-bold hover:bg-violet-50 transition"
                    >
                      <Users className="w-4 h-4" />
                      Assign to Individual
                    </button>

                    <div ref={dropdownRef} className="relative">
                      <button
                        onClick={() => setShowTemplateDropdown((prev) => !prev)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-200 bg-white text-violet-700 text-sm font-bold hover:bg-violet-50 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Assign by Template
                      </button>

                      {/* Dropdown */}
                      {showTemplateDropdown && (
                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-lg border border-slate-100 p-2 z-50">
                          <div className="space-y-1">
                            {/* Create Template */}
                            <button
                              onClick={() => {
                                setShowTemplateDropdown(false);
                                navigate("/create_template");
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all text-left"
                            >
                              <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                                <Plus size={14} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Create Template</p>
                                <p className="text-xs text-slate-400">Build new KRA template</p>
                              </div>
                            </button>

                            {/* Available Templates */}
                            <button
                              onClick={() => {
                                setShowTemplateDropdown(false);
                                navigate("/available_template");
                              }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all text-left"
                            >
                              <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                                <LayoutTemplateIcon size={14} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Available Templates</p>
                                <p className="text-xs text-slate-400">View created templates</p>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Template Header Switch */}
          {!lockedView && (
            <TemplateHeader
              loggedInUser={loggedInUser}
              templateView={templateView}
              setTemplateView={(view) => {
                if (view === "my") navigate("/mytemplate");
                else navigate("/employeetemplate");
              }}
            />
          )}
      </div>

        {/* ================= TWO KRA SECTIONS ================= */}

        {["hr", "manager"].includes(loggedInUser?.roles?.pms?.toLowerCase()) &&
          templateView === "employees" && (
            <div className="space-y-5 ">
              {/* FUNCTIONAL */}

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                {/* header */}
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                  {/* LEFT SIDE */}
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-bold text-base text-slate-900">
                        Job Specified KRA
                      </h2>

                      <span className="text-xs font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                        {filteredFunctional.length}
                      </span>
                    </div>
                    <span className="block w-8 h-0.5 rounded-full bg-violet-600 mt-1.5" />
                  </div>

                  {/* RIGHT SIDE */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-72">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />

                      <input
                        placeholder="Search Job Specified KRA..."
                        value={functionalSearch}
                        onChange={(e) => setFunctionalSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-colors duration-150 placeholder:text-slate-400"
                      />

                      {functionalSearch && (
                        <button
                          type="button"
                          onClick={() => setFunctionalSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* list */}
                {/* <div className="max-h-72 overflow-y-auto space-y-2 pr-1"> */}
                <div className="max-h-[380px] overflow-y-auto space-y-2 pr-2 custom-scroll">
                  {displayedFunctional.map((kra, index) => {
                    const isUpdated =
                      kra.updatedAt &&
                      kra.createdAt &&
                      new Date(kra.updatedAt).getTime() !== new Date(kra.createdAt).getTime();
                    const isOpen = openLibraryKra === kra.id;
                    const createdDate = kra.createdAt
                      ? new Date(kra.createdAt).toLocaleDateString()
                      : null;

                    return (
                      <motion.div
                        key={kra.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-slate-200/70 bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                      >
                        {/* HEADER */}
                        <div
                          onClick={() =>
                            setOpenLibraryKra(isOpen ? null : kra.id)
                          }
                          className="px-4 py-3 cursor-pointer flex justify-between items-center group"
                        >
                          {/* LEFT */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 shrink-0 rounded-full bg-violet-700 text-white text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition truncate">
                                {kra.name}
                              </p>

                              {/* Audit Row */}
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                {isUpdated ? (
                                  <>
                                    <span>Updated {new Date(kra.updatedAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{kra.updatedBy || "Unknown"}</span>
                                  </>
                                ) : kra.createdAt ? (
                                  <>
                                    <span>Created {new Date(kra.createdAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{kra.createdBy || "Unknown"}</span>
                                  </>
                                ) : (
                                  <span className="italic">No audit info</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* RIGHT */}
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditLibraryKra(kra);
                              }}
                              className="p-1.5 rounded-md hover:bg-violet-50 transition"
                              title="Edit KRA"
                            >
                              <Pencil size={16} className="text-violet-600" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLibraryKra(kra.id);
                              }}
                              className="p-1.5 rounded-md hover:bg-red-50 transition"
                              title="Delete KRA"
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>

                            {/* KPI COUNT BADGE */}
                            <span className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-semibold">
                              {kra.kpis?.length || 0} KPI
                            </span>

                            {/* ARROW */}
                            <motion.div
                              animate={{ rotate: isOpen ? 180 : 0 }}
                              transition={{ duration: 0.25 }}
                              className="text-slate-400"
                            >
                              ▼
                            </motion.div>
                          </div>
                        </div>

                        {/* DROPDOWN CONTENT */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              key="content"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.35, ease: "easeInOut" }}
                              className="px-6 pb-4 pt-2 bg-slate-50/60 border-t border-slate-100"
                            >
                              {kra.kpis?.length > 0 ? (
                                <div className="space-y-2">
                                  {kra.kpis.map((kpi) => (
                                    <motion.div
                                      key={kpi.id}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ duration: 0.25 }}
                                      className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-violet-50 transition"
                                    >
                                      <div className="w-2 h-2 rounded-full bg-violet-500" />
                                      {kpi.name}
                                    </motion.div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No KPIs added
                                </p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                  <div ref={functionalSectionRef}></div>

                  {filteredFunctional.length > 5 && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setShowAllFunctional((prev) => !prev)}
                        className="
        group
        flex items-center gap-2
        px-4 py-2
        rounded-full
        bg-violet-50
        text-violet-600
        text-sm font-medium
        border border-violet-100
        hover:bg-violet-100
        transition-colors duration-200
      "
                      >
                        <span>
                          {showAllFunctional ? "Show Less" : "Load More"}
                        </span>

                        <motion.span
                          animate={{ rotate: showAllFunctional ? 180 : 0 }}
                          transition={{ duration: 0.25 }}
                          className="text-violet-500"
                        >
                          ▼
                        </motion.span>
                      </button>
                    </div>
                  )}

                  {filteredFunctional.length === 0 && (
                    <div
                      className="flex flex-col items-center justify-center
    py-10 px-6 rounded-2xl
   
    border border-purple-100 text-center"
                    >
                      <div
                        className="mb-4 p-4 rounded-full
      bg-white shadow-md border border-purple-100"
                      >
                        {functionalSearch ? (
                          <Search className="w-6 h-6 text-purple-400" />
                        ) : (
                          <Briefcase className="w-6 h-6 text-purple-500" />
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-gray-800 mb-1">
                        {functionalSearch
                          ? "No Matching Results"
                          : "No Job Specified KRAs Yet"}
                      </h3>

                      <p className="text-xs text-gray-500 max-w-xs">
                        {functionalSearch
                          ? "Try refining your search terms to locate the correct KRA."
                          : "Job Specified KRAs will appear here once they are added to the system."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ORGANIZATIONAL */}
              {["hr", "manager"].includes(loggedInUser?.roles?.pms?.toLowerCase()) &&
                templateView === "employees" && (
                  <motion.div
                    layout
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
                  >
                    {/* header */}
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                      {/* LEFT */}
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="font-bold text-base text-slate-900">
                            Organizational KRA
                          </h2>

                          <span className="text-xs font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                            {filteredOrg.length}
                          </span>
                        </div>
                        <span className="block w-8 h-0.5 rounded-full bg-violet-600 mt-1.5" />
                      </div>

                      {/* RIGHT */}
                      <div className="flex items-center gap-3">
                        <div className="relative w-72">
                          <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          />

                          <input
                            placeholder="Search organizational KRA..."
                            value={orgSearch}
                            onChange={(e) => setOrgSearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-colors duration-150 placeholder:text-slate-400"
                          />

                          {orgSearch && (
                            <button
                              type="button"
                              onClick={() => setOrgSearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* list */}
                    <div className="max-h-[380px] overflow-y-auto space-y-2 pr-2 custom-scroll">
                      {displayedOrg.map((kra, index) => {
                        const isOpen = openLibraryKra === kra.id;
                        const createdDate = kra.createdAt
                          ? new Date(kra.createdAt).toLocaleDateString()
                          : null;
                        const isEdited =
                          kra.updatedAt && kra.updatedAt !== kra.createdAt;

                        return (
                          <motion.div
                            key={kra.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-slate-200/70 bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                          >
                            {/* HEADER */}
                            <div
                              onClick={() =>
                                setOpenLibraryKra(isOpen ? null : kra.id)
                              }
                              className="px-4 py-3 cursor-pointer flex justify-between items-center group"
                            >
                              {/* LEFT */}
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 shrink-0 rounded-full bg-violet-700 text-white text-xs font-bold flex items-center justify-center">
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition truncate">
                                    {kra.name}
                                  </p>

                                  {/* Audit Row */}
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                    {isEdited ? (
                                      <>
                                        <span>Updated {new Date(kra.updatedAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{kra.updatedBy || "Unknown"}</span>
                                      </>
                                    ) : kra.createdAt ? (
                                      <>
                                        <span>Created {new Date(kra.createdAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{kra.createdBy || "Unknown"}</span>
                                      </>
                                    ) : (
                                      <span className="italic">No audit info</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* RIGHT */}
                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditLibraryKra(kra);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-violet-50 transition"
                                  title="Edit KRA"
                                >
                                  <Pencil size={16} className="text-violet-600" />
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLibraryKra(kra.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-red-50 transition"
                                  title="Delete KRA"
                                >
                                  <Trash2 size={16} className="text-red-600" />
                                </button>

                                {/* KPI COUNT BADGE */}
                                <span className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-semibold">
                                  {kra.kpis?.length || 0} KPI
                                </span>

                                {/* ARROW */}
                                <motion.div
                                  animate={{ rotate: isOpen ? 180 : 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="text-slate-400"
                                >
                                  ▼
                                </motion.div>
                              </div>
                            </div>

                            {/* DROPDOWN CONTENT */}
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  key="content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{
                                    duration: 0.35,
                                    ease: "easeInOut",
                                  }}
                                  className="px-6 pb-4 pt-2 bg-slate-50/60 border-t border-slate-100"
                                >
                                  {kra.kpis?.length > 0 ? (
                                    <div className="space-y-2">
                                      {kra.kpis.map((kpi) => (
                                        <motion.div
                                          key={kpi.id}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.25 }}
                                          className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-violet-50 transition"
                                        >
                                          <div className="w-2 h-2 rounded-full bg-violet-600" />
                                          {kpi.name}
                                        </motion.div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">
                                      No KPIs added
                                    </p>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                      {filteredOrg.length > 5 && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={() => setShowAllOrg((prev) => !prev)}
                            className="group flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 text-violet-700 text-sm font-medium border border-violet-100 hover:bg-violet-100 transition-colors duration-200"
                          >
                            <span>{showAllOrg ? "Show Less" : "Load More"}</span>

                            <motion.span
                              animate={{ rotate: showAllOrg ? 180 : 0 }}
                              transition={{ duration: 0.25 }}
                              className="text-violet-600"
                            >
                              ▼
                            </motion.span>
                          </button>
                        </div>
                      )}
                      {filteredOrg.length === 0 && (
                        <div
                          className="flex flex-col items-center justify-center 
    py-10 px-6 rounded-2xl 
    
    border border-gray-200 text-center"
                        >
                          <div
                            className="mb-4 p-4 rounded-full 
      bg-white shadow-md border border-gray-200"
                          >
                            {orgSearch ? (
                              <Search className="w-6 h-6 text-gray-400" />
                            ) : (
                              <Building2 className="w-6 h-6 text-gray-400" />
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-gray-700 mb-1">
                            {orgSearch
                              ? "No Matching Results"
                              : "No Organizational KRAs Yet"}
                          </h3>

                          <p className="text-xs text-gray-500 max-w-xs">
                            {orgSearch
                              ? "Try adjusting your search keywords to find the right KRA."
                              : "Organizational KRAs will appear here once they are created."}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
            </div>
          )}

        {/* Templates Grid */}
        {showAssignedTemplates &&
          (searchFilteredTemplates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/70 shadow-[0_8px_22px_rgba(15,23,42,0.06)]"
            >
              {searchQuery ? (
                <>
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-medium mb-2">
                    No templates found
                  </p>
                  <p className="text-gray-500 text-sm">
                    Try adjusting your search query
                  </p>
                </>
              ) : (
                <>
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-medium mb-2">
                    No Templates Found
                  </p>
                  <p className="text-gray-500 text-sm">
                    {isPMS_HR(loggedInUser) && templateView === "employees"
                      ? "Create a new template to get started"
                      : "No templates have been assigned to you yet"}
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            <div className="space-y-6">
              {searchFilteredTemplates.map((temp, tIndex) => (
                <TemplateCard
                  key={temp.id}
                  remainingWeight={getRemainingKraWeight(temp)}
                  totalKraWeight={getTotalKraWeight(temp)}
                  temp={temp}
                  tIndex={tIndex}
                  loggedInUser={loggedInUser}
                  templateView={templateView}
                  selectedTemplates={selectedTemplates}
                  submittedTemplates={submittedTemplates}
                  setSubmittedTemplates={setSubmittedTemplates}
                  setSelectedTemplates={setSelectedTemplates}
                  canViewTemplate={canViewTemplate}
                  canRespondEffective={canRespondEffective}
                  getCycleById={getCycleById}
                  cycles={cycles}
                  openKRA={openKRA}
                  setOpenKRA={setOpenKRA}
                  openSavedKra={openSavedKra}
                  setOpenSavedKra={setOpenSavedKra}
                  kraResponses={kraResponses}
                  setKraResponses={setKraResponses}
                  kraRatings={kraRatings}
                  setKraRatings={setKraRatings}
                  extraKras={extraKras}
                  setExtraKras={setExtraKras}
                  draftKras={draftKras}
                  setDraftKras={setDraftKras}
                  kraWeightDrafts={kraWeightDrafts}
                  setKraWeightDrafts={setKraWeightDrafts}
                  kraErrors={kraErrors}
                  setKraErrors={setKraErrors}
                  kpiErrors={kpiErrors}
                  setKpiErrors={setKpiErrors}
                  kraResponseFiles={kraResponseFiles}
                  setKraResponseFiles={setKraResponseFiles}
                  validateKra={validateKra}
                  selectedManager={selectedManager}
                  setSelectedManager={setSelectedManager}
                  managerList={managerList}
                  getTemplateValidationErrors={getTemplateValidationErrors}
                  submitAll={sendForApproval}
                  submitSelfReview={submitSelfReview}
                  savedKraKeys={savedKraKeys}
                  setSavedKraKeys={setSavedKraKeys}
                  handleDeleteTemplate={handleDeleteTemplate}
                  navigate={navigate}
                  loadTemplates={loadTemplates}
                />
              ))}
            </div>
          ))}

        {/* Apply Template Button (HR only) */}
        {isPMS_HR(loggedInUser) &&
          templateView === "employees" &&
          selectedTemplates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed bottom-6 right-6 z-50"
            >
              <motion.button
                onClick={handleApplyTemplate}
                className="flex items-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Apply Template ({selectedTemplates.length})</span>
              </motion.button>
            </motion.div>
          )}
    </main>
  );
}
