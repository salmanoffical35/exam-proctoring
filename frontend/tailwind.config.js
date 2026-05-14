/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#4f46e5", dark: "#4338ca" },
        danger:  { DEFAULT: "#ef4444", dark: "#dc2626" },
        warning: { DEFAULT: "#f59e0b", dark: "#d97706" },
        success: { DEFAULT: "#10b981", dark: "#059669" },
      }
    }
  },
  plugins: []
}
