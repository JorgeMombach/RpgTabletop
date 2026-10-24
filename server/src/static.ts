import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

/**
 * Serve o front compilado (`dist/public`, `client/dist` ou, no app do mestre, a pasta de recursos do Electron).
 * Rotas desconhecidas devolvem o index.html (SPA).
 */
export function serveClient(app: Express, clientDist?: string) {
  if (!clientDist || !fs.existsSync(path.join(clientDist, "index.html"))) return;
  // Arquivos em assets/ têm hash no nome: podem ficar em cache para sempre.
  app.use(
    express.static(clientDist, {
      setHeaders: (res, file) => {
        const inAssets = path.relative(clientDist, file).startsWith("assets");
        res.setHeader("Cache-Control", inAssets ? "public, max-age=31536000, immutable" : "no-cache");
      },
    }),
  );
  app.use((_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}
