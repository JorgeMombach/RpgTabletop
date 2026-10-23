import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // App local: um bundle único (com Konva) é aceitável.
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    // Em dev os jogadores também acessam por aqui (LAN/VPN).
    host: true,
    open: true,
    proxy: {
      // xfwd repassa o IP real do cliente; o servidor usa isso para decidir quem é mestre.
      "/socket.io": { target: "http://localhost:3000", ws: true, xfwd: true },
    },
  },
});
