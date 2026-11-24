export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Delete", confirmClass = "btn-error", loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-base-100 rounded-box shadow-xl w-full max-w-sm p-5">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm opacity-70 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={`btn ${confirmClass} btn-sm`} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs"></span> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
