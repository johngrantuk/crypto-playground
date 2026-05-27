# Balancer V3 Stable Pool Risky / Exclusion Spec

This document specifies how to identify **Balancer V3 stable** pools excluded from routing **because of risky surge policy** (`isRisky` in the liquidity tracker). Matches tracker behavior after #1409 / #1414 (expanded allowlist, token-pair-first evaluation, aggressive surge alone).

Use it to implement an audit script that **flags surge exclusions only** (`surge_excluded`). The script should **not** flag pools unavailable for other reasons (paused, recovery mode, invalid state, etc.) — those may be recorded as optional `context`.

**Implementation:** TypeScript at `balancer/api/stableSurgeRisky/`, run with `npx ts-node`. Data from Balancer API v3 GraphQL (`https://api-v3.balancer.fi/`).

**Tracker reference:** `pkg/liquidity-source/balancer/v3/stable/constant.go` (`nonNativesByChain`), `pool_tracker.go` (`isRisky`).

---

## 1. Scope

| Topic | Behavior |
|-------|----------|
| Pools evaluated | **All** Balancer V3 `STABLE` pools (not only `STABLE_SURGE` hook) |
| Surge parameters | From `hook.dynamicData` when `hook.type == "STABLE_SURGE"`; otherwise `max` / `threshold` are `null` |
| Primary outcome | `surge_excluded` = tracker `isRisky` equivalent |

A plain stable pool with WETH + USDC on Ethereum can be `surge_excluded` **without** the Stable Surge hook if the token-pair rule matches (Path 1).

---

## 2. Script outcomes

| Field | Meaning |
|-------|---------|
| `surge_excluded` | `true` if `is_risky` returns true (§5) |
| `exclusion_path` | `"token_pair"` \| `"aggressive_surge"` \| `null` — which path triggered exclusion |

When `surge_excluded` is `true`, set `reason` to `surge_risky`.

**Do not set `surge_excluded` for:** vault/pool paused, recovery mode, missing state, empty reserves from non-surge causes (optional `context` only).

---

## 3. Data sources (Balancer API v3)

Endpoint: `https://api-v3.balancer.fi/`

### 3.1 Active networks

Query these `GqlChain` values:

`ARBITRUM`, `AVALANCHE`, `BASE`, `GNOSIS`, `HYPEREVM`, `MAINNET`, `MONAD`, `OPTIMISM`, `PLASMA`

**Excluded** (do not query): `FANTOM`, `FRAXTAL`, `MODE`, `POLYGON`, `SEPOLIA`, `SONIC`, `XLAYER`, `ZKEVM`.

Discover **active** chains at runtime via `protocolMetricsAggregated(chains: [...])`; keep chains with `poolCount > 0`. Map `GqlChain` → numeric `chainId` from the response.

### 3.2 Per-pool fields (`poolGetPools`)

| Field | GraphQL path | Used for |
|-------|--------------|----------|
| Pool address | `address` | Reporting |
| Chain | `chain` | Reporting |
| Pool owner | `poolGetPool(...).owner` | Reporting for `surge_excluded` pools only (`poolGetPools` returns `owner: null`) |
| Chain ID | §3.1 mapping | §4, §5 |
| Hook type | `hook.type` | Surge param source |
| Token addresses | `poolTokens { address }` | §5 Path 1 |
| Max surge fee | `hook.dynamicData.maxSurgeFeePercentage` | §5 Paths 2–3 |
| Surge threshold | `hook.dynamicData.surgeThresholdPercentage` | §5 Paths 2–3 |
| TVL / volume | `dynamicData.totalLiquidity`, `volume24h` | Filter + output |
| Pause / recovery | `dynamicData.isPaused`, `isInRecoveryMode` | Optional context |

Surge fields are only populated when `hook.type == "STABLE_SURGE"`. For other stable pools, treat `max` and `threshold` as `null`.

### 3.3 Surge percentage format (API scale)

API returns unit fractions as decimal strings (`"0.05"` = 5%). §4–§5 use the **same scale** (equivalent to on-chain `0.1e18` → `0.1`).

```
function parse_api_percentage(value: string | null): number | null
```

Use `decimal.js` (or similar) for `feeSurgeRatio` division. Missing `hook.dynamicData` fields → `null`.

### 3.4 Local config (not from API)

| Field | Source |
|-------|--------|
| Wrapped-native per `chainId` | Script map; match **case-insensitively** |
| `non_natives_by_chain` per `chainId` | Script map (§4); addresses **lowercase**; lookup **case-sensitive** after normalizing token addresses to lowercase |

`waEth` / ERC4626 buffer tokens are **not** wrapped native unless they equal the chain’s canonical WETH address.

---

## 4. Constants

| Constant | Value (API scale) | On-chain equivalent |
|----------|-------------------|---------------------|
| `MIN_TVL_USD` | `10000` | — (API `minTvl` filter) |
| `ACCEPTABLE_MAX_SURGE_FEE` | `0.1` | `0.1e18` (10%) |
| `ACCEPTABLE_FEE_SURGE_RATIO` | `0.1` | `0.1e18` |

