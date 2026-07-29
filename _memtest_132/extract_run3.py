from pypdf import PdfReader

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_132_MDA200_Memory_Validation_Report_Run3.pdf")
print("PAGES:", len(r.pages))
text = "\n".join(p.extract_text() for p in r.pages)
checks = [
    "Overall Result: PASS",
    "Third kit",
    "80CE04254742EEF532",
    "80CE04254742EEF4EE",
    "80CE04254742EF008B",
    "567.5",
    "581.1",
    "348.6",
    "1,576,209,418",
    "DIMM Population Map",
    "no BERT",
    "1.63",
]
for c in checks:
    print(("OK  " if c in text else "MISS"), c)
print("serial count:", text.count("80CE04254742"))
