# Profit study — configured pools (sender-filtered)

## Parameters
- Network: `MAINNET`
- Target wallet: `0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9`
- Pool count: 1
- valueUSD warning threshold: 200 bps
- Assumption: sender has exactly one ADD and one REMOVE per pool (single-leg round trip).

## Effective run config
```json
{
  "apiEndpoint": "https://api-v3.balancer.fi/",
  "network": "MAINNET",
  "wallet": "0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9",
  "poolIds": [
    "0x114516921fb229a1bcae2bde26248ca7cf5644ed"
  ],
  "poolEventsPageSize": 500,
  "historicalPricesBatchSize": 12,
  "valueUsdWarningThresholdBps": 200,
  "requestDelayMs": 80,
  "maxRequestRetries": 6,
  "retryBaseDelayMs": 1000,
  "retryMaxDelayMs": 60000,
  "outputJsonPath": "/Users/jg/Documents/code/crypto-playground/balancer/rpManipulation/study2/data/profitStudy/profitStudy.result.json",
  "outputMarkdownPath": "/Users/jg/Documents/code/crypto-playground/balancer/rpManipulation/study2/data/profitStudy/profitStudy.md",
  "gasOmissionNote": "Gas costs are omitted and are not subtracted from PnL values in this report."
}
```

## Note
Gas costs are omitted and are not subtracted from PnL values in this report.

## Included pools

| Pool (short) | Adds | Removes | Capital in (USD) | Capital out (USD) | PnL (USD) | HODL at exit (USD) | LP - HODL (USD) | LP - HODL (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0x11451692…5644ed` | 1 | 1 | 69723.35 | 71272.6 | 1549.25 | 69896.29 | 1376.31 | 1.97 |

## Event token prices (as-of each event timestamp)

### Pool `0x114516921fb229a1bcae2bde26248ca7cf5644ed`
- ADD event `0x76571b0738f20554…` at ts 1777984943 (tx `0x76571b0738f205546f2184aac10dae35fc6fbdf5f6d4b8d959f2b08962ac57a2`)
  - token `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599`: priceTimestamp=1777984943, matchedPricePointTimestamp=1777982400, amount=0.146053, priceUsdAtEvent=80557, usdContribution=11765.57
  - token `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`: priceTimestamp=1777984943, matchedPricePointTimestamp=1777982400, amount=24.386643, priceUsdAtEvent=2376.62, usdContribution=57957.78
- REMOVE event `0x2698941e2cb0435e…` at ts 1777995107 (tx `0x2698941e2cb0435e3db493630d62eb4f22db36d31cc450ee8ea43d095b06e943`)
  - token `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599`: priceTimestamp=1777995107, matchedPricePointTimestamp=1777993200, amount=0.44386, priceUsdAtEvent=81165, usdContribution=36025.93
  - token `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`: priceTimestamp=1777995107, matchedPricePointTimestamp=1777993200, amount=14.809088, priceUsdAtEvent=2380.07, usdContribution=35246.67
