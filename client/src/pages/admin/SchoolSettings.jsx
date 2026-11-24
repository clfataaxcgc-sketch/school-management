import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import schoolService from "../../services/schoolService.js";
import Alert from "../../components/common/Alert.jsx";

// The school admin edits the school profile here (name, address, phone, logo url).
// The school email and the status cannot be changed from this page.
export default function SchoolSettings() {
  const { school, setSchool } = useAuth();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (school) {
      reset({
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress || "",
        phone: school.phone || "",
        logo: school.logo || "",
      });
    }
  }, [school, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const res = await schoolService.updateMine(data);
      setSchool(res.school);
      toast.success("School profile saved");
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">School Settings</h1>
        <p className="opacity-70">Update your school&apos;s profile</p>
      </div>

      <div className="card bg-base-100 shadow">
        <form className="card-body space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Alert message={serverError} />

          <div className="form-control">
            <label className="label"><span className="label-text">School Email</span></label>
            <input className="input input-bordered w-full" value={school?.schoolEmail || ""} disabled readOnly />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">School Name</span></label>
            <input
              className={`input input-bordered w-full ${errors.schoolName ? "input-error" : ""}`}
              {...register("schoolName", { required: "School name is required" })}
            />
            {errors.schoolName && <span className="text-error text-xs mt-1">{errors.schoolName.message}</span>}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">Address</span></label>
            <input className="input input-bordered w-full" {...register("schoolAddress")} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">Phone</span></label>
            <input className="input input-bordered w-full" {...register("phone")} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">Logo URL (optional)</span></label>
            <input className="input input-bordered w-full" placeholder="https://..." {...register("logo")} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
