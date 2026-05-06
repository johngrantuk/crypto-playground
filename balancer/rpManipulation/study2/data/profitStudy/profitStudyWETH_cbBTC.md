# Profit study — configured pools (sender-filtered)

## Parameters
- Network: `BASE`
- Target wallet: `0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9`
- Pool count: 1
- valueUSD warning threshold: 200 bps
- Assumption: sender has exactly one ADD and one REMOVE per pool (single-leg round trip).

## Effective run config
```json
{
  "apiEndpoint": "https://api-v3.balancer.fi/",
  "network": "BASE",
  "wallet": "0x1d9d6e0169ae70e57beb44e4f1c18ffebd9773b9",
  "poolIds": [
    "0x903460c1e2441b9df1d625fc6b4608d6d513ced8"
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
| `0x903460c1…13ced8` | 1 | 1 | 20989.93 | 22115.11 | 1125.18 | 21062.29 | 1052.82 | 5 |

## Event token prices (as-of each event timestamp)

### Pool `0x903460c1e2441b9df1d625fc6b4608d6d513ced8`
- ADD event `0x8cda446eeaf0e337…` at ts 1777984155 (tx `0x8cda446eeaf0e3374f9a8bf7e52d694d7f71c10be4c3f05d969896e0f3eccbb1`)
  - token `0x4200000000000000000000000000000000000006`: priceTimestamp=1777984155, matchedPricePointTimestamp=1777982400, amount=4.460373, priceUsdAtEvent=2376.62, usdContribution=10600.61
  - token `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf`: priceTimestamp=1777984155, matchedPricePointTimestamp=1777982400, amount=0.128333, priceUsdAtEvent=80956, usdContribution=10389.32
- REMOVE event `0xd924ec6cd8125791…` at ts 1777995031 (tx `0xd924ec6cd81257919b21947512f1ac4e734d0969921677c8f6ca4b4983ea015a`)
  - token `0x4200000000000000000000000000000000000006`: priceTimestamp=1777995031, matchedPricePointTimestamp=1777993200, amount=4.296477, priceUsdAtEvent=2380.93, usdContribution=10229.61
  - token `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf`: priceTimestamp=1777995031, matchedPricePointTimestamp=1777993200, amount=0.146067, priceUsdAtEvent=81370, usdContribution=11885.5
