import json

p = r"C:\Users\asus\Desktop\CoreBench MCP\restyled\132_memory_combined.results.json"
with open(p, "r", encoding="utf-8") as fh:
    d = json.load(fh)

reg = d["extra_tables"][2]
assert reg["title"].startswith("Complete Module Register")
reg["widths_mm"] = [6, 8, 14, 10, 10, 13, 27, 36, 12, 38]
for row in reg["rows"]:
    row[2] = row[2].replace(" CH-", "-")   # "P0 CH-A" -> "P0-A"
    row[8] = row[8].replace("2Rx4/80b", "2Rx4 80b")
reg["caption"] = reg["caption"].replace(
    "Slot = last tested position.",
    "Slot = last tested position (P0-A = socket P0, channel A).")

with open(p, "w", encoding="utf-8") as fh:
    json.dump(d, fh, indent=2)
print("rows:", len(reg["rows"]), "ok")
