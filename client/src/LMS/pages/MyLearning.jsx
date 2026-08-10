import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function MyLearning() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi
      .me()
      .then((res) => setProfile(res.data))
      .catch(() => toast.error("Failed to load your learning profile"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Learning</h1>
        <p className="text-xs text-slate-500 mt-0.5">Badges earned and skills verified through course completion.</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Badges</p>
        {profile?.badges?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profile.badges.map((badge) => (
              <div key={badge._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 text-center">
                {badge.imageUrl ? (
                  <img src={badge.imageUrl} alt={badge.name} className="w-14 h-14 mx-auto rounded-full object-cover mb-2" />
                ) : (
                  <div
                    className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-white mb-2"
                    style={{ backgroundColor: badge.color || "#7C3AED" }}
                  >
                    <Icons.Award />
                  </div>
                )}
                <p className="text-xs font-bold text-slate-800">{badge.name}</p>
                <p className="text-[10px] text-slate-400">{badge.category}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No badges earned yet — complete a quiz or assignment to earn one.</p>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Skills</p>
        {profile?.skills?.length ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50">
            {profile.skills.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-800">{s.skill?.name || "Unknown skill"}</p>
                  <p className="text-[10px] text-slate-400">{s.skill?.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">{s.level}</span>
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                      s.status === "Verified" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No skills verified yet.</p>
        )}
      </div>
    </div>
  );
}
