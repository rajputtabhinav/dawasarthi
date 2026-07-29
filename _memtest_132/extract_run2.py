from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Run2.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "FAIL (AS INSTALLED)",
    "P0 CH-C",
    "P1 CH-L",
    "BIOS-disabled at POST",
    "80CE04254642E0479B",
    "80CE04254742EF0032",
    "80CE04254642E04754",
    "348.6",
    "581.1",
    "P0MC0",
    "P1ML0",
    "map-out",
    "Memory Device Disabled",
    "1,473,163,606",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("serial count:", text.count("80CE0425"))
