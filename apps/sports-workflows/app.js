const express = require("express");
const sellerConfig = require("./seller.config.json");
const primaryHandler = require("./handlers/primary");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      service: sellerConfig.serviceName,
      routes: sellerConfig.routes.map((route) => route.key),
    });
  });

  for (const route of sellerConfig.routes) {
    const method = String(route.method || "").toLowerCase();
    if (!method || typeof app[method] !== "function") {
      continue;
    }
    app[method](route.expressPath, primaryHandler);
  }

  return app;
}

module.exports = {
  createApp,
};
