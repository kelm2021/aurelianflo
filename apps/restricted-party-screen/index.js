function getAppModule() {
  return require("./app");
}

function createApp(...args) {
  return getAppModule().createApp(...args);
}

function createMetricsAttribution(...args) {
  return getAppModule().createMetricsAttribution(...args);
}

function createMetricsDashboardHandler(...args) {
  return getAppModule().createMetricsDashboardHandler(...args);
}

function createMetricsDataHandler(...args) {
  return getAppModule().createMetricsDataHandler(...args);
}

function createMetricsMiddleware(...args) {
  return getAppModule().createMetricsMiddleware(...args);
}

function createMetricsStore(...args) {
  return getAppModule().createMetricsStore(...args);
}

function createPaymentGate(...args) {
  return getAppModule().createPaymentGate(...args);
}

function createRouteCatalog(...args) {
  return getAppModule().createRouteCatalog(...args);
}

function createRouteConfig(...args) {
  return getAppModule().createRouteConfig(...args);
}

function loadFacilitator(...args) {
  return getAppModule().loadFacilitator(...args);
}

function loadCoinbaseFacilitator(...args) {
  return getAppModule().loadCoinbaseFacilitator(...args);
}

module.exports = {
  createApp,
  createMetricsAttribution,
  createMetricsDashboardHandler,
  createMetricsDataHandler,
  createMetricsMiddleware,
  createMetricsStore,
  createPaymentGate,
  createRouteCatalog,
  createRouteConfig,
  loadFacilitator,
  loadCoinbaseFacilitator,
  get PAY_TO() {
    return getAppModule().PAY_TO;
  },
  get X402_NETWORK() {
    return getAppModule().X402_NETWORK;
  },
  get routeConfig() {
    return getAppModule().routeConfig;
  },
  get sellerConfig() {
    return getAppModule().sellerConfig;
  },
  get app() {
    return createApp();
  },
};
