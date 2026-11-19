import type {Config} from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        navy: "#0F172A",
        amber: "#D97706",
        verified: "#059669"
      },
      boxShadow: {
        card: "0 18px 50px -28px rgba(15, 23, 42, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
