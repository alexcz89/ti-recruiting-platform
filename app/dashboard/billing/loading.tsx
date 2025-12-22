export default function BillingLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-2xl border glass-card p-6 space-y-4">
        <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="flex items-end gap-2">
          <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border glass-card p-6 space-y-4"
          >
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div
                  key={j}
                  className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded"
                ></div>
              ))}
            </div>
            <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
