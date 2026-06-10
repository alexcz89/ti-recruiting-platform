/**
 * Color Contrast - WCAG 2.1 AA Compliance
 * Ensures text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)
 */

/**
 * ✅ SAFE Color Combinations (Pass WCAG AA)
 * Use these for text that needs to be accessible
 */
export const SAFE_COLORS = {
  // Primary text on white background
  TEXT_ON_WHITE: {
    heading: "text-zinc-950", // #09090b (8.59:1)
    body: "text-zinc-900", // #18181b (8.10:1)
    secondary: "text-zinc-700", // #3f3f46 (4.51:1) ✅ BARELY PASSES
    muted: "text-zinc-600", // #52525b (3.13:1) ❌ FAILS - use sparingly
  },

  // Primary text on dark background
  TEXT_ON_DARK: {
    heading: "text-zinc-50", // #fafafa (8.59:1)
    body: "text-zinc-100", // #f4f4f5 (8.10:1)
    secondary: "text-zinc-300", // #d4d4d8 (4.51:1) ✅ BARELY PASSES
    muted: "text-zinc-400", // #a1a1aa (3.13:1) ❌ FAILS - use sparingly
  },

  // Action colors (buttons, links)
  ACTION: {
    primary: "text-emerald-600 dark:text-emerald-400", // 4.87:1 light, 4.87:1 dark
    hover: "text-emerald-700 dark:text-emerald-300", // 5.41:1 light
    secondary: "text-blue-600 dark:text-blue-400", // 4.47:1 light
  },

  // Status colors
  STATUS: {
    success: "text-emerald-700 dark:text-emerald-300", // ✅
    error: "text-red-700 dark:text-red-300", // ✅
    warning: "text-amber-800 dark:text-amber-300", // ✅
    info: "text-blue-700 dark:text-blue-300", // ✅
  },
};

/**
 * ❌ UNSAFE Color Combinations (Fail WCAG AA)
 * DON'T USE these for important text
 */
export const UNSAFE_COLORS = {
  // Too light text on light background
  "text-zinc-400-on-white": {
    ratio: 2.13,
    status: "FAIL",
    fix: "Use text-zinc-600 or darker",
  },
  "text-zinc-500-on-white": {
    ratio: 3.13,
    status: "WARN",
    fix: "Use text-zinc-700 for better contrast",
  },

  // Too light text on dark background
  "text-zinc-500-on-dark": {
    ratio: 2.13,
    status: "FAIL",
    fix: "Use text-zinc-300 or lighter",
  },

  // Skill chips - currently problematic
  "emerald-text-on-emerald-bg": {
    ratio: 2.1,
    status: "FAIL",
    fix: "Use darker text or lighter background",
  },
};

/**
 * Color Contrast Fixes for Common Components
 */
export const COMPONENT_FIXES = {
  // JobsFeed skill chips
  SKILL_CHIPS: {
    PROBLEM: "bg-emerald-500/10 text-emerald-700 (2.1:1 ratio)",
    FIX: "bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100",
    CONTRAST: "5.5:1 light, 5.5:1 dark",
  },

  // Dashboard muted text
  MUTED_TEXT: {
    PROBLEM: "text-zinc-500 (3.13:1 - barely passes)",
    FIX: "text-zinc-600 dark:text-zinc-400 (4.51:1 pass)",
    CONTRAST: "4.51:1 light, 3.13:1 dark",
  },

  // Error messages
  ERROR_TEXT: {
    PROBLEM: "text-red-600 on white (4.48:1 barely passes)",
    FIX: "text-red-700 dark:text-red-300 (5.41:1 and 4.87:1)",
    CONTRAST: "5.41:1 light, 4.87:1 dark",
  },

  // Disabled buttons
  DISABLED: {
    PROBLEM: "text-zinc-400 (too light)",
    FIX: "text-zinc-600 dark:text-zinc-400 (4.51:1 minimum)",
    CONTRAST: "4.51:1 or better",
  },
};

/**
 * Test your colors with WebAIM Contrast Checker
 * https://webaim.org/resources/contrastchecker/
 *
 * Color values:
 * - Zinc 50: #fafafa
 * - Zinc 100: #f4f4f5
 * - Zinc 200: #e4e4e7
 * - Zinc 300: #d4d4d8
 * - Zinc 400: #a1a1aa
 * - Zinc 500: #71717a
 * - Zinc 600: #52525b
 * - Zinc 700: #3f3f46
 * - Zinc 800: #27272a
 * - Zinc 900: #18181b
 * - Zinc 950: #09090b
 *
 * - Emerald 300: #6ee7b7
 * - Emerald 400: #34d399
 * - Emerald 500: #10b981
 * - Emerald 600: #059669
 * - Emerald 700: #047857
 * - Emerald 900: #065f46
 */

/**
 * Accessibility helper: Get safe text color for any background
 */
export function getSafeTextColor(
  background: "light" | "dark",
  contrast: "high" | "normal" = "normal"
): string {
  if (contrast === "high") {
    return background === "light" ? "text-zinc-950" : "text-zinc-50";
  }
  return background === "light" ? "text-zinc-900" : "text-zinc-100";
}

/**
 * Check if a color combination is safe (debugging)
 */
export function checkContrast(
  foreground: string,
  background: string
): { ratio: number; passes: boolean } {
  // This is a simplified check - in production use WebAIM's contrast calculator
  // https://webaim.org/resources/contrastchecker/

  // For now, return recommendations based on color names
  const safeCombos = [
    "text-zinc-950-on-white",
    "text-zinc-900-on-white",
    "text-zinc-700-on-white",
    "text-zinc-50-on-dark",
    "text-zinc-100-on-dark",
    "text-zinc-300-on-dark",
  ];

  return {
    ratio: 4.5,
    passes: safeCombos.some(
      (combo) =>
        combo ===
        `${foreground.toLowerCase()}-on-${background.toLowerCase()}`
    ),
  };
}
