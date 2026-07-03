import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { google } from "googleapis";
import { getYouTubeConfig, type YouTubeConfig } from "../config/youtube.config";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export class YouTubeAuthService {
  constructor(private readonly config: YouTubeConfig = getYouTubeConfig()) {}

  createClient() {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(
        `Faltan credenciales de YouTube para el canal ${this.config.channel}.`,
      );
    }

    return new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
    );
  }

  async getAuthorizedClient() {
    const client = this.createClient();
    if (!fs.existsSync(this.config.tokenPath)) {
      throw new Error(
        `No existe el token OAuth para ${this.config.channel}. Ejecuta primero npm run youtube:auth -- --channel=${this.config.channel}.`,
      );
    }

    const token = JSON.parse(fs.readFileSync(this.config.tokenPath, "utf8"));
    client.setCredentials(token);
    return client;
  }

  async authorize(): Promise<void> {
    const client = this.createClient();
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: YOUTUBE_SCOPES,
    });

    const code = await this.waitForOAuthCode(authUrl);
    const { tokens } = await client.getToken(code);

    fs.mkdirSync(path.dirname(this.config.tokenPath), { recursive: true });
    fs.writeFileSync(
      this.config.tokenPath,
      JSON.stringify(tokens, null, 2),
      "utf8",
    );
  }

  private async waitForOAuthCode(authUrl: string): Promise<string> {
    const redirectUrl = new URL(this.config.redirectUri);
    const port = Number(redirectUrl.port);
    const host = redirectUrl.hostname;
    const expectedPath = redirectUrl.pathname;

    if (!Number.isSafeInteger(port) || port <= 0) {
      return this.askForManualCode(authUrl);
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((request, response) => {
        try {
          const requestUrl = new URL(
            request.url || "",
            this.config.redirectUri,
          );
          if (requestUrl.pathname !== expectedPath) {
            response.writeHead(404);
            response.end("Ruta OAuth no encontrada.");
            return;
          }

          const error = requestUrl.searchParams.get("error");
          if (error) {
            response.writeHead(400);
            response.end(`Autorizacion rechazada: ${error}`);
            reject(new Error(`OAuth rechazado: ${error}`));
            server.close();
            return;
          }

          const code = requestUrl.searchParams.get("code");
          if (!code) {
            response.writeHead(400);
            response.end("No se recibio codigo OAuth.");
            reject(new Error("No se recibio codigo OAuth."));
            server.close();
            return;
          }

          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(
            "<h1>Cuenta conectada</h1><p>Ya puedes volver a la terminal.</p>",
          );
          resolve(code);
          server.close();
        } catch (error) {
          reject(error);
          server.close();
        }
      });

      server.once("error", () => {
        this.askForManualCode(authUrl).then(resolve).catch(reject);
      });

      server.listen(port, host, () => {
        console.log(`Abre esta URL y autoriza el canal ${this.config.channel}:`);
        console.log(authUrl);
        console.log(`Esperando callback en ${this.config.redirectUri}`);
      });
    });
  }

  private async askForManualCode(authUrl: string): Promise<string> {
    console.log(`Abre esta URL y autoriza el canal ${this.config.channel}:`);
    console.log(authUrl);
    const rl = readline.createInterface({ input, output });
    try {
      const code = await rl.question("Pega aqui el codigo OAuth: ");
      return code.trim();
    } finally {
      rl.close();
    }
  }
}
