export default function Loader({
  containerClass = "flex flex-col items-center justify-center h-[60vh] gap-3",
  message = "Please wait…",
}) {
  return (
    <div className={containerClass}>
      <div className="flex gap-2">
        <span className="w-3 h-3 bg-violet-600 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-3 h-3 bg-violet-600 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-3 h-3 bg-violet-600 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>

      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

