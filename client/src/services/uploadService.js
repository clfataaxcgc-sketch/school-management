import api from "./api.js";

// Files are uploaded separately from the create/submit calls: upload first
// to get back { url, originalName, size } attachment objects, then include
// those in the assignment/submission payload. Keeps the JSON body small and
// lets the same attachment picker be reused for create and edit forms.
const uploadService = {
  uploadAssignmentFiles: (files) => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    return api
      .post("/uploads/assignment", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data);
  },
  uploadSubmissionFiles: (files) => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    return api
      .post("/uploads/submission", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data);
  },
};

export default uploadService;
