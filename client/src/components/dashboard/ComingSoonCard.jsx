// Honest placeholder for dashboard sections whose underlying data model
// (Attendance, Grades, Announcements, Classes...) hasn't been built yet in
// the phase plan. Used instead of showing fake/mocked charts.
export default function ComingSoonCard({ title, description }) {
  return (
    <div className="card bg-base-100 shadow border border-dashed border-base-300">
      <div className="card-body items-center text-center py-10">
        <h3 className="card-title text-base opacity-70">{title}</h3>
        <p className="text-sm opacity-50 max-w-xs">{description}</p>
      </div>
    </div>
  );
}
