# Explorer dependency remediation — 6 September 2026

The legacy dependency graph is replaced with the maintained versions already
validated for the Xitcoin Cosmos explorer. Yarn's locked audit reports zero
findings for the resulting graph; this does not establish that every browser
interaction is free of vulnerabilities.

The update adapts Markdown preview imports and TypeScript interfaces, replaces
the obsolete layout plugin with explicit default/blank layout selection, and
handles malformed proposal metadata without throwing during rendering. Optional
Leap name lookup is removed with its legacy dependency graph; account links,
JSON display, the faucet and Xitcoin network configuration are retained.

Local verification on Node 24.19.0 and Yarn 1.22.22:

- `yarn install --frozen-lockfile --ignore-scripts --non-interactive`: passed.
- `yarn type-check`: passed.
- `yarn build-only`: passed.
- `yarn audit --json`: zero findings.
- `actionlint` and individual shell syntax checks: passed.

CI uses the same Node version, pinned actions, locked dependencies and a blocking
Yarn audit. Dependency installation does not run lifecycle scripts or ignore
engine requirements. Browser end-to-end tests and deployment validation are not
claimed; no deployment or chain transaction was performed.
