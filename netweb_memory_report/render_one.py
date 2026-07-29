import sys, os, pypdfium2 as pdfium
pdf = r"C:\Users\asus\Desktop\Netweb_Memory_Validation_Report.pdf"
out = r"C:\Users\asus\Desktop\Davasarathi\netweb_memory_report\thumbs"
doc = pdfium.PdfDocument(pdf)
pages = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else [1, 2, 3]
for i in pages:
    page = doc[i-1]
    img = page.render(scale=2.5).to_pil()
    path = os.path.join(out, f"hi_p{i:02d}.png")
    img.save(path)
    print(f"  {path}  {img.size}")
