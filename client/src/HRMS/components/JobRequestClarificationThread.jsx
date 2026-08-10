import { useState } from "react";
import { MessageCircle } from "lucide-react";

// Shared by HR (asks a question) and the requesting Manager (responds to the
// most recent open one) — used inside the job-request detail view.
export default function JobRequestClarificationThread({ jobRequest, isHr, isOwner, onAskQuestion, onRespond }) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const clarifications = jobRequest.clarifications || [];
  const openClarification = [...clarifications].reverse().find((c) => !c.response);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
        <MessageCircle className="w-3.5 h-3.5" /> Clarifications
      </h4>

      {clarifications.length === 0 && <p className="text-sm text-slate-400 italic">No questions yet.</p>}

      <div className="space-y-2">
        {clarifications.map((c, i) => (
          <div key={c._id || i} className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
            <p><span className="font-semibold text-cyan-700">HR:</span> {c.question}</p>
            {c.response && <p className="mt-1"><span className="font-semibold text-violet-700">Manager:</span> {c.response}</p>}
          </div>
        ))}
      </div>

      {isHr && jobRequest.status !== "approved" && jobRequest.status !== "rejected" && jobRequest.status !== "published" && (
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the manager a question..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => { if (question.trim()) { onAskQuestion(question.trim()); setQuestion(""); } }}
            className="px-3 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold shrink-0"
          >
            Ask
          </button>
        </div>
      )}

      {isOwner && openClarification && (
        <div className="flex gap-2">
          <input
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Respond to HR's question..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={() => { if (response.trim()) { onRespond(response.trim()); setResponse(""); } }}
            className="px-3 py-2 rounded-xl bg-violet-700 text-white text-sm font-semibold shrink-0"
          >
            Respond
          </button>
        </div>
      )}
    </div>
  );
}
