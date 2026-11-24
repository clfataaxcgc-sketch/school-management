import { useState } from "react";
import toast from "react-hot-toast";
import { FiPaperclip, FiX } from "react-icons/fi";

// Uploads files immediately on selection (via the given upload function)
// and keeps the resulting attachment objects in the form's state —
// so by the time the form submits, attachments are already URLs, not files.
export default function AttachmentPicker({ attachments, onChange, uploadFn }) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const res = await uploadFn(files);
      onChange([...(attachments || []), ...res.attachments]);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAt = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="btn btn-outline btn-xs">
        <FiPaperclip /> {uploading ? "Uploading..." : "Attach files"}
        <input type="file" multiple hidden onChange={handleFiles} disabled={uploading} />
      </label>
      {attachments?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a, i) => (
            <li key={i} className="flex items-center justify-between text-xs bg-base-200 rounded px-2 py-1">
              <span className="truncate">{a.originalName}</span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeAt(i)}>
                <FiX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
