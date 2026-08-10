import { useEffect, useMemo, useRef, useState } from "react";
import CameraCapture from "./CameraCapture.jsx";
import { API } from "../../services/api.js";

const INPUT_CLS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-sm";
const LABEL_CLS = "flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";

function RequiredMark() {
  return <span className="text-red-500">*</span>;
}

const FIELDS = [
  { label: "Full Name", name: "fullName", placeholder: "John Doe", required: true },
  { label: "Mobile Number", name: "mobileNumber", placeholder: "+91 9876543210", type: "tel", required: true },
  { label: "Email Address(Optional)", name: "email", placeholder: "john@example.com", type: "email" },
  { label: "Address(Optional)", name: "address", placeholder: "Street address, city, state" },
  { label: "Purpose of Visit", name: "purpose", placeholder: "Meeting / Interview / Delivery...", required: true },
  {
    label: "Duration (Optional)",
    name: "expectedDuration",
    tag: "select",
    options: ["15 mins", "30 mins", "1 hour", "2 hours", "Half day", "Full day"],
  },
];

// Ported from the standalone VMS project's VisitorForm.jsx. Adapted:
// employee lookup now hits ItrOne's shared /vms/admin/users/public endpoint
// and matches against `name` (ItrOne's User model has no `employeeId`).
export default function VisitorForm({ onSubmit }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    address: "",
    purpose: "",
    personToMeetId: "",
    expectedDuration: "1 hour",
    visitorType: "Guest",
    notes: "",
    photoUrl: "",
  });

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const personInputRef = useRef(null);
  const personWrapRef = useRef(null);

  const [kioskUsers, setKioskUsers] = useState([]);
  const [kioskUsersLoading, setKioskUsersLoading] = useState(false);
  const [kioskUsersError, setKioskUsersError] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setKioskUsersLoading(true);
        const { data } = await API.get("/vms/admin/users/public");
        if (mounted) setKioskUsers(data.users ?? []);
      } catch (e) {
        if (mounted) setKioskUsersError(e?.message ?? "Failed to load employees");
      } finally {
        if (mounted) setKioskUsersLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (personWrapRef.current && !personWrapRef.current.contains(e.target)) setPersonDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredKioskUsers = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return kioskUsers;
    return kioskUsers.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [kioskUsers, personSearch]);

  const selectedPersonLabel = useMemo(() => {
    if (!form.personToMeetId) return "";
    const match = kioskUsers.find((u) => {
      const id = u._id ?? u.id;
      return String(id) === String(form.personToMeetId) || String(u.email ?? "").toLowerCase() === String(form.personToMeetId).toLowerCase();
    });
    return match?.name ?? "";
  }, [form.personToMeetId, kioskUsers]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const steps = ["Details", "Photo", "Review"];

  const validateDetails = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Full Name is required";
    if (!form.mobileNumber.trim()) {
      e.mobileNumber = "Mobile Number is required";
    } else {
      const normalized = form.mobileNumber.replace(/[\s+\-()]/g, "");
      if (!/^(?:\+91|91)?[6-9]\d{9}$/.test(normalized)) e.mobileNumber = "Enter a valid Indian mobile number";
    }
    if (!form.purpose.trim()) e.purpose = "Purpose of visit is required";
    if (!form.personToMeetId.trim()) e.personToMeetId = "Host (Person to Meet) is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  function PersonToMeetField() {
    return (
      <div className="relative" ref={personWrapRef}>
        <span className={LABEL_CLS}>
          Person to Meet <RequiredMark />
        </span>
        <div className="relative">
          <input
            ref={personInputRef}
            value={personDropdownOpen ? personSearch : selectedPersonLabel}
            onChange={(e) => {
              setPersonSearch(e.target.value);
              setPersonDropdownOpen(true);
              setForm((f) => ({ ...f, personToMeetId: "" }));
            }}
            onFocus={() => {
              setPersonDropdownOpen(true);
              if (selectedPersonLabel) setPersonSearch("");
            }}
            placeholder="Search employee by name or email"
            className={INPUT_CLS + " pl-9" + (errors.personToMeetId ? " border-red-400 ring-2 ring-red-400/20" : "")}
          />
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>

        {personDropdownOpen && (
          <div className="absolute left-0 right-0 z-20 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            {kioskUsersLoading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading employees…
              </div>
            )}
            {kioskUsersError && <div className="px-3 py-3 text-xs text-red-600">{kioskUsersError}</div>}
            {!kioskUsersLoading &&
              !kioskUsersError &&
              (filteredKioskUsers.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-500">No employees found</div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  {filteredKioskUsers.map((u) => {
                    const id = u._id ?? u.id;
                    const initials = (u.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, personToMeetId: String(id) }));
                          setPersonSearch("");
                          setPersonDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-pink-50/60 transition-colors"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-[10px] font-bold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">{u.name ?? "Employee"}</p>
                          {u.email && <p className="text-[10px] text-slate-400">{u.email}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>
        )}
        {errors.personToMeetId && <p className="mt-1 text-xs font-medium text-red-600">{errors.personToMeetId}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-2xl bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none fixed left-0 top-0 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-80 w-80 rounded-full bg-pink-200/30 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-6 flex w-full items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <button type="button" onClick={() => setStep(i)} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    i < step
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white"
                      : i === step
                        ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white ring-2 ring-rose-200"
                        : "border border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {i < step ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-xs font-semibold ${i === step ? "text-pink-600" : i < step ? "text-rose-600" : "text-slate-400"}`}>{s}</span>
              </button>
              {i < steps.length - 1 && (
                <div className="mx-2 flex-1 h-1 rounded-full bg-slate-200">
                  <div className={`h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-600 transition-all ${i < step ? "w-full" : "w-0"}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 sm:p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Visitor Information</span>
              </div>
              <span className="text-[11px] text-slate-400">
                <RequiredMark /> Required fields
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 md:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.name} className={f.name === "address" || f.name === "purpose" ? "block sm:col-span-2" : "block"}>
                  <span className={LABEL_CLS}>
                    {f.label} {f.required && <RequiredMark />}
                  </span>
                  {f.tag === "select" ? (
                    <select
                      value={form[f.name]}
                      onChange={setField(f.name)}
                      className={INPUT_CLS + " appearance-none cursor-pointer bg-white" + (errors[f.name] ? " border-red-400 ring-2 ring-red-400/20" : "")}
                    >
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type || "text"}
                      value={form[f.name]}
                      onChange={setField(f.name)}
                      placeholder={f.placeholder}
                      className={INPUT_CLS + (errors[f.name] ? " border-red-400 ring-2 ring-red-400/20" : "")}
                    />
                  )}
                  {errors[f.name] && <p className="mt-1 text-xs font-medium text-red-600">{errors[f.name]}</p>}
                </label>
              ))}

              <div className="sm:col-span-2 lg:col-span-3">
                <PersonToMeetField />
              </div>
            </div>

            <label className="mt-4 block">
              <span className={LABEL_CLS}>Additional Notes (Optional)</span>
              <textarea rows={2} value={form.notes} onChange={setField("notes")} placeholder="Any special instructions or remarks..." className={INPUT_CLS + " resize-none"} />
            </label>

            <button
              onClick={() => validateDetails() && setStep(1)}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-semibold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98] sm:w-auto sm:px-8 sm:ml-auto"
            >
              Continue to Photo
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <CameraCapture onCapture={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))} />
            <div className="flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98] sm:flex-none sm:px-8"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (!form.photoUrl) {
                    alert("Please capture your photo");
                    return;
                  }
                  setStep(2);
                }}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-semibold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98] sm:flex-none sm:px-8 sm:ml-auto"
              >
                Continue to Review
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 sm:p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Review & Confirm</span>
            </div>

            <div className="rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50 p-4 mb-4">
              <div className="flex items-center gap-3">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Visitor" className="h-14 w-14 rounded-xl object-cover ring-2 ring-pink-200 shadow" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-lg font-semibold text-white shadow">
                    {form.fullName ? form.fullName.slice(0, 2).toUpperCase() : "?"}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{form.fullName || "—"}</p>
                  <p className="text-xs text-slate-500">{form.mobileNumber}</p>
                  <p className="text-xs text-slate-500">{form.email}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 mb-4 sm:grid-cols-2">
              {[
                { label: "Purpose", value: form.purpose },
                { label: "Address", value: form.address },
                { label: "Meeting", value: selectedPersonLabel || form.personToMeetId },
                { label: "Duration", value: form.expectedDuration },
                { label: "Notes", value: form.notes },
              ]
                .filter((r) => r.value)
                .map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 shrink-0">{row.label}</span>
                    <span className="text-xs text-slate-700 text-right">{row.value}</span>
                  </div>
                ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  validateDetails();
                  setStep(1);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98] sm:flex-none sm:px-8"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (!validateDetails()) {
                    setStep(0);
                    return;
                  }
                  if (!form.photoUrl) {
                    setStep(1);
                    return;
                  }
                  onSubmit(form);
                }}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-semibold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98] sm:flex-none sm:px-8 sm:ml-auto"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit & Verify
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[10px] text-slate-400">Data is encrypted and stored securely</p>
      </div>
    </div>
  );
}
