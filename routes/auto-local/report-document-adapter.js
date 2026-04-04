function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function toObject(value) {
  return isPlainObject(value) ? value : {};
}

function titleCase(value) {
  return readString(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sanitizeSheetName(value, fallback) {
  const base = readString(value, fallback).trim() || fallback;
  const withoutInvalidChars = base.replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (withoutInvalidChars || fallback).slice(0, 31);
}

function replaceExtension(pathValue, extension) {
  const normalizedPath = readString(pathValue).trim();
  const normalizedExtension = readString(extension).replace(/^\./, "").trim();
  if (!normalizedPath || !normalizedExtension) {
    return normalizedPath;
  }

  const extensionPattern = /\.[a-z0-9]+$/i;
  if (extensionPattern.test(normalizedPath)) {
    return normalizedPath.replace(extensionPattern, `.${normalizedExtension}`);
  }

  return `${normalizedPath}.${normalizedExtension}`;
}

function buildRecommendedLocalPath(pathValue, extension, fallbackFileName) {
  const normalizedPath = replaceExtension(pathValue, extension);
  if (normalizedPath) {
    return normalizedPath;
  }
  return `outputs/${readString(fallbackFileName, `document.${extension}`)}`;
}

function isStructuredReportPayload(payload) {
  const body = toObject(payload);
  return isPlainObject(body.report_meta)
    && (Array.isArray(body.executive_summary)
      || Array.isArray(body.headline_metrics)
      || isPlainObject(body.tables));
}

function extractStructuredReportPayload(payload) {
  const body = toObject(payload);
  if (isStructuredReportPayload(body)) {
    return body;
  }

  const nestedReport = toObject(body.report);
  if (isStructuredReportPayload(nestedReport)) {
    return nestedReport;
  }

  return {};
}

function getReportTitle(report) {
  const meta = toObject(report.report_meta);
  return readString(meta.title || meta.report_title || meta.name, "Structured Report");
}

function rowsFromTable(table) {
  const normalizedTable = toObject(table);
  if (Array.isArray(normalizedTable.rows)) {
    return normalizedTable.rows.map((row) => (isPlainObject(row) ? { ...row } : row));
  }
  return [];
}

function ensureObjectRows(rows, preferredColumns = []) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const objectRows = normalizedRows.filter((row) => isPlainObject(row)).map((row) => ({ ...row }));
  if (objectRows.length > 0) {
    return {
      headers: preferredColumns.length > 0
        ? preferredColumns
        : Array.from(
          objectRows.reduce((set, row) => {
            Object.keys(row).forEach((key) => set.add(key));
            return set;
          }, new Set()),
        ),
      rows: objectRows,
    };
  }

  const arrayRows = normalizedRows.filter((row) => Array.isArray(row));
  if (arrayRows.length > 0) {
    const headers = preferredColumns.length > 0
      ? preferredColumns
      : arrayRows[0].map((_cell, index) => `column_${index + 1}`);
    return {
      headers,
      rows: arrayRows.map((row) =>
        Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
      ),
    };
  }

  return { headers: preferredColumns, rows: [] };
}

function adaptReportToXlsxPayload(report) {
  const body = extractStructuredReportPayload(report);
  const workbookRows = toObject(body.export_artifacts).workbook_rows;
  const tables = toObject(body.tables);
  const sheets = [];

  const executiveSummary = Array.isArray(body.executive_summary)
    ? body.executive_summary.map((entry, index) => ({ order: index + 1, summary: readString(entry) }))
    : [];
  if (executiveSummary.length > 0) {
    sheets.push({
      name: "Executive Summary",
      headers: ["order", "summary"],
      rows: executiveSummary,
    });
  }

  const headlineMetrics = Array.isArray(body.headline_metrics)
    ? body.headline_metrics.filter((entry) => isPlainObject(entry)).map((entry) => ({ ...entry }))
    : [];
  if (headlineMetrics.length > 0) {
    sheets.push({
      name: "Headline Metrics",
      headers: ["label", "value", "unit"],
      rows: headlineMetrics,
    });
  }

  const workbookEntries = isPlainObject(workbookRows) ? workbookRows : {};
  for (const [key, value] of Object.entries(workbookEntries)) {
    const preferredColumns = Array.isArray(tables[key]?.columns)
      ? tables[key].columns.map((column) => readString(column))
      : [];
    const normalized = ensureObjectRows(value, preferredColumns);
    if (normalized.rows.length === 0) {
      continue;
    }
    const sheetName = sanitizeSheetName(titleCase(key), `Sheet${sheets.length + 1}`);
    if (sheets.some((sheet) => sheet.name === sheetName)) {
      continue;
    }
    sheets.push({
      name: sheetName,
      headers: normalized.headers,
      rows: normalized.rows,
    });
  }

  for (const [key, table] of Object.entries(tables)) {
    const rows = rowsFromTable(table);
    if (rows.length === 0) {
      continue;
    }
    const sheetName = sanitizeSheetName(titleCase(key), `Sheet${sheets.length + 1}`);
    if (sheets.some((sheet) => sheet.name === sheetName)) {
      continue;
    }
    const headers = Array.isArray(table.columns) ? table.columns.map((column) => readString(column)) : [];
    sheets.push({
      name: sheetName,
      headers,
      rows,
    });
  }

  return {
    title: getReportTitle(body),
    template: "general",
    sheets,
  };
}

function adaptReportToDocxPayload(report) {
  const body = extractStructuredReportPayload(report);
  const sections = [];

  if (Array.isArray(body.executive_summary) && body.executive_summary.length > 0) {
    sections.push({
      heading: "Executive Summary",
      bullets: body.executive_summary.map((entry) => readString(entry)),
    });
  }

  if (Array.isArray(body.headline_metrics) && body.headline_metrics.length > 0) {
    sections.push({
      heading: "Headline Metrics",
      table: body.headline_metrics
        .filter((entry) => isPlainObject(entry))
        .map((entry) => ({
          label: readString(entry.label),
          value: entry.value == null ? "" : readString(entry.value),
          unit: readString(entry.unit),
        })),
    });
  }

  for (const [key, table] of Object.entries(toObject(body.tables))) {
    const rows = rowsFromTable(table);
    if (rows.length === 0) {
      continue;
    }
    sections.push({
      heading: titleCase(key),
      table: rows.map((row) => {
        const normalized = {};
        for (const [field, value] of Object.entries(toObject(row))) {
          normalized[field] = value == null ? "" : readString(value);
        }
        return normalized;
      }),
    });
  }

  return {
    title: getReportTitle(body),
    template: "report",
    metadata: {
      author: readString(body.report_meta?.author || body.report_meta?.owner, ""),
      date: readString(body.report_meta?.date || "", ""),
      version: readString(body.report_meta?.version || "", ""),
    },
    sections,
  };
}

function formatMetricValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return readString(value);
}

