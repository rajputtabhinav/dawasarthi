from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Run5.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "FAIL (AS INSTALLED)",
    "Kit-2 remediation",
    "P0 CH-G",
    "P1 CH-I",
    "P0MG0",
    "P1MI0",
    "BIOS-disabled at POST",
    "80CE04254742EF0151",
    "80CE04254742EF008C",
    "EEF450",
    "E03CB7",
    "425.0",
    "348.6",
    "567.5",
    "TEMP_P0_DIMM_J",
    "1,475,861,328",
    "label",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("serial count:", text.count("80CE0425"))
