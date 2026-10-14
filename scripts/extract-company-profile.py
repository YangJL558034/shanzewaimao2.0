"""Extract original, unmodified photographs from the user-supplied company PDF."""
import argparse
import hashlib
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
source = args.source.resolve(strict=True)
reader = PdfReader(source)
workspace = Path(__file__).resolve().parent.parent
destination = workspace / "public" / "company-profile"
destination.mkdir(parents=True, exist_ok=True)
assets = [
    (2, "IM26.jpg", "research-laboratory.jpg"),
    (2, "IM27.jpg", "manufacturing-collage.jpg"),
    (2, "IM28.jpg", "manufacturing-facility.jpg"),
    (25, "IM204.jpg", "historical-market-references.jpg"),
    # Match the document itself: the 9001/45001 captions in the slide are reversed.
    (19, "IM166.jpg", "iso-9001-certificate.jpg"),
    (19, "IM165.jpg", "iso-14001-certificate.jpg"),
    (19, "IM164.jpg", "iso-45001-certificate.jpg"),
    (20, "IM173.jpg", "barryt-i4-pse-report.jpg"),
    (20, "IM174.jpg", "barryt-i4-rohs-report.jpg"),
]
for page_number, image_name, filename in assets:
    image = next(item for item in reader.pages[page_number - 1].images if item.name == image_name)
    target = destination / filename
    if target.exists() and target.read_bytes() != image.data:
        raise RuntimeError(f"Refusing to replace an existing different asset: {target}")
    if not target.exists():
        target.write_bytes(image.data)
    print(f"Page {page_number}: {filename} {image.image.size}, SHA256={hashlib.sha256(image.data).hexdigest()}")

# Lossless browser-compatible encoding of the PDF's original 3C mark and query QR graphic.
mark = next(item for item in reader.pages[19].images if item.name == "IM177.jp2")
from io import BytesIO
buffer = BytesIO()
mark.image.save(buffer, format="PNG")
target = destination / "barryt-i4-3c-mark-qr.png"
data = buffer.getvalue()
if target.exists() and target.read_bytes() != data:
    raise RuntimeError(f"Refusing to replace an existing different asset: {target}")
if not target.exists():
    target.write_bytes(data)
print(f"Page 20: {target.name} {mark.image.size}; marking/query graphic, not a certificate scan")
