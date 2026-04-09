const { Redis } = require("@upstash/redis");
const { XMLParser } = require("fast-xml-parser");
const { buildDocumentArtifact } = require("../../../routes/auto-local/doc-artifacts");
const {
  buildBatchScreeningArtifactHints,
  buildBatchScreeningReport,
  buildEddArtifactHints,
  buildEddReport,
  buildWalletScreeningArtifactHints,
  buildWalletScreeningReport,
} = require("./report");

const OFAC_SDN_ADVANCED_XML_URL =
  "https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml";
const DEFAULT_TIMEOUT_MS = 30_000;
const DATASET_NAMESPACE = "ofac-wallet-screen:v1";
const DATASET_CACHE_KEY = `${DATASET_NAMESPACE}:dataset`;
const USER_AGENT =
  "aurelianflo-compliance/1.0 (+https://api.aurelianflo.com)";
const REFRESH_HOUR_UTC = 2;
const EVM_HEX_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: true,
});

const datasetCache = {
  promise: null,
  value: null,
  nextRefreshAt: 0,
};

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}

function textValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return normalizeString(value["#text"]);
  }

  return "";
}

function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    String(left).localeCompare(String(right)),
  );
}

function normalizeAsset(asset) {
  return normalizeString(asset).toUpperCase();
}

function normalizeWalletAddress(address) {
  const normalized = normalizeString(address);
  if (!normalized) {
    return "";
  }

  if (EVM_HEX_ADDRESS_PATTERN.test(normalized)) {
    return normalized.toLowerCase();
  }

  return normalized;
}

function buildIsoDate(dateNode) {
  if (!dateNode || typeof dateNode !== "object") {
    return null;
  }

  const year = Number.parseInt(normalizeString(dateNode.Year), 10);
  const month = Number.parseInt(normalizeString(dateNode.Month), 10);
  const day = Number.parseInt(normalizeString(dateNode.Day), 10);
  if (!Number.isFinite(year)) {
    return null;
  }

  const monthPart = Number.isFinite(month) ? String(month).padStart(2, "0") : "01";
  const dayPart = Number.isFinite(day) ? String(day).padStart(2, "0") : "01";
  return `${year}-${monthPart}-${dayPart}`;
}

function createRedisClient(options = {}) {
  const env = options.env ?? process.env;
  const url = options.url ?? env.KV_REST_API_URL ?? null;
  const token = options.token ?? env.KV_REST_API_TOKEN ?? null;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
    enableTelemetry: false,
  });
}

function buildAssetMap(root) {
  const featureTypes = asArray(
    root?.ReferenceValueSets?.FeatureTypeValues?.FeatureType,
  );
  const featureTypeById = new Map();

  for (const featureType of featureTypes) {
    const id = normalizeString(featureType?.ID);
    const label = textValue(featureType);
    if (!id || !label.startsWith("Digital Currency Address - ")) {
      continue;
    }
    featureTypeById.set(id, normalizeAsset(label.replace("Digital Currency Address - ", "")));
  }

  return featureTypeById;
}

function buildListNameMap(root) {
  const lists = asArray(root?.ReferenceValueSets?.ListValues?.List);
  return new Map(
    lists
      .map((entry) => [normalizeString(entry?.ID), textValue(entry)])
      .filter(([id, label]) => id && label),
  );
}

function buildSanctionsTypeMap(root) {
  const types = asArray(root?.ReferenceValueSets?.SanctionsTypeValues?.SanctionsType);
  return new Map(
    types
      .map((entry) => [normalizeString(entry?.ID), textValue(entry)])
      .filter(([id, label]) => id && label),
  );
}

function getAliasNames(identity) {
  const aliases = asArray(identity?.Alias);
  const aliasEntries = aliases
    .map((alias) => ({
      name: normalizeString(
        textValue(alias?.DocumentedName?.DocumentedNamePart?.NamePartValue),
      ),
      primary: normalizeString(alias?.Primary).toLowerCase() === "true",
    }))
    .filter((entry) => entry.name);

  const primaryAlias =
    aliasEntries.find((entry) => entry.primary)?.name ?? aliasEntries[0]?.name ?? "";
  const alternateAliases = uniqueSorted(
    aliasEntries.map((entry) => entry.name).filter((name) => name !== primaryAlias),
  );

  return {
    entityName: primaryAlias,
    aliases: alternateAliases,
  };
}

