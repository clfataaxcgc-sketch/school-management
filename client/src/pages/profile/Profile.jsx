import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import authService from "../../services/authService.js";
import Alert from "../../components/common/Alert.jsx";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    },
  });

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const res = await authService.updateProfile(data);
      updateUser(res.user);
      toast.success("Profile updated");
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <Alert message={serverError} />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">First Name</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  {...register("firstName", { required: "Required" })}
                />
                {errors.firstName && (
                  <span className="text-error text-xs mt-1">{errors.firstName.message}</span>
                )}
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Last Name</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  {...register("lastName", { required: "Required" })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input className="input input-bordered w-full" value={user?.email || ""} disabled />
              <span className="text-xs opacity-60 mt-1">Email cannot be changed here</span>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Phone</span>
              </label>
              <input className="input input-bordered w-full" {...register("phone")} />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Role</span>
              </label>
              <input
                className="input input-bordered w-full capitalize"
                value={user?.role || ""}
                disabled
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Save Changes"}
            </button>
          </form>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Security</h2>
          <p className="text-sm opacity-70 mb-2">Update your password regularly to keep your account secure.</p>
          <Link to="/change-password" className="btn btn-outline btn-sm w-fit">
            Change Password
          </Link>
        </div>
      </div>
    </div>
  );
}
