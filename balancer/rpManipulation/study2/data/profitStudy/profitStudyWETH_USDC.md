# Profit study — configured pools (sender-filtered)

## Parameters
- Network: `ARBITRUM`
- Target wallet: `0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9`
- Pool count: 1
- valueUSD warning threshold: 200 bps
- Assumption: sender has exactly one ADD and one REMOVE per pool (single-leg round trip).

## Effective run config
```json
{
  "apiEndpoint": "https://api-v3.balancer.fi/",
  "network": "ARBITRUM",
  "wallet": "0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9",
  "poolIds": [
    "0x59011e07bbcf95fad46154f8d83963dfe4242ad6"
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
| `0x59011e07…242ad6` | 1 | 1 | 8925.91 | 9023.91 | 98 | 8896.67 | 127.24 | 1.43 |

## Event token prices (as-of each event timestamp)

### Pool `0x59011e07bbcf95fad46154f8d83963dfe4242ad6`
- ADD event `0xb6ba349214f48b0a…` at ts 1777993608 (tx `0xb6ba349214f48b0a3cdb78b050aa972d84d1232a74e67d26b2eddb8a8046bac1`)
  - token `0x82af49447d8a07e3bd95bd0d56f35241523fbab1`: priceTimestamp=1777993608, matchedPricePointTimestamp=1777993200, amount=2.010807, priceUsdAtEvent=2380.1, usdContribution=4785.92
  - token `0xaf88d065e77c8cc2239327c5edb3a432268e5831`: priceTimestamp=1777993608, matchedPricePointTimestamp=1777993200, amount=4140.723114, priceUsdAtEvent=0.999823, usdContribution=4139.99
- REMOVE event `0x4ba653d4dca5ff16…` at ts 1778001499 (tx `0x4ba653d4dca5ff16585a04a42d371e19cbfda33450400d1c1b662d6e3d8c874c`)
  - token `0x82af49447d8a07e3bd95bd0d56f35241523fbab1`: priceTimestamp=1778001499, matchedPricePointTimestamp=1778000400, amount=2.068985, priceUsdAtEvent=2365.59, usdContribution=4894.37
  - token `0xaf88d065e77c8cc2239327c5edb3a432268e5831`: priceTimestamp=1778001499, matchedPricePointTimestamp=1778000400, amount=4130.336117, priceUsdAtEvent=0.999807, usdContribution=4129.54
