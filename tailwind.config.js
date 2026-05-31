/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        graphite: "#243042",
        mint: "#2fbf9f",
        cobalt: "#2563eb",
        amberline: "#f4b740",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(17, 24, 39, 0.12)",
      },
    },
  },
  plugins: [],
};
