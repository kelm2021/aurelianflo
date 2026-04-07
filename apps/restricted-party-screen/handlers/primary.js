const {
  buildBatchScreeningResponse,
  buildBundledEddResponse,
  buildEddResponse,
  buildScreeningResponse,
  buildSourceFreshness,
  createHttpError,
  loadWalletDataset,
  normalizeAsset,
  normalizeString,
  screenWalletAddressesBatch,
  screenWalletAddress,
} = require("../lib/ofac");

function parseScreeningQuery(req) {
  const address = normalizeString(req.params?.address || req.body?.address);
  if (!address) {
    throw createHttpError("A wallet address is required.", 400);
  }

  if (address.length < 10) {
    throw createHttpError("The wallet address must be at least 10 characters.", 400);
  }

  return {
    address,
    asset: normalizeAsset(req.query?.asset || req.body?.asset),
  };
}

function parseBatchScreeningQuery(req) {
  const addresses = Array.isArray(req.body?.addresses)
    ? req.body.addresses.map((address) => normalizeString(address)).filter(Boolean)
    : [];

  if (!addresses.length) {
    throw createHttpError("At least one wallet address is required.", 400);
  }

  return {
    addresses,
    asset: normalizeAsset(req.query?.asset || req.body?.asset),
  };
}

function parseEddQuery(req) {
  const subjectName = normalizeString(req.body?.subject_name);
  if (!subjectName) {
    throw createHttpError("A subject_name value is required for EDD reporting.", 400);
  }

  const addresses = Array.isArray(req.body?.addresses)
    ? req.body.addresses.map((address) => normalizeString(address)).filter(Boolean)
    : [];

  if (!addresses.length) {
    throw createHttpError("At least one wallet address is required.", 400);
  }

  const outputFormat = normalizeString(req.body?.output_format || req.query?.output_format).toLowerCase() || "json";
  if (!["json", "pdf", "docx"].includes(outputFormat)) {
    throw createHttpError("output_format must be one of json, pdf, or docx.", 400);
  }

  return {
    subjectName,
    caseName: normalizeString(req.body?.case_name),
    reviewReason: normalizeString(req.body?.review_reason),
    jurisdiction: normalizeString(req.body?.jurisdiction),
    requestedBy: normalizeString(req.body?.requested_by),
    referenceId: normalizeString(req.body?.reference_id),
    outputFormat,
    addresses,
    asset: normalizeAsset(req.query?.asset || req.body?.asset),
  };
}

function isBatchScreeningRequest(req) {
  const routePath = String(req.route?.path || req.path || "");
  return routePath.includes("batch-wallet-screen");
}

function isEddReportRequest(req) {
  const routePath = String(req.route?.path || req.path || "");
  return routePath.includes("edd-report");
}

function createPrimaryHandler(deps = {}) {
  const datasetLoader = deps.loadWalletDataset ?? loadWalletDataset;

  return async function primaryHandler(req, res) {
    try {
      const dataset = await datasetLoader();
      const freshness = buildSourceFreshness(dataset);

      if (isBatchScreeningRequest(req)) {
        const batch = screenWalletAddressesBatch(dataset, parseBatchScreeningQuery(req));
        return res.json(buildBatchScreeningResponse(batch, freshness));
      }

      if (isEddReportRequest(req)) {
        const caseContext = parseEddQuery(req);
        const batch = screenWalletAddressesBatch(dataset, {
          addresses: caseContext.addresses,
          asset: caseContext.asset,
        });
        return res.json(
          await buildBundledEddResponse(caseContext, batch, freshness, caseContext.outputFormat),
        );
      }

      const screening = screenWalletAddress(dataset, parseScreeningQuery(req));
      return res.json(buildScreeningResponse(screening, freshness));
    } catch (error) {
      const statusCode = error.statusCode ?? 502;
      res.status(statusCode).json({
        success: false,
        error: error.message || "OFAC wallet screening failed.",
      });
    }
  };
}

module.exports = createPrimaryHandler();
module.exports.createPrimaryHandler = createPrimaryHandler;
module.exports.parseEddQuery = parseEddQuery;
module.exports.parseBatchScreeningQuery = parseBatchScreeningQuery;
module.exports.parseScreeningQuery = parseScreeningQuery;
