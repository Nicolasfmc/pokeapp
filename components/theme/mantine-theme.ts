import { createTheme, type MantineColorsTuple } from "@mantine/core";

const ember: MantineColorsTuple = [
  "#fff8ef",
  "#ffefd9",
  "#ffd9a8",
  "#ffc174",
  "#ffab4a",
  "#f59a2e",
  "#e08a1c",
  "#bc7112",
  "#98590d",
  "#7a470b",
];

const ink: MantineColorsTuple = [
  "#f2f5f8",
  "#e4eaf0",
  "#c5d2df",
  "#a3b8cd",
  "#7f9bb8",
  "#6485a5",
  "#516f8c",
  "#425a71",
  "#36495c",
  "#0b1624",
];

export const mantineTheme = createTheme({
  primaryColor: "ember",
  colors: {
    ember,
    ink,
  },
  fontFamily: "var(--font-source-sans), ui-sans-serif, sans-serif",
  fontFamilyMonospace: "var(--font-ibm-plex-mono), ui-monospace, monospace",
  headings: {
    fontFamily: "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    fontWeight: "700",
  },
  defaultRadius: "md",
  cursorType: "pointer",
});
