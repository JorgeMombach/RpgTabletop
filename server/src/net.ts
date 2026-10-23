import { timingSafeEqual } from "node:crypto";
import os from "node:os";
import type { Socket } from "socket.io";
import type { HostInfo, Role } from "@rpg/shared";

export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("::ffff:127.")
  );
}

/**
 * Endereço real do cliente. Em dev o Vite faz proxy (a conexão direta vem de
 * loopback), então só confiamos no X-Forwarded-For quando o par direto é loopback.
 */
export function clientAddress(socket: Socket): string | undefined {
  const direct = socket.handshake.address;
  if (isLoopback(direct)) {
    const fwd = socket.handshake.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  }
  return direct;
}

export interface RoleRules {
  /** Chave de mestre (ADR-12). */
  gmKey: string;
  /** localhost vira mestre (ADR-09). Desligado no Docker. */
  gmLoopback: boolean;
}

function sameKey(given: unknown, expected: string): boolean {
  if (typeof given !== "string" || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mestre = quem acessa pela máquina do servidor (ADR-09) ou traz a chave de mestre (ADR-12). */
export function roleOf(socket: Socket, rules: RoleRules, gmKey?: unknown): Role {
  if (sameKey(gmKey, rules.gmKey)) return "gm";
  return rules.gmLoopback && isLoopback(clientAddress(socket)) ? "gm" : "player";
}

function isTailscale(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

/** Endereços de convite: os fixos de `PUBLIC_URLS` ou os detectados nas interfaces de rede. */
export function hostInfo(port: number, gmKey: string, publicUrls: string[] = [], detect = true): HostInfo {
  if (publicUrls.length) {
    return { port, gmKey, addresses: publicUrls.map((url) => ({ label: "Configurado", url })) };
  }
  const addresses: HostInfo["addresses"] = [];
  if (!detect) return { port, gmKey, addresses };
  for (const [ifName, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      const label = isTailscale(info.address) ? `Tailscale (${ifName})` : ifName;
      addresses.push({ label, url: `http://${info.address}:${port}` });
    }
  }
  // VPN primeiro: é o endereço mais usado quando a mesa é remota.
  addresses.sort((a, b) => Number(b.label.startsWith("Tailscale")) - Number(a.label.startsWith("Tailscale")));
  return { port, gmKey, addresses };
}
