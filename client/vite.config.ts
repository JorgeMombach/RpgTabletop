import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos próprios: mudam pouco e ficam em cache entre versões do app.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/](konva|react-konva)[\\/]/.test(id)) return "konva";
          if (/[\\/]@mantine[\\/]/.test(id)) return "mantine";
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
        },
      },
    },
  },
  server: {
    port: 5173,
    // Em dev os jogadores também acessam por aqui (LAN/VPN).
    host: true,
    open: true,
    // O servidor de dev fica na 3999 (`npm run dev -w server`), não na 3000: assim o app do mestre
    // pode ficar aberto ao mesmo tempo sem o Vite falar com ele por engano.
    proxy: {
      // xfwd repassa o IP real do cliente; o servidor usa isso para decidir quem é mestre.
      "/socket.io": { target: "http://localhost:3999", ws: true, xfwd: true },
      // Arquivos da pasta de sons do mestre (E25).
      "/sons": { target: "http://localhost:3999" },
    },
  },
});
