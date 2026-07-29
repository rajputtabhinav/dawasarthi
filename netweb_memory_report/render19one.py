import sys, os, pypdfium2 as pdfium
pdf = r"C:\Users\asus\Desktop\Netweb_Server19_Memory_Validation_Report.pdf"
out = r"C:\Users\asus\Desktop\Davasarathi\netweb_memory_report\thumbs19"
doc = pdfium.PdfDocument(pdf)
for i in [int(x) for x in sys.argv[1:]]:
    img = doc[i-1].render(scale=2.4).to_pil()
    p = os.path.join(out, f"hi_p{i:02d}.png")
    img.save(p); print(f"  {p}  {img.size}")
