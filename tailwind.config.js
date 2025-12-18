// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // 👈 importante para dark mode
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        'wide': '1200px', // Custom breakpoint for wide layouts
      },
      keyframes: {
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"], // 👈 fuente base
      },
      colors: {
        brand: {
          DEFAULT: "#082B33", // 👈 tu color principal
          light: "#608089",
          accent: "#10B981", // verde esmeralda
        },
        // Definiciones explícitas para backgrounds limpios
        background: "#ffffff", // blanco puro en modo claro
        foreground: "#18181b", // zinc-900 para texto
        card: "#ffffff", // cards blancas
        border: "#e4e4e7", // zinc-200
        muted: {
          DEFAULT: "#71717a", // zinc-500
          foreground: "#a1a1aa", // zinc-400
        },
      },
    },
  },
  plugins: [],
};