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
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./session";
import "./styles.css";
import { cssVariablesResolver, theme } from "./theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="dark">
      <ModalsProvider labels={{ confirm: "Confirmar", cancel: "Cancelar" }}>
        <Notifications position="bottom-center" limit={4} autoClose={6000} />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
