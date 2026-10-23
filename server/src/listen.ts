import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

function listenOnce(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    // Sem host explícito o Node escuta em IPv4 e IPv6 (localhost pode resolver para ::1).
    server.listen(port);
  });
}

/**
 * Escuta na porta pedida; se estiver ocupada, tenta as seguintes.
 * No Windows, portas reservadas pelo sistema dão EACCES: também pula.
 */
export async function listenWithFallback(server: Server, start: number, attempts = 20): Promise<number> {
  for (let i = 0; ; i++) {
    try {
      await listenOnce(server, start === 0 ? 0 : start + i);
      return (server.address() as AddressInfo).port;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code !== "EADDRINUSE" && code !== "EACCES") || i >= attempts - 1 || start === 0) throw err;
    }
  }
}
