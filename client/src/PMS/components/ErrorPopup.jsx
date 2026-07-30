import { AlertTriangle } from "lucide-react";

export default function ErrorPopup({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-5">
        <div className="flex items-center gap-2 text-red-600 mb-3">
          <AlertTriangle size={20} />
          <h3 className="font-semibold">Validation Error</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

