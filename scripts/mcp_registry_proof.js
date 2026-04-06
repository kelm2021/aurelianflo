#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  let keyPath = "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--key") {
      keyPath = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { help: true, keyPath: "" };
    }
    fail(`Unknown argument: ${token}`);
  }

  return { help: false, keyPath };
}

function deriveProofMaterialFromPem(pem) {
  const privateKey = crypto.createPrivateKey(pem);
  const publicKey = crypto.createPublicKey(privateKey);
  const privateJwk = privateKey.export({ format: "jwk" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const publicKeyBase64 = Buffer.from(publicJwk.x, "base64url").toString("base64");
  const privateKeyHex = Buffer.from(privateJwk.d, "base64url").toString("hex");

  return {
    proof: `v=MCPv1; k=ed25519; p=${publicKeyBase64}`,
    privateKeyHex,
    publicKeyBase64,
  };
}

function main() {
  const { help, keyPath } = parseArgs(process.argv.slice(2));
  if (help) {
    process.stdout.write("Usage: node scripts/mcp_registry_proof.js --key <path-to-pem>\n");
    return;
  }

  if (!keyPath) {
    fail("Missing required --key argument");
  }

  const resolvedPath = path.resolve(process.cwd(), keyPath);
  const pem = fs.readFileSync(resolvedPath, "utf8");
  const payload = deriveProofMaterialFromPem(pem);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  deriveProofMaterialFromPem,
};
