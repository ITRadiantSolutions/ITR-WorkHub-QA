import { useEffect, useRef, useState } from "react";

function CameraCapture({ onCapture }) {
  const videoRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [camReady, setCamReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch {
        setError("Camera unavailable. Please allow camera access.");
      }
    }
    startCamera();
    return () => {
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    setCaptured(dataUrl);
    onCapture(dataUrl);
  };

  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-4 sm:p-5 shadow-xl shadow-slate-200/60 backdrop-blur">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Photo Capture</span>
        </div>
        {camReady && !error && (
          <span className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            Camera on
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs font-medium text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Live feed */}
            <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-[4/3] shadow-inner">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              {/* Corner markers */}
              {[
                "top-2 left-2 border-t-2 border-l-2",
                "top-2 right-2 border-t-2 border-r-2",
                "bottom-2 left-2 border-b-2 border-l-2",
                "bottom-2 right-2 border-b-2 border-r-2",
              ].map((cls, i) => (
                <div key={i} className={`absolute h-4 w-4 border-rose-400 rounded-sm ${cls}`} />
              ))}
              <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                LIVE
              </div>
            </div>

            {/* Captured preview */}
            <div className={`relative overflow-hidden rounded-xl aspect-[4/3] flex items-center justify-center border-2 transition-all ${
              captured ? "border-rose-300 shadow shadow-rose-100" : "border-dashed border-slate-200 bg-slate-50"
            }`}>
              {captured ? (
                <>
                  <img src={captured} alt="Captured" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-700 shadow">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Captured
                  </div>
                </>
              ) : (
                <div className="text-center px-4">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Photo preview</p>
                  <p className="text-[10px] text-slate-300">will appear here</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {captured ? (
              <>
                <button onClick={() => { setCaptured(null); onCapture(null); }}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-98">
                  Retake
                </button>
                <div className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 py-2.5 text-xs font-bold text-rose-700">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Photo Saved
                </div>
              </>
            ) : (
              <button onClick={handleCapture}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-98">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Capture Photo
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default CameraCapture;