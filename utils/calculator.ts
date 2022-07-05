import { bnum, scale } from './bignumber';

function calculate() {
    let i = bnum('951.058276327331897594');
    i = scale(i, 18);
    i = i.times(0.25);
    i = scale(i, -18);
    console.log(i.toString());
    const y = bnum('0.683245387671828799');
    console.log(y.minus('0.034162269383591441').toString());
    // B-STMATIC-STABLE
}

calculate();
