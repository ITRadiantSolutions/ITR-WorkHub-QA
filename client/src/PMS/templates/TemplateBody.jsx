import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { confirmDialog } from "../../components/ConfirmDialog";

// This file's original fetch() calls sent no Authorization header (the old
// app served frontend+backend from one origin). Ours are separate origins
// behind a JWT, so every request needs the token attached.
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function TemplateBody({
  mode = "my",
  onWeightChange,
  temp,
  employeeId,
  canRespondEffective,
  openKRA,
  setOpenKRA,
  openSavedKra,
  setOpenSavedKra,
  kraResponses,
  employeeResponseEnabled,
  managerResponseEnabled,
  userRole,
  setKraResponses,
  kraRatings,
  setKraRatings,
  submittedTemplates,
  extraKras,
  setExtraKras,
  draftKras,
  setDraftKras,
  kraWeightDrafts,
  setKraWeightDrafts,
  kraErrors,
  setKraErrors,
  kpiErrors,
  setKpiErrors,
  kraStatuses,
  kraResponseFiles,
  validateKra
  ,
  selectedEmployeesForCycle = [],   // ← ADD
  selectedManagersForCycle = [],    // ← ADD
  savedKraKeys,        // ← ADD
  setSavedKraKeys,
}) {
  if (!temp?.id) {
    return null;
  }

  const newKraRef = useRef(null);
  const [actualValues, setActualValues] = useState({});



  const [editingKraId, setEditingKraId] = useState(null);
  const [actualErrors, setActualErrors] = useState({});
  const [employeeKraSubmissionStatus, setEmployeeKraSubmissionStatus] =
    useState(null);
  // 🔒 Lock UI once submitted to manager
  // 🔒 Lock UI once submitted to manager
  const isFinalSubmitted =
    employeeKraSubmissionStatus === "submitted" ||
    employeeKraSubmissionStatus === "employee_submitted" ||
    employeeKraSubmissionStatus === "final_employee_submitted" ||
    employeeKraSubmissionStatus === "manager_submitted" ||
    employeeKraSubmissionStatus === "final_manager_reviewed" ||
    // ✅ Also check submittedTemplates for immediate lock after submission
    submittedTemplates?.[temp.id]?.status === "final_employee_submitted" ||
    submittedTemplates?.[temp.id]?.status === "employee_submitted" ||
    submittedTemplates?.[temp.id]?.status === "manager_submitted" ||
    submittedTemplates?.[temp.id]?.status === "final_manager_reviewed" ||
    submittedTemplates?.[temp.id] === true;
  const [employeeKraStatuses, setEmployeeKraStatuses] = useState({});
  const isSubmitted = !!submittedTemplates[temp.id];




  // 1️⃣ HR weight (FIXED, untouchable)
  const isEditableKra = (kraId) => {
    const status =
      employeeKraStatuses?.[String(kraId)] ||
      kraStatuses?.[String(kraId)];

    // ❌ Permanently locked if approved
    if (status === "manager_approved") return false;

    // ✅ Allow editing only if rejected or modify
    if (status === "manager_rejected" || status === "manager_modify") {
      return true;
    }

    // ❌ Otherwise disabled
    return false;
  };
  // 1️⃣ HR KRAs (fixed)
  const hrWeight = (temp.kras || []).reduce(
    (sum, k) => sum + Number(k.weight || 0),
    0
  );

  const isFullyAssignedByHR = hrWeight === 100;
  const submission = submittedTemplates?.[temp.id];

  const isManagerApproved =
    submission?.status === "manager_approved" || isFullyAssignedByHR;





  // 2️⃣ Employee SAVED KRAs ONLY
  const employeeSavedWeight = (draftKras[temp.id] || []).reduce(
    (sum, k) => sum + Number(k.weight || 0),
    0
  );

  // 3️⃣ Remaining weight (single source of truth)
  const remainingEmployeeWeight = Math.max(
    0,
    100 - hrWeight - employeeSavedWeight
  );

  // 4️⃣ Used (display only)
  const totalUsedWeight = 100 - remainingEmployeeWeight;



  // Determine if a specific KRA's response/rating controls should be disabled,
  // combining the old per-KRA status rules with the new HR override flag.


  useEffect(() => {
    if (onWeightChange) {
      onWeightChange(temp.id, totalUsedWeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalUsedWeight, temp.id]);


  const isManagerResponseDisabledForKra = (kraId) => {
    const status = kraStatuses?.[String(kraId)];

    return (
      status &&
      status !== "manager_approved"
    );
  };



  const role = userRole?.toLowerCase();

  const normalizeId = (value) => {
    if (!value) return "";

    if (typeof value === "string") {
      return value;
    }

    return (
      value._id ||
      value.id ||
      String(value)
    );
  };

  const isUserSelected = (list = [], userId) => {

    const normalizedUserId =
      normalizeId(userId);

    return list.some((item) => {

      const itemId =
        normalizeId(item);

      return String(itemId) === String(normalizedUserId);

    });
  };

  // ✅ Fix — restore the selection guard
  const isSelectedForCycle =
    role === "employee"
      ? isUserSelected(
        selectedEmployeesForCycle,
        employeeId
      )
      : role === "manager"
        ? isUserSelected(
          selectedManagersForCycle,
          employeeId
        )
        : role === "hr"
          ? true
          : false;

  const canShowEmployeeSection = isSelectedForCycle; // ← AND isSelectedForCycle

  // ✅ And restore selection check inside canRespondForKra
  const canRespondForKra = (kraId) => {

    const kraLevelStatus =
      kraStatuses?.[String(kraId)];

    const kraApproved =
      !kraLevelStatus ||
      kraLevelStatus === "manager_approved";

    // EMPLOYEE
    if (role === "employee") {

      const isSelected =
        isUserSelected(
          selectedEmployeesForCycle,
          employeeId
        );

      return (
        employeeResponseEnabled === true &&
        kraApproved &&
        isSelected
      );
    }

    // MANAGER
    if (role === "manager") {

      const isSelected =
        isUserSelected(
          selectedManagersForCycle,
          employeeId
        );

      return (
        managerResponseEnabled === true &&
        kraApproved &&
        isSelected
      );
    }


    // HR
    if (role === "hr") {

      const isSelected =
        isUserSelected(
          selectedManagersForCycle,
          employeeId
        );

      return (
        managerResponseEnabled === true &&
        isSelected
      );
    }

    return false;
  };
  //console.log("-------------------------------------------", isFinalSubmitted);

  useEffect(() => {
    const loadEmployeeKras = async () => {
      if (!employeeId || !temp?.id) return;

      try {
        const API_BASE = import.meta.env.VITE_API_URL;

        const res = await fetch(
          `${API_BASE}/api/kra/by-template/${temp.id}/${employeeId}`,
          { headers: authHeaders() }
        );

        if (!res.ok) return;

        const data = await res.json();

        if (!data || !data.kras) return;


        setEmployeeKraSubmissionStatus(data.status || null);
        setEmployeeKraStatuses(data.kraStatuses || {});

        const employeeOnlyKras = (data.kras || []).filter(
          (k) => !k.kraId?.includes("-base-")
        );

        setDraftKras(prev => ({
          ...prev,
          [temp.id]: employeeOnlyKras.map(k => ({
            id: k.kraId,
            name: k.name,
            weight: k.weight,
            kpis: k.kpis || [],
            isEmployeeKra: true,
          }))
        }));

        if (data.responses) {
          const normalized = {};
          Object.entries(data.responses).forEach(([kraId, value]) => {
            normalized[`${temp.id}::${employeeId}::${kraId}`] = value;
          });
          setKraResponses(prev => ({ ...prev, ...normalized }));
        }
        // LOAD ACTUAL VALUES
        const actuals = {};

        (data.kras || []).forEach((kra, index) => {

          const currentKraId =
            kra.kraId ||
            kra._id ||
            kra.id ||
            `${temp.id}-base-${index}`;

          (kra.kpis || []).forEach((kpi, i) => {

            actuals[`${currentKraId}-${i}`] =
              kpi.actual || "";

          });
        });

        setActualValues(actuals);

        if (data.ratings) {
          const normalized = {};
          Object.entries(data.ratings).forEach(([kraId, value]) => {
            normalized[`${temp.id}::${employeeId}::${kraId}`] = value;
          });
          setKraRatings(prev => ({ ...prev, ...normalized }));
        }

      } catch (err) {
        console.error("Failed to load employee KRAs", err);
      }
    };

    loadEmployeeKras();

  }, [temp.id, employeeId]);

  useEffect(() => {
    const list = extraKras?.[temp.id] || [];
    if (list.length > 0) {
      setTimeout(() => {
        newKraRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [extraKras?.[temp.id]]);

  const saveDraftToBackend = async (updatedKras) => {
    if (!employeeId || !temp?.id) return;

    const responsesPayload = {};
    const ratingsPayload = {};


    temp.kras.forEach((kra, index) => {
      const kraId = kra._id || `${temp.id}-base-${index}`;
      responsesPayload[kraId] =
        kraResponses[getResponseKey(kraId)] || "";

      ratingsPayload[kraId] =
        kraRatings[getResponseKey(kraId)] || null;

    });

    updatedKras.forEach((kra) => {
      const kraId = kra.id; // employee KRA only
      responsesPayload[kraId] =
        kraResponses[getResponseKey(kraId)] || "";

      ratingsPayload[kraId] =
        kraRatings[getResponseKey(kraId)] || null;

    });



    const enrichedKras = updatedKras.map((kra) => {
      const kraId = kra.id;

      return {
        ...kra,

        kpis: (kra.kpis || []).map((kpi, i) => ({
          ...kpi,
          actual:
            actualValues[`${kraId}-${i}`] ??
            kpi.actual ??
            "",
        })),

        response: kraResponses[getResponseKey(kraId)] || "",
        rating: kraRatings[getResponseKey(kraId)] || null,
      };
    });


    // await fetch(`/api/kra/draft/${temp.id}/${employeeId}`, {
    const krasPayload = temp.kras.map((kra, index) => {
      const currentKraId =
        kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;

      return {
        ...kra,

        kpis: (kra.kpis || []).map((kpi, i) => ({
          ...kpi,
          actual:
            actualValues[`${currentKraId}-${i}`] ??
            kpi.actual ??
            "",
        })),
      };
    });

    await fetch(`/api/kra/draft`, {

      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        employeeId,
        templateId: temp.id,
        managerId: null,

        kras: enrichedKras,
        // include ALL KRA responses (HR + employee KRAs)
        responses: Object.fromEntries(
          Object.entries(responsesPayload).map(([id, value]) => [String(id), value])
        ),
        ratings: Object.fromEntries(
          Object.entries(ratingsPayload).map(([id, value]) => [String(id), value])
        ),
      }),
    });

  };



  //console.log("-", isSelectedForCycle);

  // Delete employee KRA KPI
  const handleDeleteSavedKra = async (kraId, index) => {
    const updated = draftKras[temp.id].filter((k) => k.id !== kraId);

    setDraftKras((prev) => ({
      ...prev,
      [temp.id]: updated,
    }));
    if (isFinalSubmitted) {
      toast.info("Self review already submitted. Editing is not allowed.");
      return;
    }

    await saveDraftToBackend(updated);

    if (openSavedKra === index) {
      setOpenSavedKra(null);
    }

    toast.success("Deleted");
  };
  const hasEmployeeDrafts = (draftKras[temp.id] || []).length > 0;
  const editingKra = (extraKras[temp.id] || []).find((k) => k.__editing);
  //   HR KRAs count ONLY if employee has NOT created KRAs
  const hasInvalidKpis = (kra, tempId, kraIdx) => {
    const totalKpiWeight = (kra.kpis || []).reduce(
      (sum, k) => sum + (Number.isFinite(+k.weight) ? +k.weight : 0),
      0
    );

    return (
      totalKpiWeight !== 100 ||
      (kra.kpis || []).some((kpi, kpiIdx) => {
        const key = `${tempId}-${kraIdx}-${kpiIdx}`;

        const title = kpi.title?.trim() || "";
        const weight = Number(kpi.weight);

        return (
          !title ||
          title.length < 1 ||
          !weight ||
          Number.isNaN(weight) ||
          weight <= 0 ||
          kpiErrors[key]?.title ||
          kpiErrors[key]?.weight
        );
      })
    );
  };
  const getMaxAllowedForKpi = (kra, currentIndex) => {
    const otherTotal = (kra.kpis || []).reduce(
      (sum, k, i) =>
        i === currentIndex ? sum : sum + (Number(k.weight) || 0),
      0
    );

    return Math.max(0, 100 - otherTotal);
  };
  const getResponseKey = (kraId) =>
    `${temp.id}::${employeeId}::${kraId}`;

  // Identify if a given KRA is employee-created (not HR base KRA)
  const isEmployeeKraId = (kraId) =>
    (draftKras[temp.id] || []).some(
      (k) => String(k.id || k.kraId) === String(kraId)
    );
  const addEmployeeKra = () => {
    setExtraKras((prev) => {
      const list = prev[temp.id] || [];

      // prevent multiple empty editors
      if (list.some((k) => !k.name)) return prev;

      return {
        ...prev,
        [temp.id]: [
          ...list,
          {
            id: crypto.randomUUID(),
            name: "",
            committedWeight: 0,
            draftWeight: "",
            kpis: [],
            isEmployeeKra: true,
            __editing: true,
            __originalWeight: 0,
          }
        ],
      };
    });
  };
  const allHrKrasFilled = (temp.kras || []).every((kra, kIndex) => {
    const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${kIndex}`;
    const response = kraResponses[getResponseKey(kraId)]?.trim();
    const rating = kraRatings[getResponseKey(kraId)];
    return response && rating && rating > 0;
  });

  const handleGlobalSave = async () => {
    if (!allHrKrasFilled) return;
    try {
      const responsesPayload = {};
      const ratingsPayload = {};

      temp.kras.forEach((kra, index) => {
        const currentKraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;
        responsesPayload[currentKraId] = kraResponses[getResponseKey(currentKraId)] || "";
        ratingsPayload[currentKraId] = kraRatings[getResponseKey(currentKraId)] || null;
      });

      const krasPayload = temp.kras.map((kra, index) => {
        const currentKraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;
        return {
          ...kra,
          kpis: (kra.kpis || []).map((kpi, i) => ({
            ...kpi,
            actual: actualValues[`${currentKraId}-${i}`] ?? kpi.actual ?? "",
          })),
          response: kraResponses[getResponseKey(currentKraId)] || "",
          rating: kraRatings[getResponseKey(currentKraId)] || null,
        };
      });

      await fetch(`/api/kra/draft`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          employeeId,
          templateId: temp.id,
          managerId: null,
          kras: krasPayload,
          responses: Object.fromEntries(
            Object.entries(responsesPayload).map(([id, v]) => [String(id), v])
          ),
          ratings: Object.fromEntries(
            Object.entries(ratingsPayload).map(([id, v]) => [String(id), v])
          ),
        }),
      });

      // mark all HR KRA keys as saved
      setSavedKraKeys(prev => {
        const next = new Set(prev);
        temp.kras.forEach((kra, index) => {
          const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;
          next.add(getResponseKey(kraId));
        });
        return next;
      });

      toast.success("All responses saved");
    } catch (err) {
      toast.error("Save Failed");
    }
  };

  return (
    <>
      {/* {temp.selected && ( */}
      <div className="mb-1 flex justify-between items-center text-sm font-semibold">
        <h1>KRA & KPI</h1>

        <div className="flex items-center gap-4">

          <div className="text-xs">
            Used KRA: {totalUsedWeight}%
            <span className="ml-1 text-orange-600">
              (Remaining: {remainingEmployeeWeight}%)
            </span>
          </div>

          {!isFinalSubmitted &&
            remainingEmployeeWeight > 0 &&
            !isFullyAssignedByHR && (
              <button
                onClick={addEmployeeKra}
                className="px-3 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                + Add KRA
                <span className="ml-1 text-[10px] opacity-80">
                  (Remaining {remainingEmployeeWeight}%)
                </span>
              </button>
            )}



        </div>
      </div>


      {temp.kras?.map((kra, kIndex) => {
        if (!Array.isArray(temp.kras)) {
          console.error("INVALID TEMPLATE DATA", temp);
          return (
            <div className="p-4 text-sm text-red-600">
              ⚠️ Template data is invalid (KRAs missing)
            </div>
          );
        }
        const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${kIndex}`;
        const managerResponseDisabled = isManagerResponseDisabledForKra(kraId);
        const canRespond = canRespondForKra(kraId);
        //console.log({
        //  role,
        //  employeeId,
        //  selectedEmployeesForCycle,
        //  selectedManagersForCycle,
        //  canRespond,
        //});
        const isEmployeeKra = isEmployeeKraId(kraId);
        //console.log("------------------------------------------")
        //console.log( canShowEmployeeSection ,isEmployeeKra ,isManagerApproved,temp)

        return (
          <div
            key={kraId}
            className="rounded-xl mb-2 "
          >
            {/* Manager Employee only see  */}

            <button
              onClick={() =>
                setOpenKRA((prev) => ({
                  ...prev,
                  [temp.id]: prev[temp.id] === kraId ? null : kraId,
                }))
              }
              className="w-full flex justify-between items-center px-3 py-2"
            >
              <span className="font-semibold text-violet-800 wrap-anywhere flex items-center gap-2">
                <span className="text-gray-500 font-semibold">{kIndex + 1}.</span>
                {kra.name} ({kra.weight}%)

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
      ${kra.type === "functional"
                      ? "bg-violet-100 text-violet-600"
                      : "bg-purple-100 text-purple-600"
                    }`}
                >
                  {kra.type === "functional" ? "Job Specified" : "Organizational"}
                </span>
              </span>
              {temp.selected &&
                canShowEmployeeSection &&
                kraStatuses?.[kraId] === "manager_approved" && (


                  <span className="text-xs font-semibold text-green-700">
                    Cycle: {(temp.selectedQuarters || []).join(", ")}
                  </span>
                )}
            </button>

            <div className="p-4 shadow-[inset_0_1px_0_rgba(226,232,240,0.9)] bg-gradient-to-b from-gray-50 to-white">
              {/* KPIs (optional) */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">
                    KPI
                  </span>
                  <p className="text-sm font-semibold text-gray-700">
                    Key Performance Indicators
                  </p>
                </div>
                {kra.kpis?.length > 0 && (
                  <span className="text-xs font-medium text-gray-500">
                    Total Weight:&nbsp;
                    <span className="text-gray-800">
                      {(kra.kpis || []).reduce(
                        (s, k) =>
                          s +
                          (Number.isFinite(Number(k.weight))
                            ? Number(k.weight)
                            : 0),
                        0
                      )}
                      % / 100%
                    </span>
                  </span>
                )}
              </div>

              {kra.kpis?.length > 0 && (
                <div className="space-y-2 mb-4">
                  {(kra.kpis || []).map((kpi, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-3 rounded-xl ring-1 ring-slate-200/70 shadow-[0_8px_22px_rgba(15,23,42,0.06)] bg-white/80 px-3 py-2 hover:border-violet-200 hover:shadow-md transition-all"
                    >
                      {/* KPI NAME - takes all remaining space */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_0_0_2px_rgba(248,113,113,0.35)] flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 break-words leading-relaxed">
                          {kpi.name || kpi.title}
                        </span>
                      </div>

                      {/* TARGET - fixed width column */}
                      <div className="flex flex-col items-center shrink-0 w-20">
                        <span className="text-[10px] text-gray-400 mb-0.5">Target</span>
                        <div className="w-full h-7 flex items-center justify-center text-xs font-semibold rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                          {kpi.target ?? "—"}
                        </div>
                      </div>

                      {/* ACTUAL - editable */}
                      <div className="flex flex-col items-center shrink-0 w-28">
                        <span className="text-[10px] text-gray-400 mb-0.5">Actual</span>

                        <input
                          type="text"
                          value={actualValues[`${kraId}-${i}`] ?? kpi.actual ?? ""}
                          placeholder={
                            kpi.target === undefined ||
                              kpi.target === null ||
                              kpi.target === ""
                              ? "Assign target first"
                              : "Actual"
                          }
                          readOnly={
                            !canRespond ||
                            isFinalSubmitted ||
                            kpi.target === undefined ||
                            kpi.target === null ||
                            kpi.target === ""
                          }

                          disabled={
                            !canRespond ||
                            isFinalSubmitted ||
                            kpi.target === undefined ||
                            kpi.target === null ||
                            kpi.target === ""
                          }
                          onChange={(e) => {
                            if (!canRespond) return;
                            const raw = e.target.value;
                            const errorKey = `${kraId}-${i}`;
                            const target = kpi.target;

                            // ── Helper: pull first number out of any string ───────────
                            const extractNumber = (val) => {
                              if (val === undefined || val === null || val === "") return null;
                              const pure = Number(val);
                              if (!isNaN(pure) && String(val).trim() !== "") return pure;
                              const match = String(val).match(/(\d+(\.\d+)?)/);
                              return match ? Number(match[1]) : null;
                            };

                            const isPureNumericTarget =
                              target !== undefined &&
                              target !== null &&
                              target !== "" &&
                              !isNaN(Number(target)) &&
                              String(target).trim() !== "";

                            const targetNum = extractNumber(target); // works for "50 tickets" → 50

                            // Allow clearing
                            if (raw === "") {
                              setActualErrors(prev => ({ ...prev, [errorKey]: "" }));
                              setActualValues(prev => ({ ...prev, [`${kraId}-${i}`]: "" }));
                              kpi.actual = "";
                              return;
                            }

                            if (isPureNumericTarget) {
                              // ── Numeric target: only digits, must be ≤ target ────────
                              if (isNaN(Number(raw))) return; // silently block letters

                              const numVal = Number(raw);
                              if (numVal < 0) {
                                setActualErrors(prev => ({
                                  ...prev, [errorKey]: "Actual value cannot be negative",
                                }));
                                return;
                              }
                              if (numVal > Number(target)) {
                                setActualErrors(prev => ({
                                  ...prev, [errorKey]: `Must be ≤ target (${target})`,
                                }));
                                return; // block
                              }
                              setActualErrors(prev => ({ ...prev, [errorKey]: "" }));

                            } else if (targetNum !== null) {
                              // ── Mixed target (e.g. "50 tickets"): allow text but      
                              //    the NUMERIC portion of actual must be ≤ targetNum ───
                              const actualNum = extractNumber(raw);
                              if (actualNum !== null && actualNum > targetNum) {
                                setActualErrors(prev => ({
                                  ...prev,
                                  [errorKey]: `Numeric value must be ≤ ${targetNum} (target: ${target})`,
                                }));
                                return; // block
                              }
                              setActualErrors(prev => ({ ...prev, [errorKey]: "" }));

                            } else {
                              // ── No numeric component in target: allow any text ───────
                              setActualErrors(prev => ({ ...prev, [errorKey]: "" }));
                            }

                            // Commit valid value
                            setActualValues(prev => ({ ...prev, [`${kraId}-${i}`]: raw }));
                            kpi.actual = raw;
                          }}

                          onBlur={async () => {
                            if (!canRespond || isFinalSubmitted) return;

                            const errorKey = `${kraId}-${i}`;
                            const raw = actualValues[`${kraId}-${i}`] ?? "";
                            const target = kpi.target;

                            const extractNumber = (val) => {
                              if (val === undefined || val === null || val === "") return null;
                              const pure = Number(val);
                              if (!isNaN(pure) && String(val).trim() !== "") return pure;
                              const match = String(val).match(/(\d+(\.\d+)?)/);
                              return match ? Number(match[1]) : null;
                            };

                            const isPureNumericTarget =
                              target !== undefined && target !== null && target !== "" &&
                              !isNaN(Number(target)) && String(target).trim() !== "";

                            const targetNum = extractNumber(target);

                            if (raw !== "") {
                              if (isPureNumericTarget) {
                                const numVal = Number(raw);
                                if (isNaN(numVal)) {
                                  setActualErrors(prev => ({ ...prev, [errorKey]: "Enter a valid number" }));
                                  return;
                                }
                                if (numVal < 0) {
                                  setActualErrors(prev => ({ ...prev, [errorKey]: "Cannot be negative" }));
                                  return;
                                }
                                if (numVal > Number(target)) {
                                  setActualErrors(prev => ({ ...prev, [errorKey]: `Must be ≤ target (${target})` }));
                                  return;
                                }
                              } else if (targetNum !== null) {
                                const actualNum = extractNumber(raw);
                                if (actualNum !== null && actualNum > targetNum) {
                                  setActualErrors(prev => ({
                                    ...prev,
                                    [errorKey]: `Numeric value must be ≤ ${targetNum} (target: ${target})`,
                                  }));
                                  return;
                                }
                              }
                            }

                            if (actualErrors[errorKey]) return;

                            try {
                              const API_BASE = import.meta.env.VITE_API_URL;
                              await fetch(`${API_BASE}/api/kra/save-actual`, {
                                method: "PATCH",
                                headers: authHeaders(),
                                body: JSON.stringify({ templateId: temp.id, employeeId, kraId, kpiIndex: i, actual: raw }),
                              });
                            } catch (err) {
                              console.error("Failed to save actual", err);
                            }
                          }}
                          className={`
      w-full h-8 px-2 text-xs font-semibold rounded-md border
      focus:outline-none focus:ring-1
      ${actualErrors[`${kraId}-${i}`]
                              ? "bg-red-50 text-red-700 border-red-300 focus:ring-red-400"
                              : (
                                !canRespond ||
                                isFinalSubmitted ||
                                kpi.target === undefined ||
                                kpi.target === null ||
                                kpi.target === ""
                              )
                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-70"
                                : "bg-green-50 text-green-700 border-green-200 focus:ring-green-400"
                            }
    `}
                        />
                        {/* ✅ Validation error message */}
                        {actualErrors[`${kraId}-${i}`] && (
                          <p className="text-[10px] text-red-500 mt-0.5 text-center leading-tight">
                            {actualErrors[`${kraId}-${i}`]}
                          </p>
                        )}
                      </div>

                      {/* WEIGHT - fixed width */}
                      <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600 transition-colors">
                        {kpi.weight}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {canShowEmployeeSection &&
                (!isEmployeeKra || isManagerApproved) && (

                  <div className="flex flex-col lg:flex-row gap-8 p-4 mt-2 rounded-lg border border-violet-200 bg-violet-50">

                    {/* ================= RESPONSE ================= */}
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Your Response <span className="text-red-500">*</span>
                      </label>

                      <textarea
                        rows={3}
                        value={kraResponses[getResponseKey(kraId)] || ""}
                        readOnly={!canRespond || isFinalSubmitted}
                        disabled={!canRespond || isFinalSubmitted}
                        onChange={(e) => {
                          if (!canRespond || isFinalSubmitted) return;
                          setKraResponses(prev => ({
                            ...prev,
                            [getResponseKey(kraId)]: e.target.value,
                          }));
                          setSavedKraKeys(prev => {
                            const next = new Set(prev);
                            next.delete(getResponseKey(kraId));
                            return next;
                          });
                        }}
                        className={`
  w-full rounded-lg border px-3 py-2 text-sm resize-none
  focus:outline-none focus:ring-2 focus:ring-violet-500
  ${(!canRespond || isFinalSubmitted) ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"}
`}
                        placeholder={`Write your performance for ${kra.name}`}
                      />
                    </div>

                    {/* ================= RATING ================= */}
                    <div className="flex flex-col justify-start min-w-[180px] pl-6 border-l border-violet-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        Self Rating <span className="text-red-500">*</span>
                      </p>

                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active =
                            (kraRatings[getResponseKey(kraId)] || 0) >= star;

                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={!canRespond || isFinalSubmitted}
                              onClick={() => {
                                if (!canRespond || isFinalSubmitted) return;
                                setKraRatings(prev => ({ ...prev, [getResponseKey(kraId)]: star }));
                                setSavedKraKeys(prev => {
                                  const next = new Set(prev);
                                  next.delete(getResponseKey(kraId));
                                  return next;
                                });
                              }}
                              className={`transition transform ${(!canRespond || isFinalSubmitted) ? "cursor-not-allowed opacity-60" : "hover:scale-110"}`}
                            >
                              <span
                                className={`text-3xl ${active
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                                  }`}
                              >
                                ★
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <span className="text-xs text-gray-500 mt-1">
                        {(kraRatings[getResponseKey(kraId)] || 0)}/5
                      </span>
                    </div>

                  </div>

                )}


            </div>


          </div>
        );
      })}
      {/* ── Global Save All button ── */}
      {canShowEmployeeSection && !isFinalSubmitted && (temp.kras || []).length > 0 && (
        <div className="flex items-center justify-end gap-3 mt-2 mb-3 px-1">
          {!allHrKrasFilled && (
            <p className="text-xs text-orange-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block shrink-0" />
              Fill all KRA responses and ratings to enable save
            </p>
          )}
          {allHrKrasFilled && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shrink-0" />
              All KRAs filled — ready to save
            </p>
          )}
          <button
            onClick={handleGlobalSave}
            disabled={!allHrKrasFilled}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors
              ${allHrKrasFilled
                ? "bg-violet-600 hover:bg-violet-700"
                : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            Save All
          </button>
        </div>
      )}

      {
        // canRespondEffective &&
        //   temp.selected &&
        !isFullyAssignedByHR &&
        (draftKras[temp.id] || []).length > 0 &&
        (
          <div className="mt-0">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">
              Employee Saved KRAs
            </h3>


            {(draftKras[temp.id] || [])
              // .filter(kra => !kra._id)
              .map((kra, index) => {
                const kraId = kra.id;
                const managerResponseDisabled = isManagerResponseDisabledForKra(kraId);
                const kraApprovalStatus =
                  employeeKraStatuses?.[String(kraId)] || null;
                const isApprovedForEmployeeKra =
                  kraApprovalStatus === "manager_approved";
                const canRespond =
                  canRespondForKra(kraId) && isApprovedForEmployeeKra;
                // console.log("---", kra.name, canRespond);


                return (
                  <div
                    key={kraId}
                    className="border  border-slate-200 rounded-xl mb-2  shadow-sm"
                  >
                    {/* HEADER */}
                    <div className="flex justify-between items-center px-2 py-2">
                      <button
                        onClick={() =>
                          setOpenSavedKra(
                            openSavedKra === index ? null : index
                          )
                        }
                        className="text-left flex-1"
                      >
                        <p className="text-sm font-semibold text-violet-800">
                          {kra.name} ({kra.weight}%)
                        </p>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setOpenSavedKra(
                              openSavedKra === index ? null : index
                            )
                          }
                          className="text-gray-600 mt-2 hover:text-violet-600 transition"
                        >
                          {openSavedKra === index ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </button>
                        {isEditableKra(kraId) && (
                          <>
                            {/* edit */}
                            <button
                              onClick={() => {
                                const clonedKra = {
                                  ...kra,
                                  kpis: kra.kpis.map((k) => ({ ...k })),
                                  __editing: true,
                                  __originalWeight: kra.weight,
                                };

                                setEditingKraId(kra.id);

                                // move into editor
                                setExtraKras((prev) => ({
                                  ...prev,
                                  [temp.id]: [
                                    ...(prev[temp.id] || []),
                                    clonedKra,
                                  ],
                                }));

                                // remove from saved drafts
                                setDraftKras((prev) => ({
                                  ...prev,
                                  [temp.id]: prev[temp.id].filter(
                                    (k) => k.id !== kra.id
                                  ),
                                }));
                              }}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path d="M16.862 3.487a2.25 2.25 0 013.182 3.182L7.5 19.212 3 21l1.788-4.5L16.862 3.487z" />
                              </svg>
                            </button>
                            {/* delete  */}

                            <button
                              onClick={async () => {
                                const confirmed = await confirmDialog({
                                  title: "Delete KRA?",
                                  text: "This action cannot be undone.",
                                  confirmText: "Yes, delete it",
                                  danger: true,
                                });
                                if (confirmed) {
                                  handleDeleteSavedKra(kraId, index);
                                }
                              }}
                              title="Delete KRA"
                              className="p-2 rounded-md text-red-600 hover:bg-red-50 transition"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6v12" />
                                <path d="M16 6v12" />
                                <path d="M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14" />
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* BODY */}
                    {openSavedKra === index && (
                      <div className="px-5 py-3  border-t border-slate-200 space-y-4">
                        {/* KPI LIST */}
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Key Performance Indicators
                          </p>

                          <div className="space-y-2">
                            {(kra.kpis || []).map((kpi, i) => (
                              <div
                                key={i}
                                className="
                                      group flex items-center justify-between
                                      px-2 py-1
                                      rounded-xl
                                      bg-gradient-to-br from-[#fdfdfe] to-[#f2f2f7]
                                      ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)]
                                      shadow-[0_1px_0_rgba(255,255,255,8),0_6px_12px_rgba(10,0,1 ,0.08)]
                                  
                                    "
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="
                 w-2 h-2 rounded-full
                 bg-gradient-to-br from-red-500 to-red-700
                 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_4px_rgba(0,0,0,0.4)]
                 flex-shrink-0
               "
                                  />
                                  <span className="text-sm font-medium text-gray-800">
                                    {kpi.title}
                                  </span>
                                </div>
                                <span
                                  className="
               text-xs font-semibold
               px-2 py-1
               rounded-lg
               bg-white/80
               text-gray-700
               shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.12)]
               ring-1 ring-slate-200/70 shadow-[0_8px_22px_rgba(15,23,42,0.06)]
               group-hover:scale-[1.03]
               transition
             "
                                >
                                  {kpi.weight}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {isApprovedForEmployeeKra && (
                          <div className="flex flex-col md:flex-row gap-4 p-3  ring-1 ring-slate-200/70 shadow-[0_8px_22px_rgba(15,23,42,0.06)] rounded-xl">
                            {/* RESPONSE */}
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-600">
                                Your Response{" "}
                                <span className="text-red-500">*</span>
                              </label>

                              <textarea
                                value={kraResponses[getResponseKey(kraId)] || ""}
                                readOnly={!canRespond || isFinalSubmitted}
                                disabled={!canRespond || isFinalSubmitted}
                                onChange={(e) => {
                                  if (!canRespond) return;
                                  setKraResponses((prev) => ({
                                    ...prev,
                                    [getResponseKey(kraId)]: e.target.value,
                                  }));

                                }}
                                className={`w-full min-h-[45px] border rounded-lg px-2 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-violet-500
    ${!canRespond

                                    ? "bg-gray-100 opacity-60 cursor-not-allowed"
                                    : "bg-white"}
  `}
                                placeholder={`Write your response for ${kra.name}`}
                              />



                            </div>

                            {/* RATING */}
                            <div className="flex flex-col justify-center items-start md:items-center min-w-[120px]">
                              <p className="text-xs font-semibold text-gray-600">
                                Self Rating<span className="text-red-500">*</span>
                              </p>

                              <div className="flex gap-2 mb-6">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    disabled={!canRespond}
                                    onClick={() => {
                                      if (!canRespond) return; // ✅ guard stays correct

                                      setKraRatings((prev) => ({
                                        ...prev,
                                        [getResponseKey(kraId)]: star,
                                      }));
                                    }}
                                    className={`flex flex-col items-center ${!canRespond
                                      ? "cursor-not-allowed opacity-60"
                                      : "cursor-pointer"
                                      }`}
                                  >
                                    <span
                                      className={`text-3xl ${(kraRatings[getResponseKey(kraId)] || 0) >= star
                                        ? "text-yellow-400"
                                        : "text-gray-400"
                                        }`}
                                    >
                                      ★
                                    </span>
                                    <span className="text-[10px] text-gray-500">{star}</span>
                                  </button>
                                ))}
                              </div>
                            </div>


                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      {mode === "my" && (
        <>
          {(extraKras[temp.id] || []).map((kra, idx) => {
            const kraNameValid = kra.name?.trim().length > 0;

            const kraWeightValue =
              kraWeightDrafts[`${temp.id}-${idx}`] ?? kra.weight;

            const currentDraft = Number(kraWeightDrafts[`${temp.id}-${idx}`]) || 0;

            const maxAllowedForThisKra =
              remainingEmployeeWeight + currentDraft;

            const kraWeightValid =
              Number(kraWeightValue) > 0 &&
              Number(kraWeightValue) <= maxAllowedForThisKra;

            const isKraValid = kraNameValid && kraWeightValid;
            const totalKpiWeight = (kra.kpis || []).reduce(
              (sum, k) => sum + (Number.isFinite(+k.weight) ? +k.weight : 0),
              0
            );

            const remainingKpi = Math.max(0, 100 - totalKpiWeight);

            const finalKraWeight =
              kraWeightDrafts[`${temp.id}-${idx}`] ?? kra.weight;

            const canSaveKra =
              kra.name?.trim().length > 0 &&
              Number(finalKraWeight) > 0 &&
              totalKpiWeight === 100;


            return (
              <div
                ref={
                  idx === (extraKras[temp.id]?.length - 1)
                    ? newKraRef
                    : null
                }
                key={kra.id || `${temp.id}-extra-${idx}`}
                className=" rounded-2xl ring-1 ring-slate-200/70 shadow-[0_8px_22px_rgba(15,23,42,0.06)] shadow-sm p-5 mb-6"
              >
                <div className="mb-2 flex gap-5">
                  {/* KRA NAME */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={kra.name || ""}
                      onChange={(e) => {
                        const updated = [...extraKras[temp.id]];
                        updated[idx].name = e.target.value;
                        setExtraKras({
                          ...extraKras,
                          [temp.id]: updated,
                        });

                        // clear error
                        setKraErrors((prev) => ({
                          ...prev,
                          [`${temp.id}-${idx}`]: {
                            ...prev[`${temp.id}-${idx}`],
                            name: "",
                          },
                        }));
                      }}
                      onBlur={() => {
                        const weight =
                          kraWeightDrafts[`${temp.id}-${idx}`] ?? kra.weight;

                        const errors = validateKra(temp.id, idx, kra, weight);
                        const hasIncompleteSelfReview = (temp?.kras || []).some((k) => {
                          const response = kraResponses?.[`${temp.id}::${employeeId}::${k._id || k.id}`];
                          const rating = kraRatings?.[`${temp.id}::${employeeId}::${k._id || k.id}`];

                          return !response?.trim() || !rating;
                        });

                        setKraErrors((prev) => ({
                          ...prev,
                          [`${temp.id}-${idx}`]: errors,
                        }));
                      }}
                      className={`w-full h-10 rounded-lg ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)] pl-6 text-sm focus:outline-none focus:ring-2 ${kraErrors[`${temp.id}-${idx}`]?.name
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 focus:ring-violet-500"
                        }`}
                      placeholder="Add KRA Name"
                    />

                    {kraErrors[`${temp.id}-${idx}`]?.name && (
                      <p className="mt-1 text-xs text-red-600">
                        {kraErrors[`${temp.id}-${idx}`].name}
                      </p>
                    )}
                  </div>

                  {/* KRA WEIGHT */}
                  <div className="w-48">
                    <input
                      type="number"
                      value={
                        kraWeightDrafts[`${temp.id}-${idx}`] ?? kra.weight
                      }
                      onChange={(e) => {
                        const raw = e.target.value;

                        // allow empty (user typing)
                        if (raw === "") {
                          setKraWeightDrafts((prev) => ({
                            ...prev,
                            [`${temp.id}-${idx}`]: "",
                          }));
                          return;
                        }

                        const value = Number(raw);

                        if (Number.isNaN(value)) return;

                        const currentDraft =
                          Number(kraWeightDrafts[`${temp.id}-${idx}`]) || 0;

                        const maxAllowedForThisKra =
                          remainingEmployeeWeight + currentDraft;

                        if (value > maxAllowedForThisKra) {
                          setKraErrors((prev) => ({
                            ...prev,
                            [`${temp.id}-${idx}`]: {
                              ...prev[`${temp.id}-${idx}`],
                              weight: `Maximum allowed is ${maxAllowedForThisKra}%`,
                            },
                          }));
                          return;
                        }

                        setKraWeightDrafts((prev) => ({
                          ...prev,
                          [`${temp.id}-${idx}`]: value,
                        }));

                        setKraErrors((prev) => ({
                          ...prev,
                          [`${temp.id}-${idx}`]: {
                            ...prev[`${temp.id}-${idx}`],
                            weight: "",
                          },
                        }));
                      }}
                      onBlur={() => {
                        const raw = kraWeightDrafts[`${temp.id}-${idx}`];
                        const value = Number(raw || 0);

                        let error = "";

                        if (!value) error = "KRA weight is required";
                        else if (value > remainingEmployeeWeight)
                          error = `Maximum allowed is ${remainingEmployeeWeight}%`;

                        setKraErrors((prev) => ({
                          ...prev,
                          [`${temp.id}-${idx}`]: {
                            ...prev[`${temp.id}-${idx}`],
                            weight: error,
                          },
                        }));

                        if (error || value > remainingEmployeeWeight) return;

                        const updated = [...extraKras[temp.id]];
                        updated[idx].weight = value;

                        setExtraKras({
                          ...extraKras,
                          [temp.id]: updated,
                        });

                        setKraWeightDrafts((prev) => {
                          const copy = { ...prev };
                          delete copy[`${temp.id}-${idx}`];
                          return copy;
                        });
                      }}
                      className={`w-full h-10 rounded-lg ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${kraErrors[`${temp.id}-${idx}`]?.weight
                        ? "border-red-500 focus:ring-red-500"
                        : "  border-slate-200  focus:ring-violet-500"
                        }`}
                      placeholder={`KRA Weight (≤ ${remainingEmployeeWeight}%)`}
                    />

                    {kraErrors[`${temp.id}-${idx}`]?.weight && (
                      <p className="mt-1 text-xs text-red-600">
                        {kraErrors[`${temp.id}-${idx}`].weight}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  {/* <span>Total KPI Weight: {totalKpiWeight}%</span> */}
                  <span
                    className={`font-semibold text-xs ${remainingKpi === 0
                      ? "text-green-600"
                      : "text-orange-500"
                      }`}
                  >
                    Remaining: {remainingKpi}%
                  </span>
                </div>

                {/* KPI SECTION */}
                <div className="p-1 space-y-2">
                  {/* ADD KPI BUTTON */}
                  <div className="flex justify-end">
                    <button
                      disabled={
                        !kraNameValid ||
                        Number(kra.weight) <= 0 ||
                        remainingKpi <= 0
                      }
                      onClick={() => {
                        const updated = [...extraKras[temp.id]];
                        updated[idx].kpis.push({
                          title: "",
                          weight: "",
                        });
                        setExtraKras({
                          ...extraKras,
                          [temp.id]: updated,
                        });
                      }}
                      className={`text-xs font-medium px-2 py-1 rounded-sm transition ${Math.round(totalKpiWeight) === 100
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-violet-600 text-white hover:bg-violet-700"
                        }`}
                    >
                      + Add KPI
                    </button>
                  </div>
                  {/* KPI LIST */}
                  {(extraKras[temp.id]?.[idx]?.kpis || []).map(
                    (kpi, kpiIdx) => {
                      const key = `${temp.id}-${idx}-${kpiIdx}`;
                      const draftWeight = kpi.weight;

                      const error = kpiErrors[key] || {};
                      return (
                        <div
                          key={kpiIdx}
                          className="flex items-start gap-2  ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)] rounded-lg px-3 py-2"
                        >
                          {/* KPI TITLE */}
                          <div className="flex-1   ">
                            <input
                              value={kpi.title}
                              placeholder="KPI description"
                              onChange={(e) => {
                                const value = e.target.value;

                                const updated = [...extraKras[temp.id]];
                                updated[idx].kpis[kpiIdx].title = value;
                                setExtraKras({
                                  ...extraKras,
                                  [temp.id]: updated,
                                });

                                // clear error ONLY if valid
                                if (value.trim().length >= 5) {
                                  setKpiErrors((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], title: "" },
                                  }));
                                }
                              }}
                              onBlur={() => {
                                const value = kpi.title?.trim() || "";

                                let errorMsg = "";

                                if (!value) {
                                  errorMsg = "KPI description is required";
                                }
                                else if (value.length < 0) {
                                  errorMsg = "Minimum 5 characters required";
                                }

                                setKpiErrors((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    title: errorMsg,
                                  },
                                }));
                              }}
                              className={`w-full text-xs px-4 py-2 rounded-md
    ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)] focus:outline-none
    ${error.title
                                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                                  : "border-slate-200 focus:ring-1 focus:ring-violet-500"
                                }
  `}
                            />


                            {error.title && (
                              <p className="text-[11px] text-red-600 mt-0.5">
                                {error.title}
                              </p>
                            )}
                          </div>


                          {/* KPI WEIGHT */}
                          <div className="w-45">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={`KPI Weight`}
                              value={kpi.weight ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;

                                // allow empty while editing
                                if (raw === "") {
                                  // 1️⃣ rollback committed weight
                                  const updated = [...extraKras[temp.id]];
                                  updated[idx].__uncommitted = true;


                                  setExtraKras({
                                    ...extraKras,
                                    [temp.id]: updated,
                                  });

                                  // 2️⃣ keep draft empty for typing
                                  setKraWeightDrafts((prev) => ({
                                    ...prev,
                                    [`${temp.id}-${idx}`]: "",
                                  }));

                                  // 3️⃣ clear error
                                  setKraErrors((prev) => ({
                                    ...prev,
                                    [`${temp.id}-${idx}`]: {
                                      ...prev[`${temp.id}-${idx}`],
                                      weight: "",
                                    },
                                  }));

                                  return;
                                }

                                // allow only numbers
                                if (!/^\d+$/.test(raw)) return;

                                const value = Number(raw);
                                const maxAllowed = getMaxAllowedForKpi(kra, kpiIdx);

                                const updated = [...extraKras[temp.id]];
                                updated[idx].kpis[kpiIdx].weight = value;
                                setExtraKras({ ...extraKras, [temp.id]: updated });

                                // validate but DO NOT block typing
                                setKpiErrors((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    weight:
                                      value > maxAllowed
                                        ? `Max allowed is ${maxAllowed}%`
                                        : "",
                                  },
                                }));
                              }}
                              onBlur={() => {
                                const value = Number(kpi.weight);
                                const maxAllowed = getMaxAllowedForKpi(kra, kpiIdx);

                                let errorMsg = "";

                                if (kpi.weight === "" || Number.isNaN(value)) {
                                  errorMsg = "Required";
                                } else if (value <= 0) {
                                  errorMsg = "Must be greater than 0";
                                } else if (value > maxAllowed) {
                                  errorMsg = `Max allowed is ${maxAllowed}%`;
                                }

                                setKpiErrors((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    weight: errorMsg,
                                  },
                                }));
                              }}
                              className={`w-full text-gray-800 text-xs px-5 py-2 rounded-md
      ring-1 ring-slate-200/70 shadow-[0_6px_18px_rgba(15,23,42,0.05)]  text-right focus:outline-none
      ${error.weight
                                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                                  : "border-slate-200 focus:ring-1 focus:ring-violet-500"
                                }
    `}
                            />

                            {error.weight && (
                              <p className="text-[11px] text-red-600 mt-0.5 text-right">
                                {error.weight}
                              </p>
                            )}
                          </div>


                        </div>
                      );
                    }
                  )}
                </div>


                {/* SAVE BUTTON */}
                <div className="flex justify-end">
                  <button
                    disabled={!canSaveKra || hasInvalidKpis(kra, temp.id, idx)}
                    onClick={async () => {
                      const finalWeight =
                        kraWeightDrafts[`${temp.id}-${idx}`] ?? kra.weight;

                      const committedKra = {
                        id: kra.id,
                        name: kra.name,
                        weight: Number(finalWeight),
                        kpis: kra.kpis.map((k) => ({
                          title: k.title,
                          weight: Number(k.weight),
                        })),
                        isEmployeeKra: true,
                      };

                      const currentList = draftKras[temp.id] || [];

                      const updatedList = currentList.some(
                        (k) => k.id === committedKra.id
                      )
                        ? currentList.map((k) =>
                          k.id === committedKra.id ? committedKra : k
                        )
                        : [...currentList, committedKra];

                      setDraftKras((prev) => ({
                        ...prev,
                        [temp.id]: updatedList,
                      }));

                      setExtraKras((prev) => ({
                        ...prev,
                        [temp.id]: prev[temp.id].filter(
                          (k) => k.id !== committedKra.id
                        ),
                      }));

                      setKraWeightDrafts((prev) => {
                        const copy = { ...prev };
                        delete copy[`${temp.id}-${idx}`];
                        return copy;
                      });

                      await saveDraftToBackend(updatedList);
                    }}
                    className={`rounded-sm p-2 py-1 text-xs font-semibold text-white
      ${canSaveKra && !hasInvalidKpis(kra, temp.id, idx)
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-300 cursor-not-allowed"
                      }
    `}
                  >
                    Save KRA
                  </button>
                </div>

              </div>
            );
          })}
        </>
      )}
      {canRespondEffective &&
        temp.selected &&
        remainingEmployeeWeight > 0 &&
        !isFullyAssignedByHR
        && (
          <div className="flex justify-end mb-1">
            <button
              onClick={() => {
                setExtraKras((prev) => {
                  const list = prev[temp.id] || [];

                  if (list.some((k) => !k.name)) return prev;

                  return {
                    ...prev,
                    [temp.id]: [
                      ...list,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        committedWeight: 0,
                        draftWeight: "",
                        kpis: [],
                        isEmployeeKra: true,
                        __editing: true,
                        __originalWeight: 0,
                      }

                    ],
                  };
                });
              }}
              className=" px-2 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg shadow hover:bg-violet-700"
            >
              ➕ Add KRA{" "}
              <span className="ml-1 opacity-80">
                (Remaining {remainingEmployeeWeight}%)
              </span>
            </button>
          </div>
        )}
    </>
  );
}
