import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { API } from "../services/api";
import { importTasks } from "../services/api";
import { toast } from "sonner";
import Icons from "./Icons";



const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

const TEMPLATE_HEADERS = [
  "Task Title",
  "Description",
  "Assignees",
  "Priority",
  "Status",
  "Created Date",
  "Due Date",
];

const SAMPLE_ROW = {
  "Task Title": "Implement login API",
  Description: "Create REST endpoint for user authentication",
  Assignees: "dev1@company.com, dev2@company.com",
  Priority: "High",
  Status: "TODO",
  "Created Date": "2025-12-01",
  "Due Date": "2025-12-31",
};

const VALID_PRIORITIES = ["Low", "Medium", "High"];
const VALID_STATUSES = ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"];

export default function ImportTasksModal({
  isOpen,
  onClose,
  projects,
  onImportSuccess,
}) {
  const [projectId, setProjectId] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setProjectId("");
    setDefaultAssigneeId("");
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/users");
      const valid = (res.data || []).filter(
        (u) => u.role !== "ADMIN" && u.role !== "PM",
      );
      setEmployees(valid);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], {
      header: TEMPLATE_HEADERS,
    });

    // Adjust column widths
    ws["!cols"] = [
      { wch: 30 }, // Task Title
      { wch: 45 }, // Description
      { wch: 35 }, // Assignees
      { wch: 12 }, // Priority
      { wch: 14 }, // Status
      { wch: 14 }, // Created Date
      { wch: 14 }, // DueDate
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Task Import Template");

    // Add instructions sheet
    const instructions = [
      {
        Field: "Task Title",
        Required: "Yes",
        Description: "Task title (max 100 chars recommended)",
      },
      {
        Field: "Description",
        Required: "No",
        Description: "Optional task description",
      },
      {
        Field: "Assignees",
        Required: "No*",
        Description:
          "Comma-separated emails. Falls back to Default Assignee if empty",
      },
      {
        Field: "Priority",
        Required: "No",
        Description: "Low, Medium, or High. Defaults to Medium",
      },
      {
        Field: "Status",
        Required: "No",
        Description: "TODO, IN_PROGRESS, ON_HOLD, QA_TESTING, or DONE. Defaults to TODO",
      },
      {
        Field: "Created Date",
        Required: "No",
        Description: "Optional created date. Format: YYYY-MM-DD",
      },
      { Field: "Due Date", Required: "Yes", Description: "Format: YYYY-MM-DD" },
    ];
    const instWs = XLSX.utils.json_to_sheet(instructions);
    instWs["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, instWs, "Instructions");

    XLSX.writeFile(wb, "FlowTrack_Task_Import_Template.xlsx");
    toast.success("Template downloaded");
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const validExts = [".xlsx", ".xls", ".csv"];
    const isValidType =
      validTypes.includes(selected.type) ||
      validExts.some((ext) => selected.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      toast.error(
        "Please upload a valid Excel or CSV file (.xlsx, .xls, .csv)",
      );
      setFile(null);
      setParsedRows([]);
      return;
    }

    setFile(selected);
    setImportResult(null);
    parseFile(selected);
  };

  const normalizeRowKeys = (row) => {
    return Object.entries(row).reduce((acc, [key, value]) => {
      const normalizedKey = key
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, " ");
      acc[normalizedKey] = value;
      return acc;
    }, {});
  };

  const normalizeStatus = (status) => {
    const value = status?.toString().trim().toLowerCase();
    if (!value) return "TODO";
    if (value === "completed" || value === "done") return "DONE";
    if (
      value === "not-started" ||
      value === "not started" ||
      value === "notstarted"
    )
      return "TODO";
    if (
      value === "inprogress" ||
      value === "in progress" ||
      value === "in-progress"
    )
      return "IN_PROGRESS";
    if (value === "on hold" || value === "on-hold" || value === "onhold")
      return "ON_HOLD";
    if (
      value === "qa testing" ||
      value === "qa_testing" ||
      value === "qa testing"
    )
      return "QA_TESTING";
    if (VALID_STATUSES.includes(value.toUpperCase()))
      return value.toUpperCase();
    return "TODO";
  };

  const normalizePriority = (priority) => {
    const value = priority?.toString().trim().toLowerCase();
    if (!value) return "Medium";
    if (value === "low") return "Low";
    if (value === "high") return "High";
    return "Medium";
  };

  const parseExcelDate = (value) => {
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    if (typeof value === "number") {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const numberValue = Number(trimmed);
        const date = new Date(Math.round((numberValue - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
      return trimmed;
    }

    return value !== null && value !== undefined ? value.toString().trim() : "";
  };

  const parseFile = (selectedFile) => {
    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        });

        if (!json.length) {
          toast.error("The file appears to be empty or has no data rows");
          setParsedRows([]);
          setLoading(false);
          return;
        }

        const mapped = json.map((row, idx) => {
          const normalizedRow = normalizeRowKeys(row);
          const title = (
            normalizedRow["task title"] ||
            normalizedRow["title"] ||
            ""
          )
            .toString()
            .trim();
          const description = (normalizedRow["description"] || "")
            .toString()
            .trim();
          const assignees = (normalizedRow["assignees"] || "")
            .toString()
            .trim();
          const priority = normalizePriority(
            normalizedRow["priority"] || "Medium",
          );
          const status = normalizeStatus(normalizedRow["status"] || "TODO");
          const createdDate = parseExcelDate(
            normalizedRow["created date"] ||
              normalizedRow["createddate"] ||
              normalizedRow["created_date"] ||
              "",
          );
          const dueDate = parseExcelDate(
            normalizedRow["due date"] ||
              normalizedRow["duedate"] ||
              normalizedRow["due_date"] ||
              "",
          );

          const errors = [];
          if (!title) errors.push("Task Title is required");
          if (!dueDate) errors.push("Due Date is required");
          if (createdDate && isNaN(new Date(createdDate).getTime()))
            errors.push("Invalid Created Date format. Use YYYY-MM-DD");

          if (dueDate) {
            // Normalize: parseExcelDate already returns YYYY-MM-DD in most cases,
            // but validate again to avoid sending invalid dueDate to backend.
            if (isNaN(new Date(dueDate).getTime())) {
              errors.push("Invalid Due Date format. Use YYYY-MM-DD");
            }
          }

          if (priority && !VALID_PRIORITIES.includes(priority))
            errors.push(`Invalid priority: ${priority}`);
          if (status && !VALID_STATUSES.includes(status))
            errors.push(`Invalid status: ${status}`);

          return {
            row: idx + 1,
            title,
            description,
            assignees,
            priority,
            status,
            createdDate,
            dueDate,
            errors,
          };
        });

        setParsedRows(mapped);
        toast.success(`Parsed ${mapped.length} rows`);
      } catch (err) {
        console.error("Parse error:", err);
        toast.error(
          "Failed to parse file. Ensure it matches the template format.",
        );
        setParsedRows([]);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read file");
      setLoading(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    if (parsedRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("All rows have errors. Please fix them before importing.");
      return;
    }

    setImporting(true);
    try {
      const payload = {
        projectId,
        defaultAssigneeId: defaultAssigneeId || undefined,
        tasks: validRows.map((r) => ({
          title: r.title,
          description: r.description,
          assignees: r.assignees,
          priority: r.priority,
          status: r.status,
          createdDate: r.createdDate || undefined,
          dueDate: r.dueDate,
        })),
      };

      const res = await importTasks(payload);
      setImportResult(res.data);
      toast.success(
        res.data.message || `Imported ${res.data.successCount} tasks`,
      );

      if (res.data.successCount > 0 && onImportSuccess) {
        onImportSuccess(res.data.data);
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const hasErrors = parsedRows.some((r) => r.errors.length > 0);
  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Import Tasks from Excel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload an Excel file to bulk import tasks into FlowTrack
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <Icons.X />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Icons.Download />
              Download Template
            </button>

            <div className="flex-1" />

            <label className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 cursor-pointer">
              <Icons.Upload />
              {file ? "Change File" : "Upload Excel / CSV"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Icons.File />
              <span className="font-medium">{file.name}</span>
              <span className="text-slate-400 text-xs">
                ({parsedRows.length} rows)
              </span>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Select Project <span className="text-red-400">*</span>
              </label>
              <select
                className={inputCls}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Default Assignee{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (Optional)
                </span>
              </label>
              <select
                className={inputCls}
                value={defaultAssigneeId}
                onChange={(e) => setDefaultAssigneeId(e.target.value)}
              >
                <option value="">None</option>
                {employees.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Used when a row has no assignees specified
              </p>
            </div>
          </div>

          {/* Results summary */}
          {importResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${importResult.errorCount === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
            >
              <div className="flex items-center gap-2 font-semibold mb-1">
                {importResult.errorCount === 0 ? (
                  <Icons.Check />
                ) : (
                  <Icons.Alert />
                )}
                {importResult.message}
              </div>
              <div className="text-xs opacity-90">
                Success: {importResult.successCount} | Errors:{" "}
                {importResult.errorCount}
              </div>
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-800">Preview</h4>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-600 font-semibold">
                    {validCount} valid
                  </span>
                  {hasErrors && (
                    <span className="text-red-500 font-semibold">
                      {parsedRows.length - validCount} with errors
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Task Title
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Assignees
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Priority
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Created Date
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r) => (
                      <tr
                        key={r.row}
                        className={
                          r.errors.length > 0
                            ? "bg-red-50/50"
                            : "hover:bg-slate-50"
                        }
                      >
                        <td className="px-3 py-2 text-slate-500">{r.row}</td>
                        <td
                          className="px-3 py-2 text-slate-800 font-medium max-w-45 truncate"
                          title={r.title}
                        >
                          {r.title || (
                            <span className="text-slate-400 italic">Empty</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-slate-600 max-w-37.5 truncate"
                          title={r.assignees}
                        >
                          {r.assignees || (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              r.priority === "High"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : r.priority === "Medium"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.status}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.createdDate || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.dueDate}
                        </td>
                        <td className="px-3 py-2">
                          {r.errors.length > 0 ? (
                            <div className="group relative">
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold cursor-help">
                                <Icons.Alert /> {r.errors.length} error
                                {r.errors.length > 1 ? "s" : ""}
                              </span>
                              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 w-64 bg-white border border-red-200 rounded-lg shadow-lg p-2 text-[11px] text-red-700">
                                {r.errors.map((err, i) => (
                                  <div key={i} className="py-0.5">
                                    • {err}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <Icons.Check /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-2" />
              Parsing file...
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0 || !projectId}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icons.Upload />
              )}
              {importing
                ? "Importing..."
                : `Import ${validCount > 0 ? `(${validCount})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
