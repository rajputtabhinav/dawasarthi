import paramiko, threading
USER, PASS = "user", "netweb"
HOSTS = ["172.16.11.218", "172.16.14.8"]

PROBE = r"""
S() { echo netweb | sudo -S -p '' "$@" 2>/dev/null; }
echo "###### $(hostname) ($(hostname -I | awk '{print $1}')) ######"

echo
echo "==== DIMMs (populated only) ===="
S dmidecode -t 17 2>/dev/null | awk '
  /^Handle/ {h=$2; size="?"; type="?"; speed="?"; loc="?"; mfg="?"; pn="?"; rank="?"}
  /^\s+Size:/ {sub(/.*Size:[ \t]*/,""); size=$0}
  /^\s+Type:/ && !/Detail|Form/ {sub(/.*Type:[ \t]*/,""); type=$0}
  /^\s+Speed:/ {sub(/.*Speed:[ \t]*/,""); speed=$0}
  /^\s+Locator:/ && !/Bank/ {sub(/.*Locator:[ \t]*/,""); loc=$0}
  /^\s+Manufacturer:/ {sub(/.*Manufacturer:[ \t]*/,""); mfg=$0}
  /^\s+Part Number:/ {sub(/.*Part Number:[ \t]*/,""); pn=$0}
  /^\s+Rank:/ {sub(/.*Rank:[ \t]*/,""); rank=$0}
  /^\s*$/ {
    if (size != "?" && size != "No Module Installed" && size != "Unknown") {
      printf "  %-14s %-12s %-8s @%-12s %-16s %-22s rank=%s\n", loc, size, type, speed, mfg, pn, rank
    }
  }
' | head -40

echo
echo "  total populated DIMMs:"
S dmidecode -t 17 2>/dev/null | grep -c "Size:.*GB" | xargs -I {} echo "    {}"

echo
echo "==== GPU / Accelerator check (deep) ===="
echo "  lspci | grep -i nvidia/amd-gpu/3D:"
lspci 2>/dev/null | grep -iE 'nvidia|3D controller|GPGPU|tesla|h100|a100|h200|mi[0-9]+|radeon instinct' | sed 's/^/    /' || echo "    (none)"

echo "  nvidia kernel module:"
lsmod | grep -E '^nvidia|^nouveau' | head -5 | sed 's/^/    /' || echo "    (no nvidia/nouveau kmod)"

echo "  CUDA install:"
ls -la /usr/local/cuda* 2>/dev/null | head -5 | sed 's/^/    /' || echo "    (no /usr/local/cuda)"

echo "  /dev/nvidia*:"
ls /dev/nvidia* 2>/dev/null | sed 's/^/    /' || echo "    (no /dev/nvidia*)"

echo "  PCIe slots free for GPU (look for Gen4/5 x16 slots, sample):"
S lspci -vv 2>/dev/null | grep -B1 -E 'LnkSta:.*x16' | grep -E '^[0-9a-f]+:[0-9a-f]+\.[0-9a-f] ' | head -10 | sed 's/^/    /'

echo
echo "==== Network mgmt / IPMI ===="
S dmidecode -t 38 2>/dev/null | grep -E 'Interface Type|IP Address|MAC Address' | sed 's/^/  /' | head -10

echo
echo "==== Power supplies ===="
S dmidecode -t 39 2>/dev/null | awk '
  /^Handle/ {h=1}
  h && /Name:/ {sub(/.*Name:[ \t]*/,""); print "  PSU: "$0}
  h && /Max Power Capacity:/ {sub(/.*Max Power Capacity:[ \t]*/,""); print "    max: "$0}
  h && /Status:/ && !/Bootup/ {sub(/.*Status:[ \t]*/,""); print "    status: "$0}
'
"""

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c

results = {}
def grab(h):
    c = conn(h)
    _, o, _ = c.exec_command(PROBE, timeout=60)
    results[h] = o.read().decode(errors='replace')
    c.close()

ts = [threading.Thread(target=grab, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()

for h in HOSTS:
    print(results[h])
    print()
