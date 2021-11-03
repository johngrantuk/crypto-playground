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
All pools matching SOR query.

        pools: pools(
          first: 1000,
          where: { swapEnabled: true },
          orderBy: totalLiquidity,
          orderDirection: desc
        ) {
          id
          address
          poolType
          swapFee
          totalShares
          tokens {
            address
            balance
            decimals
            weight
            priceRate
          }
          tokensList
          totalWeight
          amp
          expiryTime
          unitSeconds
          principalToken
          baseToken
          swapEnabled
          wrappedIndex
          mainIndex
          lowerTarget
          upperTarget
        }

```


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

```
Pool of type.

  pools(where: {poolType: "Weighted"}) {
    id
    swapFee
    owner
    address
    tokens {
      symbol
      balance
      address
      priceRate
    }
    tokensList
    factory
  }
```