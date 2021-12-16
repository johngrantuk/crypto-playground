Collection of snippets I've used that might be useful again.

### abi

Various ABIs.

* Vault.json - Balancer V2 Vault

### balancer

[Balancer Labs](https://github.com/orgs/balancer-labs/dashboard)

* queryBatchSwap - simulates a call to `batchSwap`.

* queryBatchSwapHelpers.ts - Helper function for more complicated queryBatchSwaps. i.e. multiple tokens in > single tokenOut.

* queryBatchSwapSor.ts - This uses the SOR helper queryBatchSwapTokensIn to find amount of BPT for tokens in.

* queryBatchSwapTs.ts - WIP. Simulates a batchSwap in TS, a series of swaps with one or multiple Pools.

* wrappedTokenRateProvider - gets rate for StaticATokenRateProvider

* sorBoostedPools.ts - Run a bunch of SOR trades for Boosted Pool paths to test.

* sorSwapExample.ts - Example of using SOR to query a swap.

* stablePool - operations on Balancer Stable Pool.
    + Get/Set Amp Factor

* weightedPool - operations on Balancer Weighted Pool.
    + Deploy new pool

* subgraphQueries - Useful Subgraph Info and Querie examples

### utils

* bignumber.js - Bignumber set up. scale/bnum functions. Constants.

## Useful Info

Adding package from github or local:

* yarn add sor-linear@file:/Users/jg/Documents/sor-sergio

* yarn add sor-linear@github:balancer-labs/balancer-sor#john/linear-package

* yarn add sor-linear@github:balancer-labs/balancer-sor#3d81174608949f8e669af13e7bceec77ba8a8f95