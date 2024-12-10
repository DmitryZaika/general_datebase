import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          'Apple Color Emoji"',
          'Segoe UI Emoji"',
          'Segoe UI Symbol"',
          'Noto Color Emoji"',
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {},
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      typography: {
        DEFAULT: {
          css: {
            ul: {
              listStyleType: "disc",
              paddingLeft: "1.5rem",
            },
            ol: {
              listStyleType: "decimal",
              paddingLeft: "1.5rem",
            },
            "ul > li::marker": {
              color: "#6366F1",
            },
            "ol > li::marker": {
              color: "#10B981",
            },
            code: {
              backgroundColor: "#F3F4F6",
              padding: "0.2rem 0.4rem",
              borderRadius: "0.25rem",
              color: "#D6336C",
            },
            pre: {
              backgroundColor: "#F3F4F6",
              padding: "1rem",
              borderRadius: "0.5rem",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
