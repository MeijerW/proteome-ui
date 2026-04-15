Spatial data conversion

This folder contains a one-shot converter for the spatial z-score matrices.

The website originally expects long-format spatial CSV files with this schema:

sample,Gene,Z-score,group,replicate

The new `rna_zscore.csv` and `prot_zscore.csv` files are wide matrices instead:

sample,<gene1>,<gene2>,<gene3>,...

Run this locally from the repository root:

```bash
python scripts/convert_spatial_matrix_to_long.py \
  --rna-input /path/to/rna_zscore.csv \
  --prot-input /path/to/prot_zscore.csv \
  --rna-output data/rna_zscore_long.csv \
  --prot-output data/prot_zscore_long.csv
```

The script infers:

- `group` from the sample prefix: `P` -> `Posterior`, `A` -> `Anterior`, `S` -> `Somite`
- `replicate` from the sample suffix: `I`, `II`, `III`, etc.

After generating the long-format files, upload them to the repository or data source you want the website to read from.