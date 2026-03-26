#!/bin/bash
DEST="./pdfs"
mkdir -p $DEST

BASE="https://www.aaro.mil/Portals/136/PDFs/Information%20Papers"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

download() {
  local filename=$1
  local url=$2
  echo "Downloading $filename..."
  curl -sS -L -A "$UA" --retry 3 --retry-delay 2 -o "$DEST/$filename" "$url"
  # Verify it's actually a PDF
  if [ "$(head -c 4 "$DEST/$filename")" != "%PDF" ]; then
    echo "ERROR: $filename is not a PDF — CDN may have blocked the request"
    rm "$DEST/$filename"
  else
    echo "OK: $filename"
  fi
}

download "2025_UAP_Workshop_Paper.pdf" "$BASE/2025_UAP_Workshop_Paper.pdf"
download "AARO_Declassification_Info_Paper_2025.pdf" "$BASE/AARO_Declassification_Info_Paper_2025.pdf"
download "ORNL_Aluminum_Specimen.pdf" "$BASE/ORNL_ANALYSIS_OF_AN_ALUMINUM_SPECIMEN.pdf"
download "AARO_Aluminum_Supplement.pdf" "$BASE/AARO_Aluminum_Materials_Analysis_Supplement_Jan2026.pdf"
download "ORNL_Metallic_Specimen.pdf" "$BASE/ORNL-Synopsis_Analysis_of_a_Metallic_Specimen.pdf"
download "AARO_Metallic_Supplement.pdf" "$BASE/AAROs_Supplement_to_ORNLs_Analysis_of_a_Metallic_Specimen.pdf"
download "AARO_Satellite_Flaring.pdf" "$BASE/AARO_Satellite_Flaring_Paper_508_FINAL_04222025.pdf"
download "AARO_Forced_Perspective.pdf" "$BASE/AARO_Effect_of_Forced_Perspective_and_Parallax_View_on_UAP_Observations_2024.pdf"

echo "Done."