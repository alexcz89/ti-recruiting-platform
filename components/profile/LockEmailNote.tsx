// components/profile/LockEmailNote.tsx
import { Lock } from "lucide-react";

export default function LockEmailNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-950/20 dark:text-yellow-100">
      <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-yellow-300" />
      <p>
        Tu correo electrónico está vinculado a tu cuenta y{" "}
        <span className="font-medium">no puede modificarse</span> desde este
        formulario.
      </p>
    </div>
  );
}