### `non_natives_by_chain`

Synced with tracker `nonNativesByChain`. All addresses **lowercase**. Normalize each pool token to lowercase before lookup.

Chains in §3.1 without a row below have an **empty** list (Path 1 cannot match on token pair alone).

**Arbitrum (42161)**

| Address | Label |
|---------|-------|
| `0xaf88d065e77c8cc2239327c5edb3a432268e5831` | USDC |
| `0xff970a61a04b1ca14834a43f5de4533ebddb5cc8` | USDC.e |
| `0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f` | WBTC |
| `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf` | cbBTC |

**Avalanche C-Chain (43114)**

| Address | Label |
|---------|-------|
| `0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e` | USDC |
| `0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664` | USDC.e |
| `0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7` | USDT |
| `0xc7198437980c041c805a1edcba50c1ce5db95118` | USDT.e |
| `0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab` | WETH.e |
| `0x152b9d0fdc40c096757f570a51e494bd4b943e50` | BTC.b |
| `0x50b7545627a5162f82a992c33b87adc75187b218` | WBTC.e |

**Base (8453)**

| Address | Label |
|---------|-------|
| `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | USDC |
| `0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca` | USDbC |
| `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf` | cbBTC |
| `0x0555e30da8f98308edb960aa94c0db47230d2b9c` | WBTC |

**Ethereum (1)**

| Address | Label |
|---------|-------|
| `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | USDC |
| `0xdac17f958d2ee523a2206206994597c13d831ec7` | USDT |

**HyperEVM (999)**

| Address | Label |
|---------|-------|
| `0xb88339cb7199b77e23db6e890353e22632ba630f` | USDC |
| `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` | USD₮0 |
| `0x111111a1a0667d36bd57c0a9f569b98057111111` | USDH |
| `0xbe6727b535545c67d5caa73dea54865b92cf7907` | UETH |

**Sonic (146)** — not in §3.1 query set; listed for tracker parity

| Address | Label |
|---------|-------|
| `0x29219dd400f2bf60e5a23d13be72b486d4038894` | USDC |

Implement as `balancer/api/stableSurgeRisky/nonNatives.ts` (`chainId` → `Set` of addresses).

---

## 5. Exclusion rule (`is_risky`)

`surge_excluded = is_risky(max, threshold, tokens, chain_id)`

### Fee surge ratio

```
function calculate_fee_surge_ratio(max, threshold):
  if threshold is null OR threshold >= 1: return 0
  return max / (1 - threshold)
```

### Algorithm (current — #1414 order)

```
function is_risky(max, threshold, tokens, chain_id):

  # Path 1 — token pair (first; ignores surge params)
  has_wrapped_native = false
  has_non_native = false
  for each token in tokens:
    t = lowercase(token)
    if is_wrapped_native(t, chain_id):          # case-insensitive
      if has_non_native: return true            # exclusion_path: token_pair
      has_wrapped_native = true
    else if t in non_natives_by_chain[chain_id]:  # case-sensitive after lowercasing t
      if has_wrapped_native: return true
      has_non_native = true

  # Path 2 — acceptable surge parameters
  if max is null OR threshold is null: return false
  fee_surge_ratio = calculate_fee_surge_ratio(max, threshold)
  if max <= ACCEPTABLE_MAX_SURGE_FEE
     AND fee_surge_ratio <= ACCEPTABLE_FEE_SURGE_RATIO:
    return false

  # Path 3 — aggressive surge alone (any chain)
  return true                                     # exclusion_path: aggressive_surge
```

**Path 1:** Wrapped native + any allowlisted non-native → excluded **immediately**, even with conservative surge (e.g. WETH + USDC on mainnet, `max = 0.05`).

**Path 2:** Null surge params or conservative surge → not excluded (unless Path 1 already returned).

**Path 3:** Aggressive surge with no Path 1 match → excluded on **any** chain (e.g. RLUSD + USDC on Ethereum, high max, no WETH).

### Legacy behavior (do not implement)

- Surge check before token pair
- Aggressive surge requiring allowlisted stable on same chain
- “Ethereum never surge-excluded” (empty mainnet allowlist)
- `STABLE_SURGE` hook-only evaluation

---

## 6. Decision summary

```
function evaluate_pool(pool, chain_id):
  max = null
  threshold = null
  if pool.hook?.type == "STABLE_SURGE":
    max = parse_api_percentage(pool.hook.dynamicData?.maxSurgeFeePercentage)
    threshold = parse_api_percentage(pool.hook.dynamicData?.surgeThresholdPercentage)

  tokens = pool.poolTokens.map(t => t.address.toLowerCase())
  { excluded, path } = is_risky_with_path(max, threshold, tokens, chain_id)

  return {
    surge_excluded: excluded,
    exclusion_path: path,
    reason: excluded ? "surge_risky" : null,
    owner: null,  # filled via poolGetPool for surge_excluded rows only
    hookType: pool.hook?.type ?? null,
    inputs: { max, threshold, feeSurgeRatio, hasWrappedNative, hasNonNative, ... },
    metrics: { totalLiquidity, volume24h },
    context: { isPoolPaused, isPoolInRecoveryMode },
  }
```

