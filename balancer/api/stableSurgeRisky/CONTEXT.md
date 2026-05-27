# Stable Surge Risky Audit

The audit identifies Balancer V3 stable pools that the KyberSwap aggregator's liquidity tracker would exclude from routing under its "risky surge policy." It mirrors `isRisky` in the tracker's `pool_tracker.go` and reports per-pool findings sourced from the Balancer v3 GraphQL API.

## Language

**Risky pool**:
A Balancer V3 stable pool the KyberSwap tracker would exclude from routing under the "risky surge policy" (see [SPEC.md](./SPEC.md) §5). Mirrors `isRisky` in the tracker's `pool_tracker.go`.
_Avoid_: surge-excluded pool, dangerous pool, bad pool

**Exclusion path**:
Which §5 rule fired to make a pool risky — `token_pair` (Path 1) or `aggressive_surge` (Path 3). `null` when the pool is not risky.
_Avoid_: reason, cause, trigger

**Non-native (token)**:
A token on the chain-specific `nonNativesByChain` allowlist (SPEC §4) — a mainstream stablecoin or BTC variant whose presence in a pool, paired with the wrapped native, triggers the `token_pair` exclusion path. Name is kept verbatim from the KyberSwap tracker constant for parity; the role is "Path 1 trigger token," not "any non-native token."
_Avoid_: stablecoin (too narrow — includes BTC variants), allowlisted token (inverts the role)

**Wrapped native**:
The canonical wrapped form of a chain's native asset (e.g. WETH on mainnet, WAVAX on Avalanche, WHYPE on HyperEVM). Identified by a per-chain address map; matching is case-insensitive. ERC4626 buffer tokens such as `waEth` are not wrapped native, even if they wrap WETH internally (SPEC §3.4).
_Avoid_: WETH (chain-specific), gas token, native token (those are the unwrapped form)

## Notes

The JSON output schema uses the field names `surge_excluded`, `exclusion_path`, and `reason: "surge_risky"` (SPEC §7). Treat these as wire-format identifiers, not as domain terms — when speaking or writing prose, use **risky pool** and **exclusion path**.

## Example dialogue

> **Dev**: This WETH + USDC pool on mainnet has no surge hook at all. Why is it flagged?
> **Domain expert**: It's still a risky pool — Path 1 (token-pair) doesn't care about surge parameters. WETH plus any allowlisted non-native makes it risky on its own.
> **Dev**: So its exclusion path is `token_pair`, not `aggressive_surge`.
> **Domain expert**: Right. `aggressive_surge` only fires when Path 1 didn't already match.
