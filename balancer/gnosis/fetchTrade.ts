import fetch from 'isomorphic-fetch';

export interface SorApiRequest {
    sellToken: string;
    buyToken: string;
    orderKind: string;
    amount: string;
    gasPrice: string;
}

export async function fetchTrade(endPoint: string, apiRequest: SorApiRequest) {
    const res = await fetch(endPoint, {
        method: 'post',
        body: JSON.stringify(apiRequest),
        headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data;
}

// ts-node ./balancer/gnosis/fetchTrade.ts
// fetchTrade(
//     'https://2ls8yjzbzl.execute-api.ap-southeast-2.amazonaws.com/prod/sor/1',
//     {
//         sellToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
//         buyToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
//         orderKind: 'sell',
//         amount: '100000',
//         gasPrice: '40000000000',
//     }
// );
