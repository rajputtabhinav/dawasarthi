from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Combined.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "Consolidated Memory Validation Report",
    "PASS WITH LIMITATIONS",
    "Campaign Timeline",
    "Cross-Run Results Matrix",
    "Faulty / Damaged Module Register",
    "80CE04254642E03CB8",
    "80CE04254642E04154",
    "80CE04254642E03CB7",
    "80CE04254642E04752",
    "80CE04254742EEEF21",
    "80CE04254642E03CF9",
    "80CE04254642E03CF7",
    "80CE04254642E03A8D",
    "80CE04254642E08EAB",
    "80CE04254642E03CB2",
    "H0DE000",
    "H0T0000",
    "H0DU000",
    "Run 1 Serial Roster",
    "Run 2 Serial Roster",
    "Run 3 Serial Roster",
    "Run 4 Serial Roster",
    "8,965,251,306",
    "581.1",
    "314.2",
    "483.7",
    "do NOT reinstall",
    "EEF450",
    "P0MC0",
    "P0MG0",
    "TEMP_P0_DIMM_J",
]
miss = 0
for c in checks:
    ok = c in text
    if not ok:
        miss += 1
    print(("OK  " if ok else "MISS"), c)
print("total serial mentions:", text.count("80CE0425"))
print("misses:", miss)
