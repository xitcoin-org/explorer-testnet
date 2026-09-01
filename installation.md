# Installation and deployment

This repository contains the official Ping-based explorer for the **Xitcoin Public Testnet**.

## Requirements

- Node.js 22
- Corepack
- Yarn 1.22.22
- Git

## Local development

```bash
corepack enable
yarn install --frozen-lockfile --ignore-engines
yarn serve
```

The development server uses the public Xitcoin testnet endpoints configured in
`chains/testnet/xitcoin-testnet.json`.

## Production build

```bash
corepack enable
yarn install --frozen-lockfile --ignore-engines
yarn build
```

`yarn build` runs the TypeScript check and the production Vite build. The
output is written to `dist/`.

Before publishing a build, verify:

- public network name: `Xitcoin Public Testnet`;
- Cosmos chain ID: `xitcoin-testnet-v2-1`;
- EVM chain ID: `101089` (`0x18ae1`);
- native asset: XTC, base denomination `axtc`, 18 decimals;
- faucet amount: exactly 10 XTC per accepted request;
- faucet endpoint: `/faucet-api`.

## Production deployment

Production releases are installed with `scripts/deploy-production.sh`. The
script requires `EXPECTED_COMMIT` to identify the exact Git commit being
deployed.

The deployment workflow:

1. downloads and checks out the expected source commit;
2. installs locked dependencies;
3. runs type-checking and the production build;
4. validates the faucet health and live Cosmos chain ID;
5. installs a timestamped release;
6. validates all public explorer routes;
7. switches the active Nginx symlink atomically.

If a validation fails after activation begins, the script restores the previous
release and Nginx configuration automatically.

The deployment script does not restart blockchain services and does not submit
transactions.

## Public verification

After deployment, verify:

- <https://explorer-testnet.xitcoin.org/>
- <https://explorer-testnet.xitcoin.org/xitcoin-testnet>
- <https://explorer-testnet.xitcoin.org/xitcoin-testnet/faucet>
- <https://explorer-testnet.xitcoin.org/faucet-api/healthz>
- <https://rpc-testnet.xitcoin.org/status>
- <https://api-testnet.xitcoin.org/cosmos/base/tendermint/v1beta1/node_info>
- <https://evm-rpc-testnet.xitcoin.org>

A healthy deployment reports `xitcoin-testnet-v2-1`, an advancing block height,
`catching_up: false`, and a funded faucet claim amount of 10 XTC.

## Security

Never commit secrets, recovery phrases, private keys, passwords, keyring data or
production environment files. Use only the public configuration values required
by the frontend.
