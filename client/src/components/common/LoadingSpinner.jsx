export default function LoadingSpinner({ fullScreen = false }) {
  return (
    <div
      className={
        fullScreen
          ? "min-h-screen flex items-center justify-center"
          : "flex items-center justify-center p-8"
      }
    >
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  );
}
