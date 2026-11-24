import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import authService from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Alert from "../../components/common/Alert.jsx";
import { getDashboardPath } from "../../utils/roleRedirect.js";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const password = watch("password");

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const res = await authService.resetPassword(token, data.password);
      if (res.token) localStorage.setItem("token", res.token);
      updateUser(res.user);
      toast.success("Password reset successfully!");
      navigate(getDashboardPath(res.user.role), { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="text-2xl font-bold text-center mb-1">Reset Password</h1>
          <p className="text-center text-sm opacity-70 mb-4">Choose a new password</p>

          <Alert message={serverError} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                className={`input input-bordered w-full ${errors.password ? "input-error" : ""}`}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Minimum 8 characters" },
                })}
              />
              {errors.password && (
                <span className="text-error text-xs mt-1">{errors.password.message}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                className={`input input-bordered w-full ${errors.confirmPassword ? "input-error" : ""}`}
                {...register("confirmPassword", {
                  validate: (value) => value === password || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <span className="text-error text-xs mt-1">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Reset Password"}
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            <Link to="/login" className="link link-primary">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
