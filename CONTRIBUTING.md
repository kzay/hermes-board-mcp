# Contributing

Thanks for helping improve Hermes Board MCP.

## Developer Certificate of Origin

By contributing to this project, you certify that:

- (a) The contribution was created in whole or in part by you and you have the right to submit it under the MIT license; or
- (b) The contribution is based upon previous work that, to the best of your knowledge, is covered under an appropriate open-source license and you have the right under that license to submit that work with modifications; or
- (c) The contribution was provided directly to you by some other person who certified (a), (b), or (c), and you have not modified it.
- (d) You understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information you submit with it) is maintained indefinitely and may be redistributed consistent with this project or the open-source license(s) involved.

## How to Contribute

1. **Fork the repository** and create your branch from `master`.
2. **Make your changes** following the coding conventions below.
3. **Run all checks** before opening a PR (see Release Checks).
4. **Fill out the PR template** completely.
5. **Request review** from a CODEOWNER if changing core logic.

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

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Code Standards

- TypeScript `strict` mode, `module: NodeNext`
- Use Zod for tool input schemas
- Prefer immutable patterns; never mutate existing objects
- Functions should be under 50 lines
- Files should be under 800 lines
- Handle errors explicitly at every level

## Client Skills

Keep top-level skills workflow-oriented. Provider-specific details belong under `references/providers/` and must be covered by routing eval fixtures.

## Pull Request Requirements

- [ ] Tests pass (`npm test`)
- [ ] Release check passes (`npm run release:check`)
- [ ] No new vulnerabilities (`npm audit --omit=dev`)
- [ ] Documentation updated if user-facing changes
- [ ] CHANGELOG.md updated if applicable
- [ ] PR title follows conventional commit format

## External Actions

Do not publish npm packages, push tags, or make release changes without explicit maintainer approval.

## Community

Be respectful and constructive. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
