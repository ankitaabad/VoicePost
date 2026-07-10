import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  createTheme,
  Divider,
  Loader,
  type MantineColorsTuple,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

const brand: MantineColorsTuple = [
  "#eef2ff",
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#818cf8",
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81",
];

const accent: MantineColorsTuple = [
  "#f3e8ff",
  "#e9d5ff",
  "#d8b4fe",
  "#c084fc",
  "#a855f7",
  "#9333ea",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#4c1d95",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand, accent },

  cursorType: "pointer",
  autoContrast: true,
  respectReducedMotion: true,

  defaultGradient: {
    from: "brand",
    to: "accent",
    deg: 135,
  },

  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",

  fontWeights: {
    regular: "400",
    medium: "500",
    bold: "700",
  },

  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.375rem",
  },

  headings: {
    fontFamily:
      "Instrument Sans, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.2" },
      h2: { fontSize: "1.5rem", lineHeight: "1.25" },
      h3: { fontSize: "1.25rem", lineHeight: "1.3" },
      h4: { fontSize: "1.125rem", lineHeight: "1.35" },
      h5: { fontSize: "1rem", lineHeight: "1.4" },
      h6: { fontSize: "0.875rem", lineHeight: "1.45" },
    },
  },

  defaultRadius: "sm",

  shadows: {
    xs: "0 1px 2px rgba(0,0,0,0.04)",
    sm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
    xl: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04)",
  },

  components: {
    Button: Button.extend({
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          transition: "all 150ms ease",
          "&:hover:not(:disabled)": {
            transform: "translateY(-1px)",
            boxShadow: "var(--mantine-shadow-md)",
          },
          "&:active:not(:disabled)": {
            transform: "translateY(0)",
          },
        },
      },
    }),

    ActionIcon: ActionIcon.extend({
      styles: {
        root: {
          transition: "all 150ms ease",
          "&:hover": {
            transform: "translateY(-1px)",
          },
        },
      },
    }),

    TextInput: TextInput.extend({
      styles: {
        input: {
          borderWidth: "2px",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          "&:focus": {
            borderColor: "var(--mantine-color-brand-5)",
            boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.12)",
          },
        },
        label: {
          fontWeight: "600",
          fontSize: "0.875rem",
          marginBottom: "4px",
        },
      },
    }),

    PasswordInput: PasswordInput.extend({
      styles: {
        input: {
          borderWidth: "2px",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          "&:focus": {
            borderColor: "var(--mantine-color-brand-5)",
            boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.12)",
          },
        },
        label: {
          fontWeight: "600",
          fontSize: "0.875rem",
          marginBottom: "4px",
        },
      },
    }),

    Text: Text.extend({
      styles: {
        root: {
          lineHeight: "1.6",
        },
      },
    }),

    Anchor: Anchor.extend({
      styles: {
        root: {
          fontWeight: "500",
          transition: "color 150ms ease",
        },
      },
    }),

    Title: Title.extend({
      styles: {
        root: {
          letterSpacing: "-0.015em",
          textWrap: "balance",
        },
      },
    }),

    Paper: Paper.extend({
      defaultProps: {
        shadow: "sm",
        radius: "sm",
      },
    }),

    Card: Card.extend({
      defaultProps: {
        shadow: "sm",
        radius: "md",
        withBorder: true,
      },
      styles: {
        root: {
          transition: "box-shadow 150ms ease",
          "&:hover": {
            boxShadow: "var(--mantine-shadow-md)",
          },
        },
      },
    }),

    Divider: Divider.extend({
      defaultProps: {
        my: "md",
      },
    }),

    Loader: Loader.extend({
      defaultProps: {
        color: "brand",
      },
    }),
  },
});
