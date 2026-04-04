function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createHeadlineMetric(label, value, unit, options = {}) {
  return {
    label,
    value,
    unit: unit ?? null,
    ...(options.emphasis ? { emphasis: options.emphasis } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
  };
}

function createTable(columns, rows, options = {}) {
  return {
    columns: Array.isArray(columns) ? [...columns] : [],
    rows: Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [],
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
  };
}

function createAssumptionsTable(rows, options = {}) {
  return createTable(["field", "value"], rows, options);
}

function createChartHint(chart, sourceTable, xKey, yKey, options = {}) {
  return {
    chart,
    source_table: sourceTable,
    x_key: xKey,
    y_key: yKey,
    ...options,
  };
}

function deriveWorkbookRows(tables) {
  const workbookRows = {};

  for (const [tableName, table] of Object.entries(tables || {})) {
    workbookRows[tableName] = Array.isArray(table?.rows)
      ? table.rows.map((row) => ({ ...row }))
      : [];
  }

  return workbookRows;
}

function buildStructuredReport({
  reportMeta,
  executiveSummary,
  headlineMetrics,
  tables,
  chartHints,
  exportArtifacts,
  result,
}) {
  const normalizedTables = isPlainObject(tables) ? tables : {};
  const derivedWorkbookRows = deriveWorkbookRows(normalizedTables);
  const normalizedExportArtifacts = isPlainObject(exportArtifacts) ? exportArtifacts : {};
  const workbookRows = isPlainObject(normalizedExportArtifacts.workbook_rows)
    ? {
        ...derivedWorkbookRows,
        ...normalizedExportArtifacts.workbook_rows,
      }
    : derivedWorkbookRows;

  return {
    report_meta: isPlainObject(reportMeta) ? reportMeta : {},
    executive_summary: Array.isArray(executiveSummary) ? executiveSummary : [],
    headline_metrics: Array.isArray(headlineMetrics) ? headlineMetrics : [],
    tables: normalizedTables,
    export_artifacts: {
      ...normalizedExportArtifacts,
      workbook_rows: workbookRows,
      chart_hints: Array.isArray(chartHints)
        ? chartHints
        : Array.isArray(normalizedExportArtifacts.chart_hints)
          ? normalizedExportArtifacts.chart_hints
          : [],
    },
    result: isPlainObject(result) ? result : {},
  };
}

module.exports = {
  buildStructuredReport,
  createAssumptionsTable,
  createChartHint,
  createHeadlineMetric,
  createTable,
};
