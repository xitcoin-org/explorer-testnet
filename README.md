# Xitcoin Public Testnet Explorer

Official Cosmos explorer for the Xitcoin Public Testnet, built from the
standard [Ping Explorer](https://github.com/ping-pub/explorer) source.

- Public explorer: <https://explorer-testnet.xitcoin.org>
- Cosmos chain ID: `xitcoin-testnet-v2-1`
- EVM chain ID: `101089` (`0x18ae1`)
- Native asset: XTC
- Base denomination: `axtc`
- Decimals: 18
- Faucet: 10 XTC per accepted request

The public-facing network name is **Xitcoin Public Testnet**. The Cosmos chain
ID above is its technical identifier.

## Upstream baseline

The initial source import is based on Ping Explorer commit
`ca4adc028c796bd076a756544497aa391808f805`. Xitcoin-specific behavior is kept
small and isolated:

- `chains/testnet/xitcoin-testnet.json` defines the network endpoints and asset;
- `src/modules/[chain]/faucet/XitcoinFaucet.vue` provides the Xitcoin faucet UI;
- `/faucet-api` is a same-origin reverse proxy to the separately operated faucet
  service.

The faucet extension does not mint tokens. It requests transfers from the
finite funded testnet faucet account and enforces the server-side address and IP
limits.

## Development

Requirements:

- Node.js 22;
- Corepack;
- Yarn 1.22.22.

```bash
corepack enable
yarn install --frozen-lockfile --ignore-engines
yarn build
```

`yarn build` runs the TypeScript check and the production Vite build. The same
commands run in GitHub Actions for every change to `main` and every pull request.

## Public endpoints

| Service | Endpoint |
|---|---|
| CometBFT RPC | `https://rpc-testnet.xitcoin.org` |
| Cosmos REST API | `https://api-testnet.xitcoin.org` |
| gRPC | `grpc-testnet.xitcoin.org:443` |
| EVM JSON-RPC | `https://evm-rpc-testnet.xitcoin.org` |
| Faucet | `https://faucet-testnet.xitcoin.org` |

## Production deployment

`scripts/deploy-production.sh` requires an explicit `EXPECTED_COMMIT`, builds
that exact source commit, validates the
network and faucet configuration, installs a timestamped release, updates the
same-origin faucet proxy and switches the active Nginx symlink atomically. A
failed validation restores the previous site and Nginx configuration.

The deployment script does not restart blockchain services and does not submit
transactions.

## Security

- Never commit recovery phrases, private keys, keyring passwords or credentials.
- Testnet XTC has no monetary value.
- Verify the live RPC chain ID before signing or broadcasting.
- Report security issues through the process documented in the
  [Xitcoin Guide](https://xitcoin.gitbook.io/guide/security/responsible-disclosure).

## License and attribution

This repository remains licensed under the GNU General Public License v2.0.
Copyright and attribution for the Ping Explorer project and its contributors
are preserved in the source and license history.
