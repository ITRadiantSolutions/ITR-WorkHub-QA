import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "./Icons";
// -- Badge ---------------------------------------------------------------------
function Badge({ label, variant = "default" }) {
  const s = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
    progress: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    default: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${s[variant?.toLowerCase()] || s.default}`}
    >
      {label}
    </span>
  );
}
function statusVariant(s) {
  return (
    {
      Active: "active",
      Done: "done",
      Planning: "planning",
      Completed: "completed",
    }[s] || "default"
  );
}
const normalizeClientGroupStatus = (status) =>
  status === "Planing" || status === "In Progress" ? "Planning" : status;
function priorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
function wasUpdated(item) {
  if (!item?.createdAt || !item?.updatedAt) return false;
  return (
    new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 1000
  );
}
// -- Input style ---------------------------------------------------------------
const inputCls =
  "w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent placeholder-slate-400 transition-all hover:border-slate-300 hover:bg-white";
const emptyForm = { name: "", status: "Active", description: "", projects: [] };
// -----------------------------------------------------------------------------
export default function AdminClientTab({
  projects = [],
  draft,
  resumeProject,
  searchRequest,
  onCreateProject,
  onDraftChange,
  onGroupCreated,
  onViewProject,
}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(Boolean(resumeProject));
  const [query, setQuery] = useState("");
  const [modalMode, setModalMode] = useState("create");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const handledSearchRequest = useRef(null);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...draft,
    projects: resumeProject?._id
      ? [...new Set([...(draft?.projects || []), resumeProject._id])]
      : draft?.projects || [],
  }));

  useEffect(() => {
    onDraftChange?.(form);
  }, [form, onDraftChange]);

  useEffect(() => {
    let cancelled = false;
    API.get("/client-groups", { cache: false })
      .then((r) => !cancelled && setGroups(r.data?.data || []))
      .catch(
        (e) =>
          !cancelled &&
          toast.error(
            e.response?.data?.message || "Could not load accounts",
          ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchRequest?.type !== "clientGroup" || !groups.length) return;
    if (handledSearchRequest.current === searchRequest.requestId) return;

    const group = groups.find(
      (item) =>
        item._id === searchRequest.id ||
        item.name?.toLowerCase() === searchRequest.query?.toLowerCase(),
    );
    if (!group) return;

    handledSearchRequest.current = searchRequest.requestId;
    setSelectedGroup(group);
    setModalMode("view");
    setModalOpen(true);
  }, [groups, searchRequest]);
  const filteredProjects = useMemo(() => {
    const v = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        !v ||
        [p.name, p.description, p.status].some((f) =>
          String(f || "")
            .toLowerCase()
            .includes(v),
        ),
    );
  }, [projects, query]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setSelectedGroup(null);
    setModalMode("create");
    setForm(emptyForm);
    setQuery("");
    setValidationErrors({});
  };

  const toggleProject = (id) => {
    setValidationErrors((errors) => ({ ...errors, projects: "" }));
    setForm((cur) => ({
      ...cur,
      projects: cur.projects.includes(id)
        ? cur.projects.filter((x) => x !== id)
        : [...cur.projects, id],
    }));
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    const errors = {};
    const name = form.name?.trim();
    const allowedStatuses = ["Planning", "Active", "Done"];
    const status = normalizeClientGroupStatus(form.status);

    if (!name) errors.name = "Name is required.";
    if (!allowedStatuses.includes(status))
      errors.status = "Please select a valid status.";
    if (!Array.isArray(form.projects) || form.projects.length === 0)
      errors.projects = "Select at least one project.";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please complete all required fields");
      return;
    }

    setValidationErrors({});
    try {
      setSaving(true);
      const res =
        modalMode === "edit"
          ? await API.put(`/client-groups/${selectedGroup._id}`, {
              ...form,
              name,
            })
          : await API.post("/client-groups", { ...form, name, status });
      setGroups((cur) =>
        modalMode === "edit"
          ? cur.map((g) => (g._id === res.data.data._id ? res.data.data : g))
          : [res.data.data, ...cur],
      );
      toast.success(
        modalMode === "edit" ? "Account updated" : "Account created",
      );
      onGroupCreated?.();
      closeModal();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = (group) => {
    toast.custom((t) => (
      <div className="w-[360px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
            <Icons.Trash className="h-5 w-5 text-red-600" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Delete Account
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              <span className="font-medium text-slate-700">{group.name}</span>{" "}
              will be permanently removed. All projects will remain unchanged.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => toast.dismiss(t)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  toast.dismiss(t);

                  try {
                    await API.delete(`/client-groups/${group._id}`);

                    setGroups((prev) =>
                      prev.filter((g) => g._id !== group._id),
                    );

                    toast.success("Account deleted successfully.");
                  } catch (error) {
                    toast.error(
                      error.response?.data?.message ||
                        "Failed to delete account.",
                    );
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  const viewGroup = (group) => {
    setSelectedGroup(group);
    setModalMode("view");
    setModalOpen(true);
  };

  const viewProject = (project) => {
    onViewProject?.(project);
    closeModal();
  };
  return (
    <div
      className="space-y-2"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* -- Page header ------------------------------------------------- */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {/* <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
      Accounts Workspace
    </p> */}

          <h2 className="mt-0 text-xl font-bold text-slate-900">
            Accounts
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Organize projects by account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setModalMode("create");
            setSelectedGroup(null);
            setForm(emptyForm);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Icons.Plus className="h-4 w-4" />
          Create Account
        </button>
      </div>

      {/* -- Summary cards ----------------------------------------------- */}
      {!loading && groups.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Total Accounts",
              value: groups.length,
              sub: `${new Set(groups.flatMap((group) => (group.projects || []).map((project) => project._id))).size} assigned projects`,
              Icon: Icons.Folder,
              iconClass: "bg-indigo-50 text-indigo-600",
            },
            {
              label: "Active",
              value: groups.filter(
                (group) => (group.status || "Active") === "Active",
              ).length,
              sub: "Currently active",
              Icon: Icons.Activity,
              iconClass: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Planning",
              value: groups.filter((group) => group.status === "Planning")
                .length,
              sub: "Work underway",
              Icon: Icons.Clock,
              iconClass: "bg-blue-50 text-blue-600",
            },
            {
              label: "Done",
              value: groups.filter((group) => group.status === "Done").length,
              sub: `${projects.length} projects available`,
              Icon: Icons.Check,
              iconClass: "bg-violet-50 text-violet-600",
            },
          ].map((item) => (
            <article
              key={item.label}
              className="relative overflow-hidden rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-slate-200 bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold leading-none text-slate-900">
                    {item.value}
                  </p>
                </div>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}
                >
                  <item.Icon />
                </span>
              </div>
              <p className="mt-2 truncate text-[10px] text-slate-400">
                {item.sub}
              </p>
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-full ${item.label === "Active" ? "bg-emerald-500" : item.label === "Planning" ? "bg-blue-500" : item.label === "Done" ? "bg-violet-500" : "bg-indigo-600"}`}
              />
            </article>
          ))}
        </div>
      )}
      {/* -- Loading ----------------------------------------------------- */}
      {loading && (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading accounts"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="h-0.5 animate-pulse bg-slate-200" />
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-center gap-2.5">
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-5 w-14 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Empty state ------------------------------------------------- */}
      {!loading && groups.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-16 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Icons.FolderLg />
          </div>
          <p className="text-sm font-bold text-slate-700">
            No accounts yet
          </p>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Create your first account and add projects to it
          </p>
          <button
            type="button"
            onClick={() => {
              setModalMode("create");
              setForm(emptyForm);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
          >
            <Icons.Plus />
            Create First Account
          </button>
        </div>
      )}

      {/* -- Groups grid ------------------------------------------------- */}
      {!loading && groups.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group._id}
              role="button"
              tabIndex={0}
              aria-label={`View ${group.name} details`}
              onClick={() => viewGroup(group)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  viewGroup(group);
                }
              }}
              className="group cursor-pointer bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all overflow-hidden"
            >
              {/* Color accent */}
              <div className="h-0.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />

              <div className="p-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
                      <Icons.Folder />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {group.name}
                        </h3>
                        <Badge
                          label={group.status || "Active"}
                          variant={statusVariant(group.status || "Active")}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                        <Icons.Users />
                        <span>
                          {group.projects?.length || 0} project
                          {group.projects?.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        viewGroup(group);
                      }}
                      title="View"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Icons.Eye />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedGroup(group);
                        setForm({
                          name: group.name,
                          status: normalizeClientGroupStatus(
                            group.status || "Active",
                          ),
                          description: group.description || "",
                          projects: group.projects.map((p) => p._id),
                        });
                        setModalMode("edit");
                        setModalOpen(true);
                      }}
                      title="Edit"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeGroup(group);
                      }}
                      title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3 min-h-[2.5rem]">
                  {group.description || "No description provided."}
                </p>

                {/* Project tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {group.projects?.slice(0, 3).map((p) => (
                    <span
                      key={p._id}
                      className="text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[120px]"
                    >
                      {p.name}
                    </span>
                  ))}
                  {(group.projects?.length || 0) > 3 && (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                      +{group.projects.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400">
                    <p>
                      by{" "}
                      <span className="font-semibold text-slate-600">
                        {group.createdBy?.name || "Admin"}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      Created {formatDate(group.createdAt)}
                      {wasUpdated(group) && (
                        <span> · Updated {formatDate(group.updatedAt)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      viewGroup(group);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition"
                  >
                    View
                    <Icons.Arrow />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------
          VIEW MODAL
      ------------------------------------------------------------------ */}
      {modalOpen && modalMode === "view" && selectedGroup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                  <Icons.Folder />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedGroup.name}
                    </h2>
                    <Badge
                      label={`${selectedGroup.projects?.length || 0} projects`}
                    />
                    <Badge
                      label={selectedGroup.status || "Active"}
                      variant={statusVariant(selectedGroup.status || "Active")}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Created by{" "}
                    <span className="font-semibold text-slate-600">
                      {selectedGroup.createdBy?.name || "Admin"}
                    </span>
                  </p>                  <p className="mt-1 text-[10px] text-slate-400">
                    Created {formatDate(selectedGroup.createdAt)}
                    {wasUpdated(selectedGroup) && (
                      <span> · Updated {formatDate(selectedGroup.updatedAt)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        name: selectedGroup.name,
                        status: normalizeClientGroupStatus(
                          selectedGroup.status || "Planning",
                        ),
                        description: selectedGroup.description || "",
                        projects: selectedGroup.projects.map((p) => p._id),
                      });
                      setModalMode("edit");
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 hover:border-amber-300"
                  >
                    <Icons.Edit size={14} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900"
                  >
                    Close
                    <Icons.X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedGroup.description && (
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedGroup.description}
                </p>
              </div>
            )}

            {/* Projects */}
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Projects ({selectedGroup.projects?.length || 0})
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {selectedGroup.projects?.map((project) => (
                  <div
                    key={project._id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${project.name} details`}
                    onClick={() => viewProject(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        viewProject(project);
                      }
                    }}
                    className="cursor-pointer bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {project.name}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          label={project.status || "Planning"}
                          variant={statusVariant(project.status)}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">
                      {project.description || "No description provided."}
                    </p>                    <p className="mb-2.5 text-[10px] text-slate-400">
                      Created {formatDate(project.createdAt)}
                      {wasUpdated(project) && (
                        <span> · Updated {formatDate(project.updatedAt)}</span>
                      )}
                    </p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <Badge
                        label={project.priority || "Medium"}
                        variant={priorityVariant(project.priority)}
                      />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          viewProject(project);
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-900 hover:text-slate-700 transition"
                      >
                        View
                        <Icons.Arrow />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          CREATE / EDIT MODAL
      ------------------------------------------------------------------ */}
      {modalOpen && modalMode !== "view" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
        >
          <form
            onSubmit={saveGroup}
            noValidate
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                  {modalMode === "edit" ? <Icons.Edit /> : <Icons.Plus />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {modalMode === "edit"
                      ? "Edit Account"
                      : "New Account"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {modalMode === "edit"
                      ? "Update account details and projects"
                      : "Add details and select projects to include"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
              >
                <span>Close</span>
                <Icons.X size={14} strokeWidth={2.4} />
              </button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Name and status */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Account Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    autoFocus
                    maxLength={500}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setValidationErrors((errors) => ({
                        ...errors,
                        name: "",
                      }));
                    }}
                    placeholder="e.g. Acme Corporation"
                    required
                    aria-invalid={Boolean(validationErrors.name)}
                    aria-describedby={
                      validationErrors.name ? "group-name-error" : undefined
                    }
                    className={`${inputCls} ${validationErrors.name ? "border-red-300 bg-red-50 focus:ring-red-400" : ""}`}
                  />
                  {validationErrors.name && (
                    <p
                      id="group-name-error"
                      className="mt-1 text-[11px] font-medium text-red-600"
                    >
                      {validationErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Status <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      setForm({ ...form, status: e.target.value });
                      setValidationErrors((errors) => ({
                        ...errors,
                        status: "",
                      }));
                    }}
                    required
                    aria-invalid={Boolean(validationErrors.status)}
                    aria-describedby={
                      validationErrors.status ? "group-status-error" : undefined
                    }
                    className={`${inputCls} ${validationErrors.status ? "border-red-300 bg-red-50 focus:ring-red-400" : ""}`}
                  >
                    <option value="Active">Active</option>
                    <option value="Planning">Planning</option>
                    <option value="Done">Done</option>
                  </select>
                  {validationErrors.status && (
                    <p
                      id="group-status-error"
                      className="mt-1 text-[11px] font-medium text-red-600"
                    >
                      {validationErrors.status}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  maxLength={2000}
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Briefly describe this account or project portfolio"
                  className={`${inputCls} resize-none`}
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {form.description?.length || 0} / 2000
                </p>
              </div>

              {/* Project selector */}
              <div
                role="group"
                aria-invalid={Boolean(validationErrors.projects)}
                aria-describedby={
                  validationErrors.projects ? "group-projects-error" : undefined
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Select Projects <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCreateProject?.(form)}
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition"
                    >
                      <Icons.Plus />
                      New Project
                    </button>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${form.projects.length > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}
                    >
                      {form.projects.length} selected
                    </span>
                  </div>
                </div>

                {validationErrors.projects && (
                  <p
                    id="group-projects-error"
                    className="mt-1.5 text-[11px] font-medium text-red-600"
                  >
                    {validationErrors.projects}
                  </p>
                )}
                {/* Search */}
                <div className="relative mb-2.5">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Search />
                  </div>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects"
                    className={`${inputCls} pl-8`}
                  />
                </div>

                {/* Project list */}
                <div
                  className={`rounded-xl border overflow-hidden ${validationErrors.projects ? "border-red-300 ring-1 ring-red-100" : "border-slate-200"}`}
                >
                  <div className="max-h-52 overflow-y-auto bg-slate-50/50">
                    {filteredProjects.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        No projects found
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
                        {filteredProjects.map((project) => {
                          const checked = form.projects.includes(project._id);
                          return (
                            <label
                              key={project._id}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                                checked
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProject(project._id)}
                                className="sr-only"
                              />
                              {/* Custom checkbox */}
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                  checked
                                    ? "bg-white border-white"
                                    : "border-slate-300"
                                }`}
                              >
                                {checked && (
                                  <span className="text-slate-900">
                                    <Icons.Check />
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-semibold truncate ${checked ? "text-white" : "text-slate-800"}`}
                                >
                                  {project.name}
                                </p>
                                <p
                                  className={`text-[10px] truncate ${checked ? "text-white/60" : "text-slate-400"}`}
                                >
                                  {project.description || "No description"}
                                </p>
                              </div>
                              <Badge
                                label={project.status || "Planning"}
                                variant={statusVariant(project.status)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected chips */}
                {form.projects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {form.projects.map((id) => {
                      const p = projects.find((x) => x._id === id);
                      if (!p) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {p.name}
                          <button
                            type="button"
                            onClick={() => toggleProject(id)}
                            className="text-slate-400 hover:text-red-500 transition ml-0.5"
                          >
                        
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm disabled:opacity-60 active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Icons.Check />
                    {modalMode === "edit" ? "Save Changes" : "Create Account"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
