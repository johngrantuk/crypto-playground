#!/usr/bin/env python3
import csv
import json
from pathlib import Path

import matplotlib.pyplot as plt


METHOD_SELECTOR = "0x4be54643"


def main() -> None:
    pool_study_dir = Path(__file__).resolve().parents[2]
    json_path = (
        pool_study_dir
        / "data"
        / "rateCompare"
        / "rateCompare_44713999_44755380.json"
    )
    method_csv_path = (
        pool_study_dir / "data" / "rpMethods" / "rateProviderTransactionList.csv"
    )
    output_dir = pool_study_dir / "plots"
    output_path = output_dir / "rates_with_method_markers.png"

    with json_path.open() as f:
        data = json.load(f)

    method_blocks: list[int] = []
    with method_csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Method") != METHOD_SELECTOR:
                continue
            try:
                method_blocks.append(int(row["Blockno"]))
            except (TypeError, ValueError):
                continue

    blocks = [int(row["blockNumber"]) for row in data]
    min_block = blocks[0]
    max_block = blocks[-1]
    method_blocks = sorted(
        {b for b in method_blocks if min_block <= b <= max_block}
    )

    series_keys = [
        "rateProviderUsdPerWeth",
        "uniswapUsdPerWeth",
        "pythUsdPerWeth",
    ]

    fig, ax = plt.subplots(figsize=(16, 8))
    for key in series_keys:
        values = [float(row[key]) for row in data]
        ax.plot(blocks, values, label=key, linewidth=1)

    for i, block in enumerate(method_blocks):
        ax.axvline(
            x=block,
            color="blue",
            alpha=0.22,
            linewidth=1,
            label=f"method {METHOD_SELECTOR}" if i == 0 else None,
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    ax.set_title("Rate comparison with method markers")
    ax.set_xlabel("blockNumber")
    ax.set_ylabel("USD per WETH")
    ax.grid(alpha=0.2)
    ax.ticklabel_format(style="plain", axis="x")
    ax.legend(loc="upper left")

    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    print(
        f"Wrote {output_path} with {len(method_blocks)} "
        f"method markers for {METHOD_SELECTOR}"
    )


if __name__ == "__main__":
    main()
