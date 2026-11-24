import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import authService from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Alert from "../../components/common/Alert.jsx";

export default function ChangePassword() {
  const [serverError, setServerError] = useState("");
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const newPassword = watch("newPassword");

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const res = await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (res.token) localStorage.setItem("token", res.token);
      updateUser(res.user);
      toast.success("Password changed successfully");
      navigate("/profile");
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Change Password</h1>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <Alert message={serverError} />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Current Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                {...register("currentPassword", { required: "Required" })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                {...register("newPassword", {
                  required: "Required",
                  minLength: { value: 8, message: "Minimum 8 characters" },
                })}
              />
              {errors.newPassword && (
                <span className="text-error text-xs mt-1">{errors.newPassword.message}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm New Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                {...register("confirmPassword", {
                  validate: (value) => value === newPassword || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <span className="text-error text-xs mt-1">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
