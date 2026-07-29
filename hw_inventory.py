"""
Pull full hardware inventory from both Netweb servers in parallel.
"""
import paramiko, threading

USER, PASS = "user", "netweb"
HOSTS = ["172.16.11.218", "172.16.14.8"]

PROBE = r"""
S() { echo netweb | sudo -S -p '' "$@" 2>/dev/null; }

echo "############################################################"
echo "#  HOST: $(hostname)   IP: $(hostname -I | awk '{print $1}')"
echo "############################################################"

echo
echo "==== OS / Kernel ===="
. /etc/os-release 2>/dev/null
echo "  distro       : $PRETTY_NAME"
echo "  kernel       : $(uname -r)"
echo "  uptime       : $(uptime -p)"
echo "  arch         : $(uname -m)"

echo
echo "==== System (dmidecode) ===="
S dmidecode -t system | awk '
  /Manufacturer:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Product Name:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Version:/ && !v {sub(/^[ \t]+/,""); print "  "$0; v=1}
  /Serial Number:/ {sub(/^[ \t]+/,""); print "  "$0}
  /UUID:/ {sub(/^[ \t]+/,""); print "  "$0}
  /SKU Number:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Family:/ {sub(/^[ \t]+/,""); print "  "$0}
'

echo
echo "==== Baseboard ===="
S dmidecode -t baseboard | awk '
  /Manufacturer:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Product Name:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Version:/ {sub(/^[ \t]+/,""); print "  "$0; exit}
'

echo
echo "==== Chassis ===="
S dmidecode -t chassis | awk '
  /Manufacturer:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Type:/ && !t {sub(/^[ \t]+/,""); print "  "$0; t=1}
  /Serial Number:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Asset Tag:/ {sub(/^[ \t]+/,""); print "  "$0; exit}
'

echo
echo "==== BIOS ===="
S dmidecode -t bios | awk '
  /Vendor:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Version:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Release Date:/ {sub(/^[ \t]+/,""); print "  "$0; exit}
'

echo
echo "==== CPU ===="
lscpu | grep -E '^Architecture|^CPU\(s\):|^Thread|^Core\(s\) per socket|^Socket\(s\)|^NUMA node\(s\)|^Model name|^CPU max MHz|^CPU min MHz|^Virtualization|^L1d|^L1i|^L2|^L3' | sed 's/^/  /'

echo
echo "==== NUMA topology ===="
numactl --hardware 2>/dev/null | grep -E 'available|node [0-9]+ (cpus|size)' | sed 's/^/  /'

echo
echo "==== RAM (total + per-DIMM) ===="
free -h | sed 's/^/  /'
echo "  --- DIMMs ---"
S dmidecode -t memory | awk '
  /Memory Device/ {indimm=1; size="?"; type="?"; speed="?"; loc="?"; mfg="?"; pn="?"}
  indimm && /^\s+Size:/ {sub(/^[ \t]+Size:[ \t]+/,""); size=$0}
  indimm && /^\s+Type:/ && !/Detail/ {sub(/^[ \t]+Type:[ \t]+/,""); type=$0}
  indimm && /^\s+Speed:/ && !/Config/ {sub(/^[ \t]+Speed:[ \t]+/,""); speed=$0}
  indimm && /^\s+Configured Memory Speed:/ {sub(/^[ \t]+Configured Memory Speed:[ \t]+/,""); cspeed=$0}
  indimm && /^\s+Locator:/ && !/Bank/ {sub(/^[ \t]+Locator:[ \t]+/,""); loc=$0}
  indimm && /^\s+Manufacturer:/ {sub(/^[ \t]+Manufacturer:[ \t]+/,""); mfg=$0}
  indimm && /^\s+Part Number:/ {sub(/^[ \t]+Part Number:[ \t]+/,""); pn=$0}
  indimm && /^$/ {
    if (size != "No Module Installed" && size != "?" && size != "") {
      printf "    %-12s %-12s %-8s @ %-12s %-22s %s\n", loc, size, type, speed, mfg, pn
    }
    indimm=0
  }
' | sort -u

echo
echo "==== Storage ===="
lsblk -d -o NAME,SIZE,MODEL,VENDOR,ROTA,TRAN,TYPE 2>/dev/null | sed 's/^/  /'
echo "  --- NVMe details ---"
S nvme list 2>/dev/null | sed 's/^/  /' || echo "    (no NVMe or nvme-cli missing)"

echo
echo "==== Storage controllers (lspci -nn) ===="
lspci -nn 2>/dev/null | grep -iE 'sata|raid|sas|nvme|storage' | sed 's/^/  /'

echo
echo "==== GPUs ===="
if command -v nvidia-smi >/dev/null; then
  nvidia-smi --query-gpu=index,name,driver_version,memory.total,pcie.link.gen.current,pcie.link.width.current --format=csv 2>/dev/null | sed 's/^/  /'
else
  echo "  nvidia-smi not present"
fi
lspci -nn 2>/dev/null | grep -iE 'vga|3d|nvidia|amd/ati|matrox' | sed 's/^/  /'

echo
echo "==== Network controllers ===="
lspci -nn 2>/dev/null | grep -iE 'ethernet|infiniband|network controller' | sed 's/^/  /'

echo
echo "==== PCIe topology summary ===="
lspci 2>/dev/null | grep -cE 'PCI bridge|Root Port' | xargs -I {} echo "  PCIe bridges: {}"
echo "  Total devices: $(lspci 2>/dev/null | wc -l)"

echo
echo "==== Power / thermal ===="
S dmidecode -t 39 2>/dev/null | grep -E 'Manufacturer|Max Power Capacity' | sed 's/^/  /' | head -10
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
