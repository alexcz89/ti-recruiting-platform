/**
 * Skeleton Loading Components
 * Used to show loading state while data is fetching
 */

export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700 ${className}`}
      {...props}
    />
  );
}

/**
 * Job Card Skeleton - matches JobsFeed.JobItem layout
 */
export function JobCardSkeleton() {
  return (
    <div className="space-y-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <div className="flex items-start gap-3">
        {/* Logo skeleton */}
        <Skeleton className="h-9 w-9 flex-shrink-0" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Title */}
          <Skeleton className="h-5 w-3/4" />

          {/* Company name */}
          <Skeleton className="h-4 w-1/2" />

          {/* Location */}
          <Skeleton className="h-3 w-2/3" />

          {/* Skills chips */}
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Job List Skeleton - multiple cards
 */
export function JobsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Dashboard KPI Card Skeleton
 */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" /> {/* Label */}
      <Skeleton className="h-8 w-1/2" /> {/* Value */}
      <Skeleton className="h-3 w-2/3" /> {/* Secondary */}
    </div>
  );
}

/**
 * Dashboard Stats Grid Skeleton
 */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Form Field Skeleton
 */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/4" /> {/* Label */}
      <Skeleton className="h-10 w-full" /> {/* Input */}
    </div>
  );
}

/**
 * Form Skeleton - multiple fields
 */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <FormFieldSkeleton key={i} />
      ))}
      <Skeleton className="h-10 w-full mt-6" /> {/* Submit button */}
    </div>
  );
}

/**
 * Table Row Skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-4 p-3 border-b border-zinc-200 dark:border-zinc-800">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-5 ${i === 0 ? "w-1/4" : "w-1/5"}`}
        />
      ))}
    </div>
  );
}

/**
 * Table Skeleton
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i === 0 ? "w-1/4" : "w-1/5"}`}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

/**
 * Avatar Skeleton (circular)
 */
export function AvatarSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];

  return <Skeleton className={`${sizeClass} rounded-full`} />;
}

/**
 * Badge/Chip Skeleton
 */
export function BadgeSkeleton() {
  return <Skeleton className="h-6 w-20 rounded-full" />;
}

/**
 * Text Skeleton - for paragraphs
 */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/**
 * Card Skeleton - generic card placeholder
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <TextSkeleton lines={2} />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
