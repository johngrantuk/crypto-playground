## Collection Of Useful Subgraph Info/Queries

### Useful Info

https://api.thegraph.com/subgraphs/name/balancer-labs/balancer
https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2
https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2
https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2
https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2
Timurs: https://api.thegraph.com/subgraphs/name/destiner/balancer-kovan-v2

### Useful Queries

```
Pools with a specific token.

  pools(where: {tokensList_contains: ["0x21ff756ca0cfcc5fff488ad67babadffee0c4149"]}) {
    id
    owner
    address
    tokens {
      symbol
      balance
      address
      priceRate
    }
  }
```