import { FiX } from "react-icons/fi";

// Simple reusable modal (DaisyUI-styled) used by the admin create/edit forms.
export default function Modal({ open, onClose, title, children, widthClass = "max-w-lg" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className={`relative bg-base-100 rounded-box shadow-xl w-full ${widthClass} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 sticky top-0 bg-base-100">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
