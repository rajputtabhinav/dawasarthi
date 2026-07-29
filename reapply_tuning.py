"""Reapply volatile tuning after reboot, ready for CPU-load test."""
import paramiko, time

USER, PASS = "user", "netweb"
HOSTS = {
    "172.16.11.218": dict(iface="ens8f1np1", ip="10.10.10.1/24", name="srv218",
                          other_ip="10.10.10.2", other_name="srv148"),
    "172.16.14.8":   dict(iface="enp1s0np0", ip="10.10.10.2/24", name="srv148",
                          other_ip="10.10.10.1", other_name="srv218"),
}

def conn(h):
    for attempt in range(4):
        try:
            c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(h, username=USER, password=PASS, timeout=30,
                      banner_timeout=45, auth_timeout=45,
                      allow_agent=False, look_for_keys=False); return c
        except Exception as e:
            print(f"  [{h}] connect attempt {attempt+1}: {e}"); time.sleep(5)
    raise RuntimeError(f"unable to connect {h}")
def run(c, cmd, t=120):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

TUNE = r"""
S() { echo netweb | sudo -S -p '' "$@" 2>/dev/null; }
IF=__IF__; IP=__IP__; NAME=__NAME__; OIP=__OIP__; ONAME=__ONAME__

echo "## set hostname"
S hostname "$NAME"; echo "  hostname: $(hostname)"

echo "## /etc/hosts entries"
S bash -c "grep -q ' $NAME$' /etc/hosts || echo '${IP%/*} $NAME' >> /etc/hosts; \
           grep -q ' $ONAME$' /etc/hosts || echo '$OIP $ONAME' >> /etc/hosts"

echo "## IP + MTU"
if ! ip -4 addr show "$IF" | grep -q "${IP%/*}/"; then
  S ip link set "$IF" up
  S ip addr add "$IP" dev "$IF"
fi
S ip link set "$IF" mtu 9000
ip -4 -o addr show "$IF" | awk '{print "  "$2,$4}'
ip -o link show "$IF" | grep -oE 'mtu [0-9]+' | head -1 | xargs -I {} echo "  {}"

echo "## NIC queues, ring buffers, txqueuelen"
S ethtool -L "$IF" combined 32 2>/dev/null
S ethtool -G "$IF" rx 2047 tx 2047 2>/dev/null
S ip link set "$IF" txqueuelen 10000

echo "## CPU governor performance"
S cpupower frequency-set -g performance 2>&1 | tail -1
echo "  cpu0: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo n/a)"

echo "## stop irqbalance"
S systemctl stop irqbalance 2>/dev/null; echo "  irqbalance: $(systemctl is-active irqbalance 2>/dev/null)"

echo "## RoCE link state"
rdma link show 2>/dev/null | sed 's/^/  /'
"""

# 1) Apply on both
print("=" * 60); print("# Reapplying volatile tuning"); print("=" * 60)
for h, info in HOSTS.items():
    print(f"\n--- {h} ({info['iface']} -> {info['name']}) ---")
    c = conn(h)
    cmd = TUNE.replace("__IF__", info['iface']).replace("__IP__", info['ip']) \
              .replace("__NAME__", info['name']).replace("__OIP__", info['other_ip']) \
              .replace("__ONAME__", info['other_name'])
    o, e = run(c, cmd, 90)
    print(o)
    c.close()

# 2) Ping check
print("\n" + "=" * 60); print("# bidirectional ping"); print("=" * 60)
c = conn("172.16.14.8")
o, _ = run(c, "ping -c 3 -W 2 -I enp1s0np0 10.10.10.1 | tail -4", 15)
print("srv148 -> srv218:"); print(o)
c.close()
c = conn("172.16.11.218")
o, _ = run(c, "ping -c 3 -W 2 -I ens8f1np1 10.10.10.2 | tail -4", 15)
print("srv218 -> srv148:"); print(o)
c.close()