function buildSanctionsEntryMap(root, listNamesById, sanctionsTypeById) {
  const entries = asArray(root?.SanctionsEntries?.SanctionsEntry);
  const sanctionsEntryByProfileId = new Map();

  for (const entry of entries) {
    const profileId = normalizeString(entry?.ProfileID || entry?.ID);
    if (!profileId) {
      continue;
    }

    const measures = asArray(entry?.SanctionsMeasure);
    const measureNames = uniqueSorted(
      measures
        .map((measure) => sanctionsTypeById.get(normalizeString(measure?.SanctionsTypeID)))
        .filter(Boolean),
    );
    const programs = uniqueSorted(
      measures
        .filter(
          (measure) =>
            sanctionsTypeById.get(normalizeString(measure?.SanctionsTypeID)) === "Program",
        )
        .map((measure) => normalizeString(measure?.Comment))
        .filter(Boolean),
    );

    sanctionsEntryByProfileId.set(profileId, {
      entryId: normalizeString(entry?.ID),
      listName: listNamesById.get(normalizeString(entry?.ListID)) || "SDN List",
      listedOn: buildIsoDate(entry?.EntryEvent?.Date),
      measures: measureNames,
      programs,
    });
  }

  return sanctionsEntryByProfileId;
}

function buildAddressIndex(entries) {
  const byAddress = {};

  for (const entry of entries) {
    const key = entry.normalizedAddress;
    if (!byAddress[key]) {
      byAddress[key] = [];
    }
    byAddress[key].push(entry);
  }

  return byAddress;
}

function extractWalletDatasetFromXml(xmlText) {
  const normalizedXml = normalizeString(xmlText);
  if (!normalizedXml) {
    throw createHttpError("OFAC wallet dataset XML is empty.", 502);
  }

  const parsed = parser.parse(normalizedXml);
  const root = parsed?.SanctionsData || parsed?.Sanctions;
  if (!root) {
    throw createHttpError("OFAC wallet dataset XML could not be parsed.", 502);
  }

  const featureTypeById = buildAssetMap(root);
  const listNamesById = buildListNameMap(root);
  const sanctionsTypeById = buildSanctionsTypeMap(root);
  const sanctionsEntryByProfileId = buildSanctionsEntryMap(
    root,
    listNamesById,
    sanctionsTypeById,
  );

  const distinctParties = asArray(root?.DistinctParties?.DistinctParty);
  const dedupedEntries = new Map();

  for (const party of distinctParties) {
    const profile = party?.Profile || null;
    const profileId = normalizeString(profile?.ID || party?.FixedRef);
    const identity = profile?.Identity || null;
    const identityId = normalizeString(identity?.ID);
    const nameInfo = getAliasNames(identity);
    const sanctionsInfo =
      sanctionsEntryByProfileId.get(profileId) ||
      sanctionsEntryByProfileId.get(normalizeString(party?.FixedRef)) ||
      {
        entryId: profileId || identityId || null,
        listName: "SDN List",
        listedOn: null,
        measures: [],
        programs: [],
      };

    const features = [
      ...asArray(profile?.Feature),
      ...asArray(party?.Feature),
    ];

    for (const feature of features) {
      const asset = featureTypeById.get(normalizeString(feature?.FeatureTypeID));
      if (!asset) {
        continue;
      }

      const address = normalizeString(textValue(feature?.FeatureVersion?.VersionDetail));
      const normalizedAddress = normalizeWalletAddress(address);
      if (!normalizedAddress) {
        continue;
      }

      const entry = {
        entryId: sanctionsInfo.entryId,
        profileId,
        identityId,
        entityName: nameInfo.entityName || "Unknown sanctioned party",
        aliases: nameInfo.aliases,
        asset,
        address,
        normalizedAddress,
        listName: sanctionsInfo.listName,
        listedOn: sanctionsInfo.listedOn,
        measures: sanctionsInfo.measures,
        programs: sanctionsInfo.programs,
        sourceType: `Digital Currency Address - ${asset}`,
      };

      dedupedEntries.set(`${normalizedAddress}:${asset}:${profileId}`, entry);
    }
  }

  const entries = [...dedupedEntries.values()].sort((left, right) => {
    if (left.normalizedAddress !== right.normalizedAddress) {
      return left.normalizedAddress.localeCompare(right.normalizedAddress);
    }
    if (left.asset !== right.asset) {
      return left.asset.localeCompare(right.asset);
    }
    return left.entityName.localeCompare(right.entityName);
  });

  const uniqueAddresses = new Set(entries.map((entry) => entry.normalizedAddress));
  const coveredAssets = uniqueSorted(entries.map((entry) => entry.asset));

  return {
    sourceUrl: OFAC_SDN_ADVANCED_XML_URL,
    addressCount: uniqueAddresses.size,
    coveredAssets,
    entries,
    byAddress: buildAddressIndex(entries),
  };
}

