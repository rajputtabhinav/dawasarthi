from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Run4.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "Overall Result: PASS",
    "Fourth kit",
    "symmetric 10+10",
    "Not populated (by design)",
    "80CE04254742EEFD13",
    "80CE04254742EEFA3E",
    "80CE04254642E03E0C",
    "483.7",
    "567.5",
    "348.6",
    "1,396,932,249",
    "DIMM Population Map",
    "1.61",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("populated serial count:", text.count("80CE0425"))
print("vacant rows:", text.count("Not populated (by design)"))
