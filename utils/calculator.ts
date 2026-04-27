import { bnum, scale } from './bignumber';

function calculate() {
    // 239.664151972112023456
    // 4226.06
    const bptTotal = bnum(239.664151972112023456);
    const dollarTotal = bnum(4226.06);

    const bal = bnum(507.06);
    const balSplit = bal.div(dollarTotal);
    const balBpt = balSplit.times(bptTotal).toFixed(18);

    const aura = bnum(614.45);
    const auraSplit = aura.div(dollarTotal);
    const auraBpt = auraSplit.times(bptTotal).toFixed(18);

    const wstEth = bnum(1530.13);
    const wstSplit = wstEth.div(dollarTotal);
    const wstBpt = wstSplit.times(bptTotal).toFixed(18);

    const goldBpt = bptTotal.minus(balBpt).minus(auraBpt).minus(wstBpt);

    // 0x49b2De7d214070893c038299a57BaC5ACb8B8A34
    console.log(balBpt.toString());
    console.log(auraBpt.toString());
    console.log(wstBpt.toString());
    console.log(goldBpt.toString());
}

calculate();