function screenWalletAddress(dataset, query) {
  if (!dataset || !Array.isArray(dataset.entries)) {
    throw createHttpError("Wallet sanctions dataset is unavailable.", 503);
  }

  const address = normalizeString(query?.address);
  if (!address) {
    throw createHttpError("A wallet address is required.", 400);
  }

  const normalizedAddress = normalizeWalletAddress(address);
  const asset = normalizeAsset(query?.asset);
  const matches = asArray(dataset.byAddress?.[normalizedAddress])
    .filter((entry) => !asset || entry.asset === asset)
    .sort((left, right) => {
      if (left.asset !== right.asset) {
        return left.asset.localeCompare(right.asset);
      }
      return left.entityName.localeCompare(right.entityName);
    });

  return {
    query: {
      address,
      normalizedAddress,
      ...(asset ? { asset } : {}),
    },
    summary: {
      status: matches.length ? "match" : "clear",
      matchCount: matches.length,
      exactAddressMatch: matches.length > 0,
      manualReviewRecommended: matches.length > 0,
    },
    matches,
  };
}

function screenWalletAddressesBatch(dataset, query) {
  if (!dataset || !Array.isArray(dataset.entries)) {
    throw createHttpError("Wallet sanctions dataset is unavailable.", 503);
  }

  const addresses = Array.isArray(query?.addresses)
    ? query.addresses.map((address) => normalizeString(address)).filter(Boolean)
    : [];

  if (!addresses.length) {
    throw createHttpError("At least one wallet address is required.", 400);
  }

  if (addresses.length > 100) {
    throw createHttpError("Batch wallet screening supports up to 100 wallet addresses per request.", 400);
  }

  const asset = normalizeAsset(query?.asset);
  const results = addresses.map((address) =>
    screenWalletAddress(dataset, {
      address,
      ...(asset ? { asset } : {}),
    }),
  );
  const matchCount = results.filter((result) => result.summary?.status === "match").length;
  const totalScreened = results.length;
  const clearCount = totalScreened - matchCount;

  return {
    query: {
      addresses,
      normalizedAddresses: results.map((result) => result.query.normalizedAddress),
      ...(asset ? { asset } : {}),
    },
    summary: {
      totalScreened,
      matchCount,
      clearCount,
      manualReviewRecommended: matchCount > 0,
      workflowStatus:
        matchCount > 0 ? "manual_review_required" : "screening_complete_no_exact_match",
    },
    results,
  };
}

function buildScreeningResponse(screening, freshness) {
  const report = buildWalletScreeningReport(screening, freshness);
  const artifacts = buildWalletScreeningArtifactHints(report);

  return {
    success: true,
    data: {
      ...screening,
      sourceFreshness: freshness,
      screeningOnly: true,
      note:
        "This API screens exact wallet addresses against OFAC SDN digital currency address designations only. Hits require human compliance review before blocking or releasing funds.",
    },
    report,
    artifacts,
    source: "OFAC SDN Advanced XML",
  };
}

function buildBatchScreeningResponse(batch, freshness) {
  const report = buildBatchScreeningReport(batch, freshness);
  const artifacts = buildBatchScreeningArtifactHints(report);

  return {
    success: true,
    data: {
      ...batch,
      sourceFreshness: freshness,
      screeningOnly: true,
      note:
        "This API screens exact wallet addresses against OFAC SDN digital currency address designations only. Any hit requires human compliance review before clearing onboarding or funds movement.",
    },
    report,
    artifacts,
    source: "OFAC SDN Advanced XML",
  };
}

function buildEddResponse(caseContext, batch, freshness) {
  const report = buildEddReport(caseContext, batch, freshness);
  const artifacts = buildEddArtifactHints(report);

  return {
    success: true,
    data: {
      case: report.result.case || caseContext,
      workflowStatus: report.result.workflowStatus,
      evidenceSummary: Array.isArray(report.result.evidenceSummary)
        ? report.result.evidenceSummary
        : [],
      requiredFollowUp: Array.isArray(report.result.requiredFollowUp)
        ? report.result.requiredFollowUp
        : [],
      screening: {
        ...batch,
        sourceFreshness: freshness,
      },
      note:
        "This memo supports human compliance review and audit workflows. It does not provide legal advice or a final compliance determination.",
    },
    report,
    artifacts,
    source: "OFAC SDN Advanced XML",
  };
}

async function buildBundledEddResponse(caseContext, batch, freshness, outputFormat) {
  const bundled = buildEddResponse(caseContext, batch, freshness);
  const normalizedFormat = normalizeString(outputFormat).toLowerCase();

  if (!normalizedFormat || normalizedFormat === "json") {
    return bundled;
  }

  const artifactPath =
    normalizedFormat === "docx"
      ? "/api/tools/report/docx/generate"
      : "/api/tools/report/pdf/generate";
  const artifactPayload = await buildDocumentArtifact({
    path: artifactPath,
    endpoint: `POST ${artifactPath}`,
    title: bundled.report?.report_meta?.title || "Enhanced Due Diligence Memo",
    body: bundled.report,
  });

  return {
    ...bundled,
    output_format: normalizedFormat,
    output: artifactPayload.data,
  };
}

