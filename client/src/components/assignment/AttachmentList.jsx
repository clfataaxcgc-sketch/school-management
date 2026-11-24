import { FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";
import api, { SERVER_URL } from "../../services/api.js";

// Uploaded files are private to each school, so a plain link is not enough:
// the browser would not send the login token. We download the file with our
// api client (which sends the token) and then save it.
const downloadFile = async (attachment) => {
  try {
    const res = await api.get(`${SERVER_URL}${attachment.url}`, { responseType: "blob" });
    const objectUrl = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.originalName || "file";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    toast.error("Could not download the file");
  }
};

export default function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="space-y-1 mt-1">
      {attachments.map((a, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => downloadFile(a)}
            className="link link-primary text-xs flex items-center gap-1 w-fit"
          >
            <FiDownload size={12} /> {a.originalName}
          </button>
        </li>
      ))}
    </ul>
  );
}
