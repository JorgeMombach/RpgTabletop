// Versão única do app: vem do package.json raiz (o bundler embute só este campo).
import { version } from "../../package.json";

export const APP_VERSION: string = version;
