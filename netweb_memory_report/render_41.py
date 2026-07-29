import os, pypdfium2 as pdfium
pdf = r"C:\Users\asus\Desktop\Netweb_41_MDI300_3h_Memory_Validation_Report.pdf"
out = r"C:\Users\asus\Desktop\Davasarathi\netweb_memory_report\thumbs_41"
os.makedirs(out, exist_ok=True)
doc = pdfium.PdfDocument(pdf)
print(f"pages = {len(doc)}")
for i in range(len(doc)):
    img = doc[i].render(scale=1.5).to_pil()
    p = os.path.join(out, f"p{i+1:02d}.png")
    img.save(p); print(f"  {p}  {img.size}")
