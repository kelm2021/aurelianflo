function readString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  return String(value);
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

module.exports = {
  buildRecommendedLocalPath,
  replaceExtension,
};
