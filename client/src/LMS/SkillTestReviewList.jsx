
export default function SkillTestReviewList({ review = [] }) {
  if (!review.length) return null;

  return (
    <div className="space-y-3 text-left">
      {review.map((item, idx) => {
        const yourIdx = item.type === "mcq" && item.yourAnswer !== null && item.yourAnswer !== "" ? Number(item.yourAnswer) : null;
        const unanswered = item.type === "mcq" ? yourIdx === null : !String(item.yourAnswer ?? "").trim();
        return (
          <div
            key={idx}
            className={`rounded-xl border p-3 ${item.isCorrect ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 text-xs font-bold ${item.isCorrect ? "text-emerald-600" : "text-red-600"}`}>
                {item.isCorrect ? "✓" : "✗"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {idx + 1}. {item.prompt}
                  {item.section ? <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">{item.section}</span> : null}
                </p>

                {item.type === "mcq" ? (
                  <ul className="mt-2 space-y-1">
                    {item.options.map((opt, oIdx) => {
                      const isRight = oIdx === item.correctOptionIndex;
                      const isYours = oIdx === yourIdx;
                      return (
                        <li
                          key={oIdx}
                          className={`text-xs rounded px-2 py-1 ${
                            isRight
                              ? "bg-emerald-100 text-emerald-800 font-semibold"
                              : isYours
                                ? "bg-red-100 text-red-700 line-through"
                                : "text-slate-500"
                          }`}
                        >
                          {opt}
                          {isRight ? " — correct answer" : isYours ? " — your answer" : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-2 text-xs space-y-0.5">
                    <p className={item.isCorrect ? "text-emerald-700" : "text-red-700"}>
                      Your answer: {unanswered ? <em className="text-slate-400">left blank</em> : String(item.yourAnswer)}
                    </p>
                    {!item.isCorrect && item.acceptableAnswers?.length > 0 && (
                      <p className="text-emerald-700">Accepted: {item.acceptableAnswers.join(", ")}</p>
                    )}
                  </div>
                )}

                {unanswered && <p className="mt-1 text-[11px] text-slate-400">Not answered</p>}
                {item.explanation && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">Why:</span> {item.explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
