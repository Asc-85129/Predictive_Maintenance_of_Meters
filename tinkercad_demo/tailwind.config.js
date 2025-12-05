/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        panel: "#1f2937",
        panelDark: "#111827",
        gridBackground: "#0f172a"
      },
      boxShadow: {
        panel: "0 0 10px rgba(0,0,0,0.5)"
      }
    },
  },
  plugins: [],
};
