# Anthropic Directory Checklist

Source verified on April 5, 2026 from Anthropic's Remote MCP Server Submission Guide:
[Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)

## Current Status

- Tool safety annotations: implemented in package code
- Streamable HTTP server: implemented
- Static server card: implemented at `/.well-known/mcp/server-card.json`
- Documentation with 3 examples: implemented in package README
- Privacy policy draft: created
- Support draft: created
- OAuth: not required for this package because there is no user-authenticated account state
- Test account: not required while OAuth is not required

## Remaining Submission Work

- Deploy the MCP server to a stable HTTPS URL
- Publish the README, privacy policy, and support docs at stable HTTPS URLs
- Verify CORS and public accessibility from Claude clients
- Test the deployed server from Claude.ai, Claude Desktop, and Claude Code
- Complete the Anthropic MCP Directory review form
