# Validator profile data

Profiles distinguish unavailable data from a real zero and from fields that do not apply to the validator status. Metadata comes only from the validator description; unsafe websites and malformed email addresses remain plain text. Missing fields display `Non disponible`.

The emission APR estimate is `inflation × (1 − community tax) × (1 − commission) × supply / bonded tokens`. It uses a successful inflation API response, matching supply denomination, and validated parameters. It excludes transaction fees and compounding and does not guarantee returns. Real zero inflation produces 0%; unavailable or invalid inputs produce `Non disponible`.

Token conversion uses the configured asset display unit without floating-point arithmetic. One axtc remains exactly `0.000000000000000001 XTC`. Shares are accounting units, never labeled XTC: at most six fractional digits, with an approximation marker or a threshold display for tiny positive values; the raw value is available in the title. Missing liquid-staking fields do not establish either a zero balance or module support.

Unbonding height and absolute UTC completion time are shown only for `BOND_STATUS_UNBONDING`. Bonded and unbonded validators display `Non applicable`; missing active-unbonding data remains unavailable. Jailed requires an actual boolean. Commission data is validated before rendering the chart, preserving real zero rates.

Run `yarn test`, `yarn type-check`, and `yarn build` with the Node version in `.nvmrc`. Unit tests cover exact conversion, absent/malformed values, true zeros, statuses, shares, APR and metadata links. CI runs the unit tests before the existing build and audit. No chain configuration or transaction logic is changed.
