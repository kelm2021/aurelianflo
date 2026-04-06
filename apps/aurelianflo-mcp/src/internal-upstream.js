import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const rootAppPath = path.resolve(here, "../../../app.js");

let internalServerPromise;

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

async function startInternalServer() {
  const { createApp } = require(rootAppPath);
  const app = createApp({
    env: process.env,
    enableDebugRoutes: false,
    paymentGate: (_req, _res, next) => next(),
    mercTrustMiddleware: null,
  });

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address !== "object") {
    server.close();
    throw new Error("Failed to start internal AurelianFlo app.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const closeServer = () => {
    if (server.listening) {
      server.close();
    }
  };
  process.once("exit", closeServer);

  return baseUrl;
}

export async function getUpstreamBaseUrl() {
  const configuredBaseUrl = normalizeBaseUrl(process.env.AURELIANFLO_MCP_UPSTREAM_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!internalServerPromise) {
    internalServerPromise = startInternalServer();
  }

  return internalServerPromise;
}
