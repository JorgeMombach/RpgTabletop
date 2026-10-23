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

/** Mestre = quem acessa pela própria máquina do servidor (ADR-09). */
export function roleOf(socket: Socket): Role {
  return isLoopback(clientAddress(socket)) ? "gm" : "player";
}

function isTailscale(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

export function hostInfo(port: number): HostInfo {
  const addresses: HostInfo["addresses"] = [];
  for (const [ifName, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      const label = isTailscale(info.address) ? `Tailscale (${ifName})` : ifName;
      addresses.push({ label, url: `http://${info.address}:${port}` });
    }
  }
  // VPN primeiro: é o endereço mais usado quando a mesa é remota.
  addresses.sort((a, b) => Number(b.label.startsWith("Tailscale")) - Number(a.label.startsWith("Tailscale")));
  return { port, addresses };
}
