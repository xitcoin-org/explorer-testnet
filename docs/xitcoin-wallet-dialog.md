# Xitcoin SEND and DELEGATE dialogs

The native Xitcoin dialog receives its chain identity, endpoints and denomination
from `src/libs/xitcoinTransaction.ts`. SEND and DELEGATE on `xitcoin-testnet` use
this dialog; other actions retain the upstream widget.

## Root cause

At main `70557f79fcf3f3f80efa7049e10d5031a4a6d908`, the PR #16 keyboard adapter
set the widget checkbox's `checked` property without dispatching `change`.
Widget 0.3.12 initializes its Vue model and loads balances, latest block, staking
parameters and validators from that event. Bypassing it left the widget's internal
chain ID at its Cosmos Hub default, and denomination/validator state empty.
The upstream `TxDialog` props accept type, endpoint, sender, hdPath, registryName
and params; adding a chain-id HTML attribute alone would not fix its internal state.
The passed registryName was also a display name, not a Cosmos registry identifier.

The legacy adapter now dispatches the event without replacing Vue's listener.
The Xitcoin SEND/DELEGATE path uses a native dialog instead of depending on
widget internals or the external chain registry. Its chain ID is never inferred
from a wallet, and live REST/RPC chain identities must match the configured ID.

## Amounts and wallet boundary

XTC uses axtc and 18 decimals. Amount parsing uses BigInt, including sub-XTC dust;
scientific notation, negative amounts and excess precision are rejected. Delegate
loads bonded validators independently of wallet connection and follows pagination.
Malformed or incomplete data disables simulation and signing.

Xitcoin accounts expose `/cosmos.evm.crypto.v1.ethsecp256k1.PubKey`. Generic
Stargate simulation encodes a different public key type, so the local client
constructs protobuf messages with the explicit Xitcoin Cosmos EVM key type.
The account address and existing public key must match the connected wallet.
Simulation sends an empty signature to the REST simulation endpoint. It never
calls signDirect, signAmino or a broadcast endpoint.

Only the separate Sign and broadcast action can request a signature, after a
successful simulation. Form changes and wallet changes invalidate the estimate.
Signed document chain, account, body and auth info must remain identical to the
reviewed request before broadcasting. A synchronous broadcast is described as
submitted, not confirmed. No extension signing compatibility is claimed from the
instrumented tests, and no real signature or transaction is used for acceptance.

## Verification

Run `yarn test`, `yarn build`, `yarn audit`, and `yarn test:browser` with a preview
server on port 4176 (`yarn preview --host 0.0.0.0 --port 4176`). Install the pinned
Chromium using `yarn playwright install --with-deps chromium` when needed.
CI runs the same browser tests after building.

The browser harness uses a synthetic sender, balance and provider. The four real
validator names and operator addresses come from a read-only public API snapshot.
It intercepts the simulation response, decodes the request and checks empty
signatures, the Cosmos EVM public key type and exact axtc amounts. All other
non-read HTTP methods are blocked, and all provider signing methods throw.
The harness tests desktop/mobile, keyboard activation, focus trapping/restoration,
Escape, visible configuration and denomination, and axe WCAG A/AA checks. It also
exercises no wallet, provider rejection, API outage, wrong chain, malformed
validators/balance/account/simulation data. General explorer reads use the public
API, so that API must be reachable during the browser check.

Set `BASE` to test a candidate or public URL and `EVIDENCE_DIR` to retain JSON
results/screenshots elsewhere. These tests must pass on the exact candidate SHA
before merge and again on the public merged SHA before releasing the rollback gate.
