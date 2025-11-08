// components/AvatarBubble.tsx
import clsx from "clsx"

type Props = {
  className?: string
  label: string
  emoji: string
  color?: "cyan" | "emerald" | "violet" | "sky"
}

const colorMap = {
  cyan:  "bg-cyan-500",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  sky: "bg-sky-400",
}

export default function AvatarBubble({ className, label, emoji, color = "cyan" }: Props) {
  return (
    <div className={clsx("select-none", className)}>
      <div className="relative">
        {/* “avatar” redondo simple */}
        <div className={clsx("h-40 w-40 rounded-full ring-8 ring-white/10 flex items-center justify-center text-5xl", colorMap[color])}>
          {emoji}
        </div>

        {/* chip flotante */}
        <div className="absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2">
          <div className="rounded-xl border border-white/10 glass-card p-4 md:p-6">
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}
