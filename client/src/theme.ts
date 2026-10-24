// Tema do app (ADR-15): Mantine com a identidade "Grimório sombrio" (E20, docs/design/guia-visual.md).
// Escala tipográfica 12/14/16/20/24, espaçamentos em múltiplos de 4 px,
// Alegreya Sans na interface e Cinzel (fantasia) só em títulos.
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  createTheme,
  Input,
  Modal,
  Notification,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Slider,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

/** Bronze envelhecido: [6] ação principal e bordas de destaque, [4] títulos e "na vez". */
const bronze: MantineColorsTuple = [
  "#fbf5ea",
  "#f2e6cd",
  "#e8d4ab",
  "#dcbd86",
  "#d8b47a",
  "#c19a62",
  "#a9844f",
  "#8c6b3f",
  "#6e5331",
  "#523d24",
];

/** Verde-cobre, a cor secundária: [6] selos e cura, [4] vida alta e 20 natural. */
const copper: MantineColorsTuple = [
  "#e3f4ee",
  "#c8eadd",
  "#9fd8c2",
  "#74c4a6",
  "#4fae8c",
  "#3c9a7a",
  "#2f7d65",
  "#24624f",
  "#1f4a3f",
  "#15342c",
];

/** Sangue: substitui o vermelho do Mantine (dano, remover, perigo). */
const red: MantineColorsTuple = [
  "#fbeaeb",
  "#f2c4c7",
  "#e58a8f",
  "#d8656c",
  "#c94a52",
  "#b83c44",
  "#a8323a",
  "#8c2930",
  "#6b2a30",
  "#3b1d22",
];

/**
 * Tinta, couro e pergaminho. No esquema escuro o Mantine usa:
 * [0] texto, [2] texto apagado, [4] bordas, [5] hover, [6] superfícies (placas), [7] campos/afundados.
 * O fundo da página (tinta) vem de `cssVariablesResolver`.
 */
const dark: MantineColorsTuple = [
  "#ece4d4",
  "#d9cfbd",
  "#b9ae9c",
  "#8a8073",
  "#3d3446",
  "#2b2433",
  "#1f1b25",
  "#16131b",
  "#141218",
  "#0f0d12",
];

/** Azul dos jogadores/aliados (#5ba3e6 na posição 5). Identifica combatentes: não muda com o tema. */
const player: MantineColorsTuple = [
  "#eaf3fc",
  "#cfe3f8",
  "#b0d0f3",
  "#8fbcee",
  "#73adea",
  "#5ba3e6",
  "#3f8cd6",
  "#2f74b8",
  "#235c96",
  "#184473",
];

/** Fundo da página em tinta (o Mantine usaria dark[7], que aqui é o tom dos campos). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: { "--mantine-color-body": "#141218" },
});

export const theme = createTheme({
  colors: { bronze, copper, red, dark, player },
  primaryColor: "bronze",
  primaryShade: { light: 6, dark: 6 },
  autoContrast: true,
  fontFamily: '"Alegreya Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "Cascadia Code", Consolas, monospace',
  headings: {
    fontFamily: '"Cinzel", "Alegreya Sans", serif',
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "24px", lineHeight: "1.3" },
      h2: { fontSize: "20px", lineHeight: "1.3" },
      h3: { fontSize: "16px", lineHeight: "1.35" },
      h4: { fontSize: "14px", lineHeight: "1.4" },
    },
  },
  fontSizes: { xs: "12px", sm: "14px", md: "16px", lg: "20px", xl: "24px" },
  spacing: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px" },
  radius: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  defaultRadius: "sm",
  fontWeights: { medium: "500", bold: "700" },
  cursorType: "pointer",
  components: {
    // Densidade de painel lateral: tudo em tamanho pequeno por padrão.
    Button: Button.extend({
      defaultProps: { size: "xs" },
      // Secundário em "couro claro", um tom acima da placa; principal em bronze com borda bronze claro.
      vars: (_theme, props) => ({
        root:
          props.variant === "default"
            ? { "--button-bg": "var(--mantine-color-dark-5)", "--button-hover": "#352d3f", "--button-bd": "1px solid var(--mantine-color-dark-4)" }
            : props.variant === undefined || props.variant === "filled"
              ? { "--button-bd": "1px solid var(--mantine-color-bronze-4)" }
              : {},
      }),
      styles: { root: { fontWeight: 700 } },
    }),
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: "subtle", color: "gray", size: "md" } }),
    Badge: Badge.extend({ styles: { root: { textTransform: "none", fontWeight: 700 } } }),
    TextInput: TextInput.extend({ defaultProps: { size: "xs" } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: "xs", hideControls: true } }),
    Textarea: Textarea.extend({ defaultProps: { size: "xs", autosize: true, minRows: 2 } }),
    Select: Select.extend({ defaultProps: { size: "xs", allowDeselect: false } }),
    Checkbox: Checkbox.extend({ defaultProps: { size: "xs" } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { size: "xs", fullWidth: true } }),
    Slider: Slider.extend({ defaultProps: { size: "sm", label: null } }),
    Text: Text.extend({ defaultProps: { size: "sm" } }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 300, multiline: true, maw: 280 } }),
    Paper: Paper.extend({ defaultProps: { withBorder: true, radius: "sm", p: "md", bg: "dark.6" } }),
    Modal: Modal.extend({
      defaultProps: { centered: true, radius: "md" },
      styles: {
        content: { border: "1px solid var(--mantine-color-bronze-6)" },
        title: { fontFamily: "Cinzel, serif", fontWeight: 700, color: "var(--mantine-color-bronze-4)" },
      },
    }),
    // Avisos como uma placa pequena: couro com borda bronze (perigo em sangue).
    Notification: Notification.extend({
      styles: (_theme, props) => ({
        root: {
          backgroundColor: "var(--mantine-color-dark-6)",
          border: `1px solid var(--mantine-color-${props.color === "red" ? "red" : "bronze"}-6)`,
          boxShadow: "0 6px 18px rgb(0 0 0 / 0.5)",
        },
      }),
    }),
    // Campos "afundados": um tom abaixo da placa em que estão.
    Input: Input.extend({ styles: { input: { backgroundColor: "var(--mantine-color-dark-7)" } } }),
  },
});
