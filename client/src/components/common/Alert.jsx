// Small inline alert for form-level errors/success messages.
// (Toast notifications via react-hot-toast are used for transient events.)
export default function Alert({ type = "error", message }) {
  if (!message) return null;

  const styles = {
    error: "alert-error",
    success: "alert-success",
    info: "alert-info",
    warning: "alert-warning",
  };

  return (
    <div className={`alert ${styles[type] || styles.error} text-sm py-2`}>
      <span>{message}</span>
    </div>
  );
}
