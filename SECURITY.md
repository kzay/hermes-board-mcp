# Security Policy

## Supported Versions

Security fixes are provided for the latest published major version.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to the maintainers before opening a public issue.

Include:

- Affected package and version.
- Reproduction steps or proof of concept.
- Impact and any known mitigations.

Do not include bearer tokens, private repository URLs, or production Hermes project data in reports.

## Operational Notes

- Configure `BOARD_MCP_TOKENS` with strong bearer tokens.
- Set `BOARD_MCP_REQUIRE_AUTH=always` when loopback bypass is not acceptable.
- Keep the MCP server behind trusted infrastructure when exposing it outside loopback.
- Treat `HERMES_KANBAN_API_ALLOW_REMOTE=1` as a trusted-network-only setting.