function getNextRefreshTimestamp(fromDate = new Date()) {
  const next = new Date(fromDate);
  next.setUTCHours(REFRESH_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= fromDate.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime();
}

async function fetchText(url, options = {}) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable in this runtime.");
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
        "User-Agent": USER_AGENT,
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw createHttpError(
        `OFAC wallet dataset request failed with status ${response.status}`,
        502,
      );
    }

    return {
      text,
      lastModified: normalizeString(response.headers?.get?.("last-modified")) || null,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError("OFAC wallet dataset request timed out.", 504);
    }
    if (error.statusCode) {
      throw error;
    }
    throw createHttpError(
      `OFAC wallet dataset request failed: ${error.message || "Unknown upstream error"}`,
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function hydrateCachedDataset(payload) {
  if (!payload || !Array.isArray(payload.entries)) {
    return null;
  }

  return {
    sourceUrl: payload.sourceUrl || OFAC_SDN_ADVANCED_XML_URL,
    addressCount: payload.addressCount ?? new Set(payload.entries.map((entry) => entry.normalizedAddress)).size,
    coveredAssets: Array.isArray(payload.coveredAssets) ? payload.coveredAssets : uniqueSorted(payload.entries.map((entry) => entry.asset)),
    entries: payload.entries,
    byAddress: payload.byAddress || buildAddressIndex(payload.entries),
    refreshedAt: payload.refreshedAt || null,
    datasetPublishedAt: payload.datasetPublishedAt || null,
  };
}

async function fetchWalletDataset(options = {}) {
  const { text, lastModified } = await fetchText(
    options.url || OFAC_SDN_ADVANCED_XML_URL,
    options,
  );
  const dataset = extractWalletDatasetFromXml(text);
  const refreshedAt = new Date().toISOString();
  return hydrateCachedDataset({
    ...dataset,
    refreshedAt,
    datasetPublishedAt: lastModified ? new Date(lastModified).toISOString() : refreshedAt,
  });
}

async function loadWalletDataset(options = {}) {
  const now = Date.now();
  if (datasetCache.value && datasetCache.nextRefreshAt > now) {
    return datasetCache.value;
  }

  if (datasetCache.promise) {
    return datasetCache.promise;
  }

  datasetCache.promise = (async () => {
    const redis = options.redis === undefined ? createRedisClient(options) : options.redis;
    if (redis) {
      const cachedPayload = await redis.get(DATASET_CACHE_KEY);
      const cachedDataset = hydrateCachedDataset(cachedPayload);
      if (cachedDataset) {
        const refreshedAt = Date.parse(cachedDataset.refreshedAt || "");
        const nextRefreshAt = Number.isFinite(refreshedAt)
          ? getNextRefreshTimestamp(new Date(refreshedAt))
          : 0;
        if (nextRefreshAt > now) {
          datasetCache.value = cachedDataset;
          datasetCache.nextRefreshAt = nextRefreshAt;
          datasetCache.promise = null;
          return cachedDataset;
        }
      }
    }

    const dataset = await fetchWalletDataset(options);
    datasetCache.value = dataset;
    datasetCache.nextRefreshAt = getNextRefreshTimestamp(new Date());

    if (redis) {
      await redis.set(DATASET_CACHE_KEY, dataset, {
        ex: 60 * 60 * 36,
      });
    }

    datasetCache.promise = null;
    return dataset;
  })().catch((error) => {
    datasetCache.promise = null;
    throw error;
  });

  return datasetCache.promise;
}

function buildSourceFreshness(dataset) {
  return {
    sourceUrl: dataset?.sourceUrl || OFAC_SDN_ADVANCED_XML_URL,
    refreshedAt: dataset?.refreshedAt || null,
    datasetPublishedAt: dataset?.datasetPublishedAt || null,
    addressCount: dataset?.addressCount ?? 0,
    coveredAssets: Array.isArray(dataset?.coveredAssets) ? dataset.coveredAssets : [],
  };
}

function resetDatasetCache() {
  datasetCache.promise = null;
  datasetCache.value = null;
  datasetCache.nextRefreshAt = 0;
}

module.exports = {
  DATASET_CACHE_KEY,
  OFAC_SDN_ADVANCED_XML_URL,
  USER_AGENT,
  buildBatchScreeningResponse,
  buildEddResponse,
  buildBundledEddResponse,
  buildScreeningResponse,
  buildSourceFreshness,
  createHttpError,
  extractWalletDatasetFromXml,
  fetchWalletDataset,
  loadWalletDataset,
  normalizeAsset,
  normalizeString,
  normalizeWalletAddress,
  resetDatasetCache,
  screenWalletAddressesBatch,
  screenWalletAddress,
};
