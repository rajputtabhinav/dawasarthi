import sys
from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report.pdf")
print("PAGES:", len(r.pages))
for i, p in enumerate(r.pages):
    print(f"\n===== PAGE {i+1} =====")
    print(p.extract_text())
