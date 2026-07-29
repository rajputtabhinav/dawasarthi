import os, pypdfium2 as pdfium
pdf = r"C:\Users\asus\Desktop\Netweb_Memory_Validation_Report.pdf"
out = r"C:\Users\asus\Desktop\Davasarathi\netweb_memory_report\thumbs"
os.makedirs(out, exist_ok=True)
doc = pdfium.PdfDocument(pdf)
print(f"pages = {len(doc)}")
for i in range(len(doc)):
    page = doc[i]
    img = page.render(scale=1.4).to_pil()
    path = os.path.join(out, f"p{i+1:02d}.png")
    img.save(path)
    print(f"  {path}  {img.size}")
