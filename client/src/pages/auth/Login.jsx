import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import Alert from "../../components/common/Alert.jsx";
import { getDashboardPath } from "../../utils/roleRedirect.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Message left by api.js when a school was deactivated while the user was logged in.
  const [serverError, setServerError] = useState(() => sessionStorage.getItem("loginNotice") || "");

  // The notice is shown once, so remove it after the first render.
  useEffect(() => {
    sessionStorage.removeItem("loginNotice");
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const user = await login(data);
      toast.success(`Welcome back, ${user.firstName}!`);
      const redirectTo = location.state?.from || getDashboardPath(user.role);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="text-2xl font-bold text-center mb-1">School Management System</h1>
          <p className="text-center text-sm opacity-70 mb-4">Sign in to your account</p>

          <Alert message={serverError} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="you@school.com"
                className={`input input-bordered w-full ${errors.email ? "input-error" : ""}`}
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <span className="text-error text-xs mt-1">{errors.email.message}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`input input-bordered w-full ${errors.password ? "input-error" : ""}`}
                {...register("password", { required: "Password is required" })}
              />
              {errors.password && (
                <span className="text-error text-xs mt-1">{errors.password.message}</span>
              )}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="link link-primary text-xs">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            Is your school new here?{" "}
            <Link to="/register" className="link link-primary">
              Register your school
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
