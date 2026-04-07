import http from "node:http";

import { createAurelianFloMcpHandler } from "./index.js";
import { SERVER_CARD } from "./server-card.js";

function copyHeaders(fetchHeaders, response) {
  fetchHeaders.forEach((value, key) => {
    response.setHeader(key, value);
  });
}

async function toFetchRequest(request) {
  const origin = `http://${request.headers.host || "127.0.0.1"}`;
  const url = new URL(request.url || "/", origin);

  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body:
      request.method && !["GET", "HEAD"].includes(request.method.toUpperCase())
        ? request
        : undefined,
    duplex: "half",
  });
}

const handler = createAurelianFloMcpHandler();
const port = Number.parseInt(process.env.PORT || "3337", 10);

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/.well-known/mcp/server-card.json") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(SERVER_CARD, null, 2));
      return;
    }

    const fetchRequest = await toFetchRequest(request);
    const fetchResponse = await handler(fetchRequest);

    response.statusCode = fetchResponse.status;
    copyHeaders(fetchResponse.headers, response);

    if (!fetchResponse.body) {
      response.end();
      return;
    }

    for await (const chunk of fetchResponse.body) {
      response.write(chunk);
    }
    response.end();
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: "aurelianflo_mcp_server_error",
        details: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AurelianFlo server listening on http://0.0.0.0:${port}`);
});
