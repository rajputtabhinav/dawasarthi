import sys

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        print("NO_PDF_LIB")
        sys.exit(0)

r = PdfReader(r"C:\Users\asus\Desktop\Netweb_41_MDI300_3h_Memory_Validation_Report.pdf")
print("PAGES:", len(r.pages))
for i, p in enumerate(r.pages):
    print(f"\n===== PAGE {i+1} =====")
    print(p.extract_text())
