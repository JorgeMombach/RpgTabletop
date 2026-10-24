// Tema do app (ADR-15): Mantine com as cores originais do Jamal's Tabletop.
// Escala tipográfica 12/14/16/20/24, espaçamentos em múltiplos de 4 px,
// Inter na interface e Cinzel (fantasia) só em títulos.
import {
  ActionIcon,
  Button,
  Checkbox,
  createTheme,
  Input,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Slider,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  type MantineColorsTuple,
} from "@mantine/core";

/** Dourado de destaque (#d4a24c na posição 5). */
const gold: MantineColorsTuple = [
  "#fbf5e9",
  "#f3e5c4",
  "#ead29c",
  "#e1be74",
  "#d9ad59",
  "#d4a24c",
  "#bc8c3a",
  "#a1762f",
  "#856024",
  "#6a4b19",
];

/**
 * Tons escuros do app. No esquema escuro o Mantine usa:
 * [0] texto, [2] texto apagado, [4] bordas, [5] hover, [6] superfícies/campos, [7] fundo da página.
 */
const dark: MantineColorsTuple = [
  "#e6e8ee",
  "#c3c7d1",
  "#8b92a5",
  "#6b7286",
  "#2f3442",
  "#242833",
  "#1c1f26",
  "#14161b",
  "#101216",
  "#0b0c0f",
];

/** Azul dos jogadores/aliados (#5ba3e6 na posição 5). */
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

export const theme = createTheme({
  colors: { gold, dark, player },
  primaryColor: "gold",
  primaryShade: { light: 6, dark: 5 },
  autoContrast: true,
  fontFamily: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "Cascadia Code", Consolas, monospace',
  headings: {
    fontFamily: '"Cinzel", "Inter Variable", serif',
    fontWeight: "600",
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
  // Mantine 9 mudou o "medium" para 600; 500 combina melhor com a Inter em tamanhos pequenos.
  fontWeights: { medium: "500" },
  cursorType: "pointer",
  components: {
    // Densidade de painel lateral: tudo em tamanho pequeno por padrão.
    Button: Button.extend({ defaultProps: { size: "xs" } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: "subtle", color: "gray", size: "md" } }),
    TextInput: TextInput.extend({ defaultProps: { size: "xs" } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: "xs", hideControls: true } }),
    Textarea: Textarea.extend({ defaultProps: { size: "xs", autosize: true, minRows: 2 } }),
    Select: Select.extend({ defaultProps: { size: "xs", allowDeselect: false } }),
    Checkbox: Checkbox.extend({ defaultProps: { size: "xs" } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { size: "xs", fullWidth: true } }),
    Slider: Slider.extend({ defaultProps: { size: "sm", label: null } }),
    Text: Text.extend({ defaultProps: { size: "sm" } }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 300, multiline: true, maw: 280 } }),
    Paper: Paper.extend({ defaultProps: { withBorder: true, radius: "md", p: "md", bg: "dark.6" } }),
    Modal: Modal.extend({ defaultProps: { centered: true, radius: "lg" } }),
    // Campos mais escuros que o painel em que estão.
    Input: Input.extend({ styles: { input: { backgroundColor: "var(--mantine-color-dark-7)" } } }),
  },
});
