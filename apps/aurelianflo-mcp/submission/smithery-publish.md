# Smithery Publish Notes

Smithery submission still depends on a deployed remote MCP endpoint. This package now provides the code and metadata needed for that deployment.

## What Is Ready

- Remote MCP server package under `apps/aurelianflo-mcp`
- Four-tool public surface focused on OFAC, simulation reports, and report artifacts
- Static server card for metadata fallback
- Documentation and example prompts

## Remaining Publish Steps

- Deploy the package to a stable HTTPS endpoint
- Verify the server card resolves at `/.well-known/mcp/server-card.json`
- Verify MCP connectivity from an external client
- Submit the deployed server through Smithery using the production URL and docs links
