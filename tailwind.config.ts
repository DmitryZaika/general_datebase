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
          "Arial",
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
            h1: {
              marginTop: "1em",
              marginBottom: "0.5em",
              fontWeight: "700",
            },
            h2: {
              marginTop: "1em",
              marginBottom: "0.5em",
              fontWeight: "600",
            },
            h3: {
              marginTop: "1em",
              marginBottom: "0.5em",
              fontWeight: "600",
            },
            h4: {
              marginTop: "1em",
              marginBottom: "0.5em",
            },
            h5: {
              marginTop: "1em",
              marginBottom: "0.5em",
            },
            h6: {
              marginTop: "1em",
              marginBottom: "0.5em",
            },
            p: {
              marginTop: "0em",
              marginBottom: "0em",
            },
            ul: {
              listStyleType: "disc",
              paddingLeft: "1.5rem",
              marginTop: "0.5em",
              marginBottom: "0.5em",
            },
            ol: {
              listStyleType: "decimal",
              paddingLeft: "1.5rem",
              marginTop: "0.5em",
              marginBottom: "0.5em",
            },
            "ul > li::marker": {
              color: "#6366F1",
            },
            "ol > li::marker": {
              color: "#10B981",
            },
            a: {
              color: "#6366F1",
              textDecoration: "underline",
              "&:hover": {
                color: "#4F46E5",
              },
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
              marginTop: "1em",
              marginBottom: "1em",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            },
            blockquote: {
              borderLeftColor: "#D1D5DB",
              borderLeftWidth: "4px",
              paddingLeft: "1rem",
              fontStyle: "italic",
              marginTop: "1em",
              marginBottom: "1em",
            },
            hr: {
              borderColor: "#E5E7EB",
              marginTop: "1em",
              marginBottom: "1em",
            },
            table: {
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "1em",
              marginBottom: "1em",
            },
            thead: {
              borderBottom: "2px solid #E5E7EB",
            },
            "tbody tr": {
              borderBottom: "1px solid #E5E7EB",
            },
            th: {
              textAlign: "left",
              padding: "0.5rem",
              fontWeight: "600",
            },
            td: {
              padding: "0.5rem",
            },
            img: {
              marginTop: "1em",
              marginBottom: "1em",
              display: "block",
              maxWidth: "100%",
              height: "auto",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