---

## 7. Output schema

```json
{
  "specVersion": "2.0.0",
  "activeChains": ["MAINNET", "BASE"],
  "pool": "0x...",
  "chain": "MAINNET",
  "chainId": 1,
  "owner": "0x...",
  "balancerUrl": "https://balancer.fi/pools/ethereum/v3/0x...",
  "hookType": "STABLE_SURGE",
  "surge_excluded": true,
  "exclusion_path": "token_pair",
  "reason": "surge_risky",
  "metrics": {
    "totalLiquidity": "125430.50",
    "volume24h": "48210.12"
  },
  "inputs": {
    "maxSurgeFeePercentage": "0.05",
    "surgeThresholdPercentage": "0.3",
    "feeSurgeRatio": "0.07142857142857142",
    "hasWrappedNative": true,
    "hasNonNative": true
  },
  "context": {
    "isPoolPaused": false,
    "isPoolInRecoveryMode": false
  }
}
```

Echo `metrics` on every row. `balancerUrl` is `https://balancer.fi/pools/{uiSlug}/v3/{pool}` where `uiSlug` maps from `GqlChain` (e.g. `MAINNET` → `ethereum`, `MONAD` → `monad`). Filter `surge_excluded == true` for flagged pools.

---

## 8. Pool discovery

```graphql
query StablePools($first: Int!, $skip: Int!, $chains: [GqlChain!]) {
  poolGetPools(
    first: $first
    skip: $skip
    where: {
      chainIn: $chains
      protocolVersionIn: [3]
      poolTypeIn: [STABLE]
      minTvl: 10000
    }
  ) {
    address
    chain
    hook {
      type
      address
      dynamicData {
        maxSurgeFeePercentage
        surgeThresholdPercentage
      }
    }
    poolTokens { address }
    dynamicData {
      totalLiquidity
      volume24h
      isPaused
      isInRecoveryMode
    }
  }
}
```

**Evaluate every** returned stable pool (§1). `minTvl: 10000` = TVL > $10k.

```
1. activeChains = discover_active_chains()
2. paginate poolGetPools(chainIn: activeChains, ...)
3. for each pool: evaluate_pool(pool, chainId)
4. for each surge_excluded pool: owner = poolGetPool(chain, address).owner
5. emit JSON / console summary
```

---

## 9. Test vectors

API-scale `max` / `threshold`. Token addresses lowercase in implementation.

| Case | max | threshold | Chain | Tokens | `surge_excluded` | Path |
|------|-----|-----------|-------|--------|------------------|------|
| WETH + USDC, low surge | `0.05` | `0.3` | 1 | WETH + USDC | `true` | token_pair |
| RLUSD + USDC, high surge, no WETH | `0.95` | `0.3` | 1 | RLUSD + USDC | `true` | aggressive_surge |
| RLUSD + USDC, low surge, no WETH | `0.05` | `0.3` | 1 | RLUSD + USDC | `false` | — |
| Aggressive surge + WETH + Base USDC | `0.95` | `0.3` | 8453 | WETH + Base USDC | `true` | token_pair |
| Missing surge params, no token pair | `null` | `null` | 1 | RLUSD only | `false` | — |
| Plain stable, WETH + USDC, no hook | `null` | `null` | 1 | WETH + USDC | `true` | token_pair |
| High surge, tokens not in allowlist, no WETH | `0.95` | `0.3` | 1 | exotic only | `true` | aggressive_surge |

**Ethereum quick reference**

| Composition | Surge | Excluded? |
|-------------|-------|-----------|
| WETH + USDC or USDT | Any | Yes (Path 1) |
| RLUSD + USDC, no WETH | High (e.g. 95% / 30%) | Yes (Path 3) |
| RLUSD + USDC, no WETH | Low (e.g. 5% / 30%) | No |

---

## 10. Out of scope

- Pause, recovery, invalid state, empty reserves (non-surge)
- On-chain RPC when API provides the field
- Balancer V2
- Live dynamic surge fee at quote time
- `IsPoolDisabled`, `!IsHookSupported` (tracker-only; not surge policy)

---

## 11. Versioning

| Version | Notes |
|---------|--------|
| `2.0.0` | Current: all V3 stable pools; `is_risky` paths 1–3; `non_natives_by_chain`; API scale |
| `1.x` | Legacy: `STABLE_SURGE` only, surge-before-tokens, Base-only allowlist, Ethereum never excluded |

Bump `specVersion` when thresholds (§4) or `is_risky` (§5) change. Do not compare `2.0.0` results to pre-#1409 / pre-#1414 runs.
