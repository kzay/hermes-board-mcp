# Contributing

Thanks for helping improve Hermes Board MCP.

## Development

```bash
npm install
npm test
npm run release:check
```

Use Node.js 20 or newer. The project uses TypeScript strict mode and `node:test`.

## Release Checks

Before opening a pull request, run:

```bash
npm test
npm run release:check
npm audit --omit=dev
```

For changes that affect worker dispatch, also run the Docker E2E suite when available:

```bash
npm run test:e2e:up
npm run test:e2e
npm run test:e2e:down
```

## Client Skills

Keep top-level skills workflow-oriented. Provider-specific details belong under `references/providers/` and must be covered by routing eval fixtures.

## External Actions

Do not publish npm packages, push tags, or make release changes without explicit maintainer approval.
