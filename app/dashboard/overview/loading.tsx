export default function OverviewLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border glass-card p-6 space-y-3"
          >
            <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs */}
        <div className="rounded-2xl border glass-card p-6 space-y-4">
          <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2"
              >
                <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Applications */}
        <div className="rounded-2xl border glass-card p-6 space-y-4">
          <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2"
              >
                <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
