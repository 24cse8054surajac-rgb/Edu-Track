import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(222 47% 6%)",
        foreground: "hsl(210 40% 98%)",
        card: "hsl(222 47% 9%)",
        border: "hsl(217 32% 17%)",
        primary: "hsl(160 84% 45%)",
        muted: "hsl(217 32% 17%)",
        accent: "hsl(200 90% 50%)",
        destructive: "hsl(0 84% 60%)",
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
