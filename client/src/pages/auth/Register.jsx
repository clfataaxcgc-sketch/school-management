import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import Alert from "../../components/common/Alert.jsx";
import { getDashboardPath } from "../../utils/roleRedirect.js";

// A school signs up here. The backend creates the school AND its first admin
// account. After that, the admin signs in and creates teachers and students
// from the admin panel - there is no public sign-up for those roles.
export default function Register() {
  const { register: registerSchool } = useAuth();
  const navigate = useNavigate();
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
      const { confirmPassword, ...payload } = data;
      const user = await registerSchool(payload);
      toast.success("Your school is registered!");
      navigate(getDashboardPath(user.role), { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 py-8">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="text-2xl font-bold text-center mb-1">Register Your School</h1>
          <p className="text-center text-sm opacity-70 mb-4">
            Create your school and its admin account. After that you can add
            teachers and students from the admin panel.
          </p>

          <Alert message={serverError} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
            <h2 className="font-semibold text-sm uppercase opacity-60">School</h2>

            <div className="form-control">
              <label className="label">
                <span className="label-text">School Name</span>
              </label>
              <input
                className={`input input-bordered w-full ${errors.schoolName ? "input-error" : ""}`}
                {...register("schoolName", { required: "School name is required" })}
              />
              {errors.schoolName && (
                <span className="text-error text-xs mt-1">{errors.schoolName.message}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">School Email</span>
              </label>
              <input
                type="email"
                className={`input input-bordered w-full ${errors.schoolEmail ? "input-error" : ""}`}
                {...register("schoolEmail", { required: "School email is required" })}
              />
              {errors.schoolEmail && (
                <span className="text-error text-xs mt-1">{errors.schoolEmail.message}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">School Address</span>
                </label>
                <input className="input input-bordered w-full" {...register("schoolAddress")} />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Phone</span>
                </label>
                <input className="input input-bordered w-full" {...register("phone")} />
              </div>
            </div>

            <h2 className="font-semibold text-sm uppercase opacity-60 pt-2">Admin account</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">First Name</span>
                </label>
                <input
                  className={`input input-bordered w-full ${errors.firstName ? "input-error" : ""}`}
                  {...register("firstName", { required: "Required" })}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Last Name</span>
                </label>
                <input
                  className={`input input-bordered w-full ${errors.lastName ? "input-error" : ""}`}
                  {...register("lastName", { required: "Required" })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Admin Email</span>
              </label>
              <input
                type="email"
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
                  required: "Please confirm your password",
                  validate: (value) => value === password || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <span className="text-error text-xs mt-1">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Register School"}
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            Already registered?{" "}
            <Link to="/login" className="link link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
