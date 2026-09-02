# Xitcoin EVM explorer operations

The canonical EVM explorer for the Xitcoin Public Testnet is Blockscout:

- Explorer: <https://evm-explorer-testnet.xitcoin.org>
- EVM JSON-RPC: <https://evm-rpc-testnet.xitcoin.org>
- EVM chain ID: `101089` (`0x18ae1`)
- Native asset: XTC with 18 decimals

## Canonical configuration

Apply `blockscout/xitcoin-compose.override.yml` after the upstream Blockscout
backend and frontend Compose files. It records the Xitcoin-specific invariants:

- `FIRST_BLOCK=1`: the Xitcoin EVM RPC exposes block 1 as its first canonical
  height. Requesting block 0 currently resolves to block 1, so indexing from the
  Blockscout default of 0 leaves the completion ratio permanently below 100%;
- internal transaction indexing and UI are disabled because the RPC does not
  expose `debug_traceTransaction` or `trace_transaction`;
- the advertising provider is disabled.

Do not hide the block-indexing alert to conceal an incomplete index. A healthy
instance must report `finished_indexing_blocks: true` and an indexed block ratio
of 1 before the alert is considered resolved.

## Compose deployment

On the platform host, combine the canonical override with the existing files:

```bash
app=/srv/kcalb/applications/xitcoin-blockscout-canonical-staging
project=xitcoin-blockscout-canonical

sudo docker compose -p "$project" \
  -f "$app/docker-compose.yml" \
  -f "$app/frontend-compose.yml" \
  -f "$app/xitcoin-compose.override.yml" \
  config --quiet
```

After backing up the active configuration, recreate only the Blockscout service
whose configuration changed. Never remove the PostgreSQL or Redis volumes.
Blockscout maintenance must not restart validator, sentry, Cosmos RPC or EVM RPC
services.

## Verification

Run the read-only public check from the repository root:

```bash
./scripts/verify-blockscout-production.sh
```

The expected result includes:

- EVM chain ID `0x18ae1`;
- `finished_indexing_blocks=true`;
- indexed block ratio equal to 1;
- an advancing positive indexed height;
- the known test transaction available with status `ok`.

The reference transaction is a native 0.01 XTC self-transfer. It has no ERC-20
token transfers or contract logs; empty token-transfer and log tabs are expected.

## Security and rollback

- Keep RPC credentials and private host addresses out of this repository.
- Never commit wallet keys, mnemonics, passwords or database credentials.
- Back up Compose configuration before applying an override.
- Recreate Blockscout containers with `--no-deps` when changing one service.
- Preserve the database and Redis volumes during every rollback.
- No verification command in this repository signs or submits transactions.
