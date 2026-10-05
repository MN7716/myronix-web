/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#202c65", deep: "#161f4b" },
        blue: { DEFAULT: "#5170ff", dark: "#3452e0" },
        pale: "#cad2ff",
        ink: "#14172b",
        mist: "#f4f5fb",
        line: "#e1e4f2",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        body: ['"DM Sans Variable"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
