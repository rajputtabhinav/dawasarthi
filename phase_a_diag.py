"""Phase A: diagnostics — transceiver DDM, cable test, ethtool counters,
PCIe AER, NIC fw/driver. Read-only / non-disruptive."""
import paramiko, threading
USER, PASS = "user", "netweb"
TARGETS = [
    ("172.16.11.218", "ens8f1np1", "rocep202s0f1"),
    ("172.16.14.8",   "enp1s0np0", "rocep1s0"),
]

PROBE = r"""
S() { echo netweb | sudo -S -p '' "$@" 2>/dev/null; }
IF=__IF__; RDEV=__RDEV__

echo "###### $(hostname)  iface=$IF  rdma=$RDEV ######"

echo
echo "==== driver / firmware ===="
ethtool -i "$IF" | sed 's/^/  /'

echo
echo "==== link / negotiated speed ===="
ethtool "$IF" 2>/dev/null | grep -E 'Speed|Duplex|Port|Auto-neg|Link detected|MTU' | sed 's/^/  /'

echo
echo "==== transceiver / module (ethtool -m) ===="
S ethtool -m "$IF" 2>&1 | head -45 | sed 's/^/  /'

echo
echo "==== cable test (if supported) ===="
S ethtool --cable-test "$IF" 2>&1 | head -15 | sed 's/^/  /' || true
sleep 2
S ethtool --show-cable-test "$IF" 2>&1 | head -15 | sed 's/^/  /' || true

echo
echo "==== TDR cable diagnostics ===="
ethtool --show-cable-test-tdr "$IF" 2>&1 | head -15 | sed 's/^/  /' || echo "  (TDR not supported)"

echo
echo "==== ethtool counters (key error / drop / pause) ===="
ethtool -S "$IF" 2>/dev/null | grep -iE 'err|drop|miss|discard|crc|fcs|fifo|pause|fragment|over|under|abort' | sed 's/^/  /' | sort -u

echo
echo "==== ethtool counters non-zero (full sweep, only != 0) ===="
ethtool -S "$IF" 2>/dev/null | awk -F: 'NR>1 && $2+0 != 0 {sub(/^ +/, "", $1); sub(/^ +/, "", $2); printf "  %-50s %s\n", $1, $2}' | head -40

echo
echo "==== PCIe AER / link errors for NIC ===="
NIC_BDF=$(readlink "/sys/class/net/$IF/device" | xargs basename)
echo "  NIC BDF: $NIC_BDF"
S lspci -vv -s "$NIC_BDF" 2>/dev/null | grep -E 'LnkCap:|LnkSta:|CESta:|UESta:|HeaderLog:|UESvrt:|CEMsk:|UEMsk:|RootCmd:|RootSta:' | sed 's/^/  /'

echo
echo "==== RoCE port info ===="
ibstat $RDEV 2>/dev/null | grep -E 'State|Physical|Rate|GUID|LMC|Base lid|Link layer' | sed 's/^/  /' || true
echo "  --- gid table ---"
S rdma link show $RDEV/1 2>/dev/null | sed 's/^/  /'
ls /sys/class/infiniband/$RDEV/ports/1/gids/ 2>/dev/null | head -20 | sed 's/^/  GID idx /'

echo
echo "==== link uptime (carrier-up duration approx) ===="
S ip -d -s link show "$IF" 2>/dev/null | head -20 | sed 's/^/  /'

echo
echo "==== thermal (NIC if exposed) ===="
S sensors 2>/dev/null | grep -iE 'edge|nic|net|bnxt|temp' | head -10 | sed 's/^/  /' || \
  echo "  (lm-sensors not configured or no NIC temp sensor)"
S find /sys/class/hwmon -name 'name' -exec grep -H bnxt {} \; 2>/dev/null | sed 's/^/  /'
"""

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c

results = {}
def grab(h, iface, rdev):
    c = conn(h)
    cmd = PROBE.replace("__IF__", iface).replace("__RDEV__", rdev)
    _, o, e = c.exec_command(cmd, timeout=60)
    results[h] = o.read().decode(errors='replace')
    c.close()

ts = [threading.Thread(target=grab, args=t) for t in TARGETS]
for t in ts: t.start()
for t in ts: t.join()
for h, _, _ in TARGETS:
    print(results[h])
    print()
