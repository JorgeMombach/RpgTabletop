import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { getAsset, isSea } from "node:sea";

/** Lista dos arquivos do client embutidos no executável (gerada pelo `scripts/package.mjs`). */
export const SEA_MANIFEST = "client-manifest.json";
export const SEA_PREFIX = "client/";

function inSea(): boolean {
  try {
    return isSea();
  } catch {
    return false;
  }
}

/**
 * Serve o front: do disco (`dist/public` ou `client/dist`) ou, no executável (Node SEA, ADR-11),
 * dos assets embutidos. Rotas desconhecidas devolvem o index.html (SPA).
 */
export function serveClient(app: Express, clientDist?: string) {
  if (inSea()) return serveFromSea(app);
  if (!clientDist || !fs.existsSync(path.join(clientDist, "index.html"))) return;
  app.use(express.static(clientDist));
  app.use((_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

function serveFromSea(app: Express) {
  const names = JSON.parse(getAsset(SEA_MANIFEST, "utf8")) as string[];
  // Poucos arquivos (~1 MB): carrega tudo em memória uma vez.
  const files = new Map(names.map((name) => [name, Buffer.from(getAsset(SEA_PREFIX + name))]));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let name = decodeURIComponent(req.path).replace(/^\/+/, "");
    if (!files.has(name)) name = "index.html";
    const body = files.get(name);
    if (!body) return next();
    res.type(path.extname(name) || ".html");
    // Arquivos em assets/ têm hash no nome: podem ficar em cache para sempre.
    res.setHeader("Cache-Control", name.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    res.send(body);
  });
}
