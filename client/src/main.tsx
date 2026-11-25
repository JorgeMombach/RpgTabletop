import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useT } from "./i18n";
import "./session";
import "./styles.css";
import { cssVariablesResolver, theme } from "./theme";
import { installGlCounters } from "./bench/glCounters";

/** Botões das confirmações (confirmAction) no idioma atual. */
function Modals({ children }: { children: ReactNode }) {
  const t = useT();
  return <ModalsProvider labels={{ confirm: t("common.confirm"), cancel: t("common.cancel") }}>{children}</ModalsProvider>;
}

// Teste de desempenho (docs/design/desempenho.md): só em desenvolvimento, com `?bench` no endereço. Os contadores da
// placa entram antes de o app criar o primeiro contexto WebGL.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("bench")) {
  installGlCounters();
  void import("./bench/bench").then((bench) => {
    window.rpgBench = bench;
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="dark">
      <Modals>
        <Notifications position="bottom-center" limit={4} autoClose={6000} />
        <App />
      </Modals>
    </MantineProvider>
  </StrictMode>,
);
