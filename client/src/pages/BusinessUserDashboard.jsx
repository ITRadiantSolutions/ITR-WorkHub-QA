import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API } from "../services/api";
import Icons from "../components/Icons";
import ThemeToggle from "../components/ThemeToggle";

// ── SVG Icons ────────────────────────────────────────────────────────────────

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const s = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${s[variant] || s.default}`}
    >
      {label}
    </span>
  );
}

function getStatusVariant(s) {
  return (
    { Active: "active", Planning: "planning", Completed: "completed" }[s] ||
    "default"
  );
}
function getPriorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BusinessUserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [comments, setComments] = useState({}); // { projectId: [{author,date,text}] }
  const [inputs, setInputs] = useState({}); // { projectId: string }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState({}); // { projectId: bool }

  useEffect(() => {
    window.history.replaceState(null, "", window.location.href);
  }, []);
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await API.get("/projects");
      setProjects(res.data || []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (projectId) => {
    const text = inputs[projectId]?.trim();
    if (!text) return;
    setPosting((p) => ({ ...p, [projectId]: true }));
    try {
      // Optimistically store locally (replace with real API call if endpoint exists)
      const newEntry = {
        author: user?.name,
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        text,
      };
      setComments((c) => ({
        ...c,
        [projectId]: [...(c[projectId] || []), newEntry],
      }));
      setInputs((i) => ({ ...i, [projectId]: "" }));
    } catch {
      setError("Failed to post comment");
    } finally {
      setPosting((p) => ({ ...p, [projectId]: false }));
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
      navigate("/", { replace: true });
    }
  };

  const permissions = [
    {
      label: "View Projects",
      desc: "View all project details and info",
      allowed: true,
    },
    {
      label: "Add Comments",
      desc: "Provide feedback on projects",
      allowed: true,
    },
    {
      label: "View Project Status",
      desc: "Track project progress and timelines",
      allowed: true,
    },
    {
      label: "Read Reports",
      desc: "Access project reports and summaries",
      allowed: true,
    },
    {
      label: "Edit Projects",
      desc: "Cannot edit project details (PM/Admin only)",
      allowed: false,
    },
    {
      label: "Manage Tasks",
      desc: "Cannot create or assign tasks",
      allowed: false,
    },
    {
      label: "Delete or Modify Data",
      desc: "Cannot delete projects (Admin only)",
      allowed: false,
    },
    {
      label: "User Management",
      desc: "Cannot manage users or roles",
      allowed: false,
    },
  ];

  const navItems = [
    { id: "dashboard", label: "Overview", Ic: Icons.Dashboard },
    { id: "projects", label: "Projects", Ic: Icons.Projects },
    { id: "settings", label: "Access", Ic: Icons.Settings },
  ];

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="flex min-h-screen bg-slate-50"
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-56 bg-slate-900 fixed h-screen flex flex-col z-10">
        <div className="px-5 py-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
              <div className="w-3 h-3 bg-slate-900 rounded-sm" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-none">
                {/* WorkSpace */}
                Business Portal
              </p>
              {/* <p className="text-slate-400 text-[10px] mt-0.5">Business Portal</p> */}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">
                {user?.name}
              </p>
              <p className="text-slate-400 text-[10px] truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ id, label, Ic }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                activeTab === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Ic />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/60">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-red-600/20 transition-all"
          >
            <Icons.Logout />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 ml-56 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-slate-800">
              {activeTab === "dashboard" && "Overview"}
              {activeTab === "projects" && "Projects"}
              {activeTab === "settings" && "Access & Permissions"}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
            <Icons.Eye />
            <span className="font-medium text-slate-700">{user?.name}</span>
            <span className="text-slate-300">·</span>
            <span className="text-indigo-600 font-semibold">Business User</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs mb-4">
              <Icons.X />
              {error}
              <button onClick={() => setError("")} className="ml-auto">
                <Icons.X />
              </button>
            </div>
          )}

          {/* ── OVERVIEW ───────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-5 max-w-4xl">
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Projects Visible",
                    value: projects.length,
                    sub: "you have read access",
                    dark: true,
                  },
                  {
                    label: "Active Projects",
                    value: projects.filter((p) => p.status === "Active").length,
                    sub: "currently running",
                    dark: false,
                  },
                  {
                    label: "Access Level",
                    value: "Read",
                    sub: "view & comment enabled",
                    dark: false,
                  },
                ].map((card, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-4 border shadow-sm ${card.dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${card.dark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {card.label}
                    </p>
                    <p
                      className={`text-3xl font-bold ${card.dark ? "text-white" : "text-slate-800"}`}
                    >
                      {card.value}
                    </p>
                    <p
                      className={`text-[11px] mt-1 ${card.dark ? "text-slate-400" : "text-slate-400"}`}
                    >
                      {card.sub}
                    </p>
                  </div>
                ))}
              </div>

              {/* Project status breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-700 mb-3">
                  Project Status Breakdown
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      label: "Active",
                      count: projects.filter((p) => p.status === "Active")
                        .length,
                      color: "#059669",
                    },
                    {
                      label: "Planning",
                      count: projects.filter((p) => p.status === "Planning")
                        .length,
                      color: "#7c3aed",
                    },
                    {
                      label: "Completed",
                      count: projects.filter((p) => p.status === "Completed")
                        .length,
                      color: "#94a3b8",
                    },
                  ].map((row, i) => {
                    const pct =
                      projects.length > 0
                        ? (row.count / projects.length) * 100
                        : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">{row.label}</span>
                          <span className="font-bold text-slate-800">
                            {row.count}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: row.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent projects */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">
                    Recent Projects
                  </p>
                  <button
                    onClick={() => setActiveTab("projects")}
                    className="text-[11px] text-slate-400 hover:text-slate-700 transition"
                  >
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {projects.slice(0, 5).map((p) => (
                    <div
                      key={p._id}
                      className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              p.status === "Active"
                                ? "#059669"
                                : p.status === "Planning"
                                  ? "#7c3aed"
                                  : "#94a3b8",
                          }}
                        />
                        <p className="text-xs font-medium text-slate-700">
                          {p.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          label={p.status}
                          variant={getStatusVariant(p.status)}
                        />
                        <Badge
                          label={p.priority}
                          variant={getPriorityVariant(p.priority)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PROJECTS ───────────────────────────────────────────────── */}
          {activeTab === "projects" && (
            <div className="max-w-4xl space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-14 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <Icons.Empty />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    No projects available
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Projects will appear here once assigned
                  </p>
                </div>
              ) : (
                projects.map((project) => {
                  const projectComments = comments[project._id] || [];
                  return (
                    <div
                      key={project._id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      {/* Top accent */}
                      <div
                        className={`h-1 ${project.status === "Active" ? "bg-emerald-500" : project.status === "Planning" ? "bg-violet-500" : "bg-slate-300"}`}
                      />

                      <div className="p-4">
                        {/* Project header */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
                              <Icons.Folder />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">
                                {project.name}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {project.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              label={project.status}
                              variant={getStatusVariant(project.status)}
                            />
                            <Badge
                              label={project.priority}
                              variant={getPriorityVariant(project.priority)}
                            />
                          </div>
                        </div>

                        {/* Dates */}
                        {(project.startDate || project.endDate) && (
                          <p className="text-[11px] text-slate-400 ml-9 mb-3">
                            {project.startDate
                              ? new Date(project.startDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                            {" → "}
                            {project.endDate
                              ? new Date(project.endDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </p>
                        )}

                        {/* Comments section */}
                        <div className="border-t border-slate-100 pt-3 mt-1">
                          <div className="flex items-center gap-1.5 mb-3">
                            <Icons.Comment />
                            <p className="text-xs font-bold text-slate-700">
                              Comments{" "}
                              {projectComments.length > 0 && (
                                <span className="text-slate-400 font-normal">
                                  ({projectComments.length})
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Existing comments */}
                          {projectComments.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {projectComments.map((c, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center">
                                      <span className="text-[9px] font-bold text-indigo-700">
                                        {c.author?.charAt(0)?.toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-700">
                                      {c.author}
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-auto">
                                      {c.date}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {c.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {projectComments.length === 0 && (
                            <p className="text-[11px] text-slate-400 mb-3">
                              No comments yet — be the first to add feedback.
                            </p>
                          )}

                          {/* Add comment */}
                          <div className="flex gap-2">
                            <textarea
                              rows="2"
                              placeholder="Add feedback or comment..."
                              value={inputs[project._id] || ""}
                              onChange={(e) =>
                                setInputs((i) => ({
                                  ...i,
                                  [project._id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment(project._id);
                                }
                              }}
                              className="flex-1 border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none placeholder-slate-400 transition"
                            />
                            <button
                              onClick={() => handleAddComment(project._id)}
                              disabled={
                                posting[project._id] ||
                                !inputs[project._id]?.trim()
                              }
                              className="self-end flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition shrink-0"
                            >
                              {posting[project._id] ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Icons.Send />
                              )}
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── ACCESS & SETTINGS ──────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="max-w-3xl space-y-4">
              {/* Profile card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-bold text-slate-800">Profile</p>
                </div>
                <div className="p-5 space-y-0 divide-y divide-slate-50">
                  {[
                    { label: "Full Name", value: user?.name },
                    { label: "Email", value: user?.email },
                    { label: "Role", value: "Business User" },
                    { label: "Access Level", value: "Read-Only + Comments" },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        {row.label}
                      </span>
                      <span className="text-xs font-medium text-slate-800">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-bold text-slate-800">
                    Permissions
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                  {permissions.map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                        p.allowed
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-slate-50 border-slate-100 opacity-60"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          p.allowed
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-300 text-white"
                        }`}
                      >
                        {p.allowed ? <Icons.Check /> : <Icons.X />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {p.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
