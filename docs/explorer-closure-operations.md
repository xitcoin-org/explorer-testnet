# Explorer public testnet: optional resources and operations

XTC on `xitcoin-testnet-v2-1` has no verified market quote. The CoinGecko
identifier previously selected a Cronos market and must not price testnet balances.
Missing quotes display `Non disponible`. Keybase artwork is optional; this testnet
uses an original generic local avatar. Wallet artwork falls back to an original
local wallet symbol on load failure. No external logo was newly copied. The unused legacy local Leap PNG was removed because its provenance was not documented in this repository.
The upstream Google Analytics tag was removed.

To prevent Cloudflare Web Analytics injecting a script disallowed by the existing
CSP, the explorer's Nginx `location /` must send:

```nginx
add_header Cache-Control "public, no-cache, no-transform" always;
```

This applies only to the explorer static location, not API/faucet proxies. Save the
old virtual host, validate with `nginx -t`, reload Nginx, and verify public responses
contain `no-transform` and no beacon injection. Restore the old virtual host on
any failure. CSP must not be relaxed. Cloudflare documents this behavior:
https://developers.cloudflare.com/web-analytics/faq/

Consensus uses CometBFT v0.39.4 `VoteSet.BitArrayString`: numerator is received
voting power and denominator is total voting power, not token units. The printed
fraction is rounded; calculate from numerator and denominator. Step 1 is
`RoundStepNewHeight`, waiting for commit timeout. Missing votes in this phase
are not proof of downtime. Only the current round is shown in the percentage.

The standard Cosmos SDK v0.54.4 staking Validator response does not contain
`validator_bond_shares` or `liquid_shares`; do not substitute `delegator_shares`.
The UI explains absent liquid staking fields. APR uses inflation × (1 − community
tax) × (1 − commission) × supply / bonded supply × 100, at constant parameters,
excluding fees/compounding. Invalid inputs are unavailable. Inflation and annual
provisions observed during closure were both zero.

Accessibility checks cover the announced desktop/mobile routes with axe-core
4.11.0, plus real keyboard navigation, named controls, table scrolling and
light-theme Wallet Helper. Automated tests are supplemented by screenshot review.
Wallet suggestion tests intercept `experimentalSuggestChain` and
`wallet_addEthereumChain` at the provider boundary; they do not claim certification
inside the browser extensions and never sign/broadcast transactions.
