#!/usr/bin/env python3
import json
from pathlib import Path

import matplotlib.pyplot as plt


def main() -> None:
    pool_study_dir = Path(__file__).resolve().parents[2]
    json_path = (
        pool_study_dir
        / "data"
        / "rateCompare"
        / "rateCompare_44713999_44755380.json"
    )
    output_dir = pool_study_dir / "plots"
    output_path = output_dir / "rate_compare.png"

    with json_path.open() as f:
        data = json.load(f)

    output_dir.mkdir(parents=True, exist_ok=True)

    blocks = [int(row["blockNumber"]) for row in data]
    series_keys = [
        "rateProviderUsdPerWeth",
        "uniswapUsdPerWeth",
        "pythUsdPerWeth",
    ]

    fig, ax = plt.subplots(figsize=(16, 8))
    for key in series_keys:
        values = [float(row[key]) for row in data]
        ax.plot(blocks, values, label=key, linewidth=1)

    ax.set_title("Rate Provider vs Uniswap vs Pyth")
    ax.set_xlabel("blockNumber")
    ax.set_ylabel("USD per WETH")
    ax.grid(alpha=0.2)
    ax.ticklabel_format(style="plain", axis="x")
    ax.legend(loc="upper left")

    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
