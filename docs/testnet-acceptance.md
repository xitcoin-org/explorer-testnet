# Xitcoin Public Testnet acceptance

Acceptance date: 2026-09-02

This record closes the public explorer and minimum transaction matrix for
`xitcoin-testnet-v2-1`. It is evidence for testnet readiness only and is not a
mainnet launch authorization.

## Network invariants

- Cosmos chain ID: `xitcoin-testnet-v2-1`
- EVM chain ID: `101089` (`0x18ae1`)
- Native asset: XTC
- Base denomination: `axtc`
- Decimals: 18
- Public validators: four
- Faucet amount: 10 XTC per accepted request

## Accepted public surfaces

- Ping dashboard, blocks, transactions, staking, governance, supply,
  parameters, consensus and faucet
- read-only Cosmos account and wallet portfolio surfaces
- Keplr and MetaMask network suggestion helper
- Blockscout blocks, transactions and account pages
- Xitcoin website, documentation and repository links

Empty governance, delegation, token-transfer or log tables are valid when the
queried account or transaction has no corresponding records. An empty table is
not accepted when its backing API reports matching data.

## On-chain evidence

| Operation | Result | Transaction |
|---|---|---|
| Faucet transfer | success, 10 XTC | `2ECF5641183254FC6734A13E2C51E78C22DD4F7BEDEAF861448F08C6897D3AC7` |
| Bank send | success | `4D630D10804F6406F645FE120FD85A57B9BACF8D9131604E100389CB3A54E37E` |
| Delegation | success | `6BBEBDE5C0B6050350FE3EA8C7478AA95E316AD8487BEDC94413656A6660614C` |
| Undelegation | success | `33DFDE8299BFBB77238999FEB9CCC400D2EEE59948D4947B1020408E0E3177AE` |
| Redelegation | success | `EA5BD8EDF5AFA3DC5424C7F352B4F5C337DAFD582558747B080A8CD69144B7D3` |
| EVM native self-transfer | success, 0.01 XTC | `0x68a63b7033d911c768ea3717f2678813c018d4aaddbcf4746ac42f23c62b2597` |

The earlier redelegation attempt
`EE566B996648197AB24B64A0299E156013DEF7BAC6FA5A45D022D7BD177F72AA`
failed on-chain with SDK code 11 because its fixed gas limit was insufficient.
It remains part of the immutable chain history and must not be described as a
successful operation. The successful retry above is the acceptance evidence.

## Explorer acceptance

- the Cosmos faucet transaction resolves and shows its sender, recipient and
  10 XTC amount;
- the Cosmos recipient account shows the 10 XTC receipt;
- Blockscout resolves the EVM transaction and account balance;
- Blockscout reports complete block indexing with ratio 1;
- unsupported internal-transaction tracing is disabled rather than simulated;
- advertising is disabled.

## Revalidation

Run the unified read-only check:

```bash
./scripts/verify-testnet-production.sh
```

This script does not sign, broadcast or submit a transaction.