function adaptReportToPdfPayload(report) {
  const body = extractStructuredReportPayload(report);
  const tables = [];

  if (Array.isArray(body.headline_metrics) && body.headline_metrics.length > 0) {
    tables.push({
      heading: "Headline Metrics",
      columns: ["label", "value", "unit"],
      rows: body.headline_metrics
        .filter((entry) => isPlainObject(entry))
        .map((entry) => ({
          label: readString(entry.label),
          value: formatMetricValue(entry.value),
          unit: readString(entry.unit),
        })),
    });
  }

  for (const [key, table] of Object.entries(toObject(body.tables))) {
    const rows = rowsFromTable(table);
    if (rows.length === 0) {
      continue;
    }
    const columns = Array.isArray(table.columns)
      ? table.columns.map((column) => readString(column))
      : Object.keys(toObject(rows[0]));
    tables.push({
      heading: titleCase(key),
      columns,
      rows: rows.map((row) => {
        const normalized = {};
        for (const column of columns) {
          const value = toObject(row)[column];
          normalized[column] = value == null ? "" : readString(value);
        }
        return normalized;
      }),
    });
  }

  return {
    title: getReportTitle(body),
    executiveSummary: Array.isArray(body.executive_summary)
      ? body.executive_summary.map((entry) => readString(entry))
      : [],
    tables,
    metadata: {
      report_type: readString(body.report_meta?.report_type || "", ""),
      author: readString(body.report_meta?.author || "", ""),
      details: stableStringify(toObject(body.report_meta)),
    },
  };
}

function readRecommendedLocalPath(payload) {
  const body = extractStructuredReportPayload(payload);
  return readString(toObject(body.export_artifacts).recommended_local_path, "").trim();
}

module.exports = {
  adaptReportToDocxPayload,
  adaptReportToPdfPayload,
  adaptReportToXlsxPayload,
  buildRecommendedLocalPath,
  extractStructuredReportPayload,
  isStructuredReportPayload,
  readRecommendedLocalPath,
  replaceExtension,
};
