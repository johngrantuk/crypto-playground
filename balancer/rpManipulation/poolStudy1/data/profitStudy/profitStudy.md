# Pool Study 1 Profit Study

## Inputs
- Pool ID: `0x10bdbb4fe8dfd348d44397eedabb737df68bc9a0000200000000000000000248`
- LP: `0x91906be1391d2fc7d01a7a6757c69daaefd2c257`
- Join tx: `0xe93dc163fe50bf7d0c89c0fbe53c448150f3b4849d21abc0f8445faa61c10848` (block `44714002`)
- Exit tx: `0x2ab83b7c31810138788d11d4be5adacbe7e9e00e78ab9b73f556d1ad0fa87ce3` (block `44755378`)

## Token Flows
- Join: 2.286 WETH + 48518 USDC
- Exit: 20.492630975323983 WETH + 9819.428165 USDC

## Price Selection (Uniswap spot + TWAP guard)
- Join block: spot=2337.980301, twap=2335.811961, deviationBps=9.28, selected=`spot`
- Exit block: spot=2361.120398, twap=2361.882595, deviationBps=3.23, selected=`spot`
- Threshold: 150 bps; TWAP window: 600 seconds

## Results
- Join value (USD): 53862.62
- Exit value (USD): 58205.00
- Realized PnL (USD): 4342.37
- Realized Return (%): 8.06

## HODL Benchmark
- HODL value at exit (USD): 53915.52
- LP minus HODL (USD): 4289.48
- LP minus HODL (%): 7.96

## Validation and Caveats
- BPT join/exit round-trip matches: yes
- BPT join delta: 53875720078069178534755; BPT exit delta: 53875720078069178534755
- USDC is valued at 1.00 USD by assumption.
- Gas cost inclusion is disabled.