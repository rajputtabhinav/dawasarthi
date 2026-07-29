from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Run5.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "PASS WITH LIMITATIONS",
    "2 phases",
    "PHASE A",
    "PHASE B",
    "Vacant - faulty module removed (RMA)",
    "first clean POST",
    "314.2",
    "346.7",
    "425.0",
    "567.5",
    "1,480,672,367",
    "TEMP_P0_DIMM_J",
    "EEF450",
    "E03CB7",
    "P0MG0",
    "unstable",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("serial count:", text.count("80CE0425"))
print("vacant rows:", text.count("Vacant - faulty module removed"))
