from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Combined.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "Complete Module Register - All 100 Memories with Status",
    "WORKING - OK",
    "FAULTY / DAMAGED - RMA",
    "80CE04254642E08E55",
    "80CE04254742EEF450",
    "80CE04254742EF008C",
    "80CE04254642E03CB8",
    "80CE04254642E03CB2",
    "do NOT reinstall",
    "H0T0000",
    "H0DU000",
    "Campaign Timeline",
    "Cross-Run Results Matrix",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("WORKING count:", text.count("WORKING - OK"))
print("FAULTY count:", text.count("FAULTY / DAMAGED - RMA"))
print("kit word count (should be low):", text.lower().count("kit"))
