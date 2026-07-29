"""Probe the two new servers (presumably connected via a switch)."""
import paramiko, threading, time

USER, PASS = "user", "netweb"
HOSTS = ["172.16.15.21", "172.16.11.132"]

PROBE = r"""
echo "###### hostname: $(hostname)  mgmt-ip: $(hostname -I | awk '{print $1}')  uptime: $(uptime -p) ######"

echo
echo "==== OS / kernel ===="
. /etc/os-release 2>/dev/null
echo "  distro       : $PRETTY_NAME"
echo "  kernel       : $(uname -r)"
echo "  arch         : $(uname -m)"

echo
echo "==== CPU / NUMA ===="
lscpu | grep -E '^CPU\(s\):|^Thread|^Core\(s\) per socket|^Socket\(s\)|^NUMA node\(s\)|^Model name|^CPU max MHz' | sed 's/^/  /'
echo "  NUMA nodes:"
numactl --hardware 2>/dev/null | grep -E '^node [0-9]+ (cpus|size)' | sed 's/^/    /'

echo
echo "==== Memory ===="
free -h | head -2 | sed 's/^/  /'

echo
echo "==== System (dmidecode) ===="
echo netweb | sudo -S -p '' dmidecode -t system 2>/dev/null | awk '
  /Manufacturer:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Product Name:/ {sub(/^[ \t]+/,""); print "  "$0}
  /Serial Number:/ {sub(/^[ \t]+/,""); print "  "$0; exit}
'

echo
echo "==== Network interfaces (links + IPs) ===="
ip -4 -o addr show | awk '{print "  "$2,$4}' | grep -v 'lo\|docker'
echo "  --- 100G-ish interfaces ---"
for d in /sys/class/net/*; do
  i=$(basename "$d")
  [ "$i" = "lo" ] && continue
  spd=$(cat "$d/speed" 2>/dev/null)
  state=$(cat "$d/operstate" 2>/dev/null)
  if [ "$spd" -ge 25000 ] 2>/dev/null; then
    printf "    %-18s speed=%sMb/s state=%s\n" "$i" "$spd" "$state"
  fi
done

echo
echo "==== NIC hardware (lspci) ===="
lspci 2>/dev/null | grep -iE 'broadcom|mellanox|connectx|infiniband|nvidia' | sed 's/^/  /'
lspci 2>/dev/null | grep -i 'ethernet controller' | head -5 | sed 's/^/  /'

echo
echo "==== RDMA / RoCE devices ===="
ls /sys/class/infiniband/ 2>/dev/null | sed 's/^/  /' || echo "  (no RDMA devices)"
echo netweb | sudo -S -p '' rdma link show 2>/dev/null | sed 's/^/  /' || true
command -v ibv_devinfo >/dev/null && ibv_devinfo 2>&1 | grep -E 'hca_id|state|link_layer|active_mtu' | sed 's/^/  /'

echo
echo "==== Link partner (LLDP) — confirms switch in path ===="
echo netweb | sudo -S -p '' lldpctl 2>/dev/null | grep -iE 'Interface:|SysName:|PortDescr:|MgmtIP|VLAN' | head -30 | sed 's/^/  /' || \
  echo "  lldpctl not installed (will install if needed)"

echo
echo "==== Firmware / driver ===="
for i in $(ls /sys/class/net | grep -v lo); do
  spd=$(cat /sys/class/net/$i/speed 2>/dev/null)
  [ "$spd" -ge 25000 ] 2>/dev/null && {
    echo "  $i:"; ethtool -i $i 2>/dev/null | grep -E 'driver|version|firmware|bus' | sed 's/^/    /'
  }
done

echo
echo "==== Power / IPMI capability ===="
command -v ipmitool >/dev/null && echo "  ipmitool: $(ipmitool -V 2>&1 | head -1)" || echo "  ipmitool: MISSING"
command -v turbostat >/dev/null && echo "  turbostat: $(turbostat --version 2>&1 | head -1)" || echo "  turbostat: MISSING"
"""

def conn(h):
    for _ in range(4):
        try:
            c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(h, username=USER, password=PASS, timeout=30,
                      banner_timeout=45, auth_timeout=45,
                      allow_agent=False, look_for_keys=False); return c
        except Exception as e:
            print(f"  [{h}] connect retry: {e}"); time.sleep(5)
    raise RuntimeError(f"can't connect {h}")

results = {}
def grab(h):
    c = conn(h)
    _, o, e = c.exec_command(PROBE, timeout=60)
    results[h] = o.read().decode(errors='replace')
    c.close()

ts = [threading.Thread(target=grab, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()
for h in HOSTS: print(results[h]); print()
