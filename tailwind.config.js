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
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"], // 👈 fuente base
      },
      colors: {
        brand: {
          DEFAULT: "#082B33", // 👈 tu color principal
          light: "#608089",
          accent: "#10B981", // verde esmeralda
        },
      },
    },
  },
  plugins: [],
};
