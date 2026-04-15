This repository contains the proteome explorer that is integrated in the sonnen-lab website, sonnenlab.org. 
It is used to browse the multi-omics spatial and spatiotemporal data from Meijer et al, 2026, https://doi.org/10.1101/2025.09.05.674076 

Please note that this website is a work in progress. If you have a problem, or request, please contact me or raise an issue in this repository. 
Datafiles used by this website can be found in a separate github repository. 

The spatial viewer currently reads the pre-z-scored long-format datasets `rna_zscore_long.csv` and `prot_zscore_long.csv` from that data repository.
Spatial rho correlations are loaded from `Rho-correlation.txt` and shown in the spatial single-gene and heatmap views.

If the spatial z-score files are stored as wide matrices, use [scripts/convert_spatial_matrix_to_long.py](scripts/convert_spatial_matrix_to_long.py) to convert them once into the long format expected by the site.
