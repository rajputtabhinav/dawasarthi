import paramiko, threading
USER, PASS = "user", "netweb"
HOSTS = ["172.16.11.218", "172.16.14.8"]

PROBE = r"""
echo "###### $(hostname) ($(hostname -I | awk '{print $1}')) ######"
echo "==== DIMMs (populated, raw dmidecode) ===="
echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null | \
  awk 'BEGIN{RS=""} /Size: [0-9]+ ?(GB|MB)/' | \
  awk '/Locator:/ {loc=$0} /Manufacturer:/ {mfg=$0} /Part Number:/ {pn=$0} /Size:/ && /(GB|MB)/ {sz=$0} /Type:/ && !/Detail|Form/ {ty=$0} /Speed: [0-9]/ {sp=$0} /Rank:/ {r=$0} END{}' /dev/stdin
# Simpler: just print key lines per device
echo "  (Locator / Size / Type / Speed / Manufacturer / Part Number / Rank)"
echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null | \
  awk '
    /^Handle/        {if (good && size) printf "  %-12s | %-10s | %-8s | %-12s | %-14s | %-22s | rank=%s\n", loc, size, type, speed, mfg, pn, rank; good=0; loc=""; size=""; type=""; speed=""; mfg=""; pn=""; rank=""}
    /^\tSize:.*GB/                                {sub(/^\tSize:[ \t]+/, ""); size=$0; good=1}
    /^\tLocator:/ && !/Bank/                       {sub(/^\tLocator:[ \t]+/, ""); loc=$0}
    /^\tType:/ && !/Detail|Form|Error/             {sub(/^\tType:[ \t]+/, ""); type=$0}
    /^\tSpeed:/                                    {sub(/^\tSpeed:[ \t]+/, ""); speed=$0}
    /^\tManufacturer:/                             {sub(/^\tManufacturer:[ \t]+/, ""); mfg=$0}
    /^\tPart Number:/                              {sub(/^\tPart Number:[ \t]+/, ""); pn=$0}
    /^\tRank:/                                     {sub(/^\tRank:[ \t]+/, ""); rank=$0}
    END {if (good && size) printf "  %-12s | %-10s | %-8s | %-12s | %-14s | %-22s | rank=%s\n", loc, size, type, speed, mfg, pn, rank}
  '
"""

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c

results = {}
def grab(h):
    c = conn(h); _, o, _ = c.exec_command(PROBE, timeout=30)
    results[h] = o.read().decode(errors='replace'); c.close()

ts = [threading.Thread(target=grab, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()
for h in HOSTS: print(results[h]); print()
