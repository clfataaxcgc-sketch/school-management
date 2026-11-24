// Generic KPI card used across the Admin dashboard (and reusable later for
// Teacher/Student dashboards). Pass `unavailable` for stats that
// depend on a model from a later phase — renders a muted "coming soon" state
// instead of a fabricated number.
export default function StatCard({ label, value, icon, unavailable, note }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-4 flex-row items-center gap-4">
        <div className="text-2xl text-primary bg-primary/10 rounded-full p-3 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide opacity-60">{label}</p>
          {unavailable ? (
            <>
              <p className="text-lg font-semibold opacity-40">—</p>
              {note && <p className="text-[11px] opacity-50 truncate">{note}</p>}
            </>
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
