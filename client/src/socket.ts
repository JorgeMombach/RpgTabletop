import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@rpg/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Mesma origem: em produção o Express serve o client; em dev o Vite faz proxy.
export const socket: AppSocket = io();
