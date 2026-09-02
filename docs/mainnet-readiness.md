# Mainnet readiness gates

This document defines the blocking gates between the accepted public testnet
and a future Xitcoin mainnet. Completing testnet acceptance does not authorize a
mainnet launch, Cronos migration, bridge opening or movement of real assets.

## Gate 1: immutable network specification

- approve the final Cosmos and EVM chain IDs;
- approve the genesis file and publish its SHA-256 digest;
- freeze denomination, decimals, address prefixes and fee policy;
- verify total supply, allocations, vesting and authority accounts;
- freeze consensus, staking, slashing, governance and upgrade parameters;
- define the initial validator set and independent validator key ceremony.

Testnet keys, mnemonics, validator keys and faucet accounts must never be reused
on mainnet.

## Gate 2: reproducible release

- tag one audited source commit;
- build reproducible binaries for supported platforms;
- publish checksums and signatures;
- produce an SBOM and dependency vulnerability report;
- complete an independent security review;
- rehearse install, upgrade and rollback from the exact release artifacts.

## Gate 3: production infrastructure

- provision independent validators, sentries, snapshots and RPC services;
- restrict administrative access and test recovery through provider consoles;
- configure monitoring, alerting, backups and restore exercises;
- separate mainnet DNS, TLS, databases and secrets from testnet;
- deploy Cosmos and EVM explorers against read-only public endpoints;
- verify rate limits and denial-of-service protections.

## Gate 4: Cronos migration and bridge design

- freeze the authoritative Cronos contract and snapshot height;
- define eligibility, exclusions, rounding and duplicate-address handling;
- publish the mapping between Cronos EVM accounts and Xitcoin destinations;
- independently reconcile supply before and after migration;
- specify custody, multisignature, pause and emergency procedures;
- audit bridge or claim contracts and rehearse with valueless assets;
- publish user verification instructions before opening claims.

No real XTC movement is allowed until reconciliation, security review and the
final execution manifest are approved together.

## Gate 5: launch rehearsal

- generate a clean rehearsal genesis from the frozen specification;
- start the full topology from empty hosts;
- test blocks, transfers, staking, redelegation, undelegation, governance and
  EVM transactions;
- test explorer indexing from the first canonical block;
- test validator loss, sentry loss, RPC loss and backup restoration;
- record hashes and results in a signed launch report.

## Gate 6: final go/no-go

The launch remains blocked until one reviewed manifest contains:

- release tag and binary checksums;
- genesis hash and chain IDs;
- validator and infrastructure inventory;
- migration snapshot and reconciled totals;
- explorer, RPC and monitoring endpoints;
- rollback and incident contacts;
- explicit technical, security and supply approvals.

Execution must stop on any mismatch. Mainnet and Cronos transactions require a
separate, explicit authorization at the moment of execution.
