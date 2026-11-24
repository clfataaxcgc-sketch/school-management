import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import authService from "../../services/authService.js";
import Alert from "../../components/common/Alert.jsx";

export default function ForgotPassword() {
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ email }) => {
    setServerError("");
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="text-2xl font-bold text-center mb-1">Forgot Password</h1>
          <p className="text-center text-sm opacity-70 mb-4">
            Enter your email and we&apos;ll send you a reset link
          </p>

          <Alert message={serverError} />

          {sent ? (
            <Alert
              type="success"
              message="If an account with that email exists, a reset link has been sent."
            />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email</span>
                </label>
                <input
                  type="email"
                  className={`input input-bordered w-full ${errors.email ? "input-error" : ""}`}
                  {...register("email", { required: "Email is required" })}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Send Reset Link"}
              </button>
            </form>
          )}

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
