import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: "#000",
      },
      colors: {
        "action-high-blue-france": {
          DEFAULT: "var(--text-action-high-blue-france)",
          dark: "#8585f6",
          light: "#000091",
        },
        "alt-blue-france": {
          DEFAULT: "var(--background-alt-blue-france)",
          dark: "#1b1b35",
          light: "#f5f5fe",
        },
        "green-emeraude": {
          DEFAULT: "var(--green-emeraude-main-632)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
