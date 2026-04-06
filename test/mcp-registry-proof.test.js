const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { execFileSync } = require("node:child_process");
const { generateKeyPairSync } = require("node:crypto");

test("mcp registry proof script derives proof material from a PEM private key", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-registry-proof-"));
  const pemPath = path.join(tempDir, "key.pem");

  try {
    const { privateKey } = generateKeyPairSync("ed25519");
    fs.writeFileSync(
      pemPath,
      privateKey.export({ type: "pkcs8", format: "pem" }),
      "utf8",
    );

    const output = execFileSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "mcp_registry_proof.js"),
        "--key",
        pemPath,
      ],
      { encoding: "utf8" },
    );

    const payload = JSON.parse(output);

    assert.match(payload.proof, /^v=MCPv1; k=ed25519; p=[A-Za-z0-9+/]+=*$/);
    assert.match(payload.privateKeyHex, /^[0-9a-f]{64}$/);
    assert.equal(payload.publicKeyBase64, payload.proof.split("p=")[1]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

