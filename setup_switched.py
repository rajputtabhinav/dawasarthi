"""
Configure switched topology:
  - Install lldpd, ipmitool (where missing), sysstat
  - Assign 10.10.10.1/24 + 10.10.10.2/24 to the 100G interfaces
  - MTU 9000 + max ring buffers + 32 queues + txqueuelen 10000
  - CPU governor performance
  - Stop irqbalance
  - Set distinct hostnames (srv21 / srv132)
  - LLDP probe to identify the switch
  - Bidirectional jumbo ping verification
"""
import paramiko, time

USER, PASS = "user", "netweb"

HOSTS = {
    "172.16.15.21": dict(role="server", iface="ens8f1np1", rdev="bnxt_re0",
                         ip="10.10.10.1/24", name="srv21", numa_node=1, base_core=40),
    "172.16.11.132": dict(role="client", iface="enp1s0np0", rdev="bnxt_re0",
                          ip="10.10.10.2/24", name="srv132", numa_node=0, base_core=4),
}

def conn(h):
    for _ in range(4):
        try:
            c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(h, username=USER, password=PASS, timeout=30,
                      banner_timeout=45, auth_timeout=45,
                      allow_agent=False, look_for_keys=False); return c
        except Exception as e: time.sleep(5)
    raise RuntimeError(f"connect failed {h}")
def run(c, cmd, t=240):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

print("=" * 70); print("# Install tooling on both hosts"); print("=" * 70)
for h in HOSTS:
    c = conn(h)
    o, _ = run(c, "echo netweb | sudo -S -p '' DEBIAN_FRONTEND=noninteractive "
                  "apt-get install -y -qq lldpd ipmitool sysstat ethtool 2>&1 | tail -3", 180)
    o2, _ = run(c, "echo netweb | sudo -S -p '' systemctl enable --now lldpd 2>&1 | tail -2; "
                   "command -v ipmitool && command -v lldpctl && command -v mpstat", 30)
    print(f"[{h}] {o2.strip()}")
    c.close()

# Apply network + tuning config
TUNE = r"""
S() { echo netweb | sudo -S -p '' "$@" 2>/dev/null; }
IF=__IF__; IP=__IP__; NAME=__NAME__; OIP=__OIP__; ONAME=__ONAME__
echo "## hostname + /etc/hosts"
S hostname "$NAME"
S bash -c "grep -q ' $NAME$' /etc/hosts || echo '${IP%/*} $NAME' >> /etc/hosts; \
           grep -q ' $ONAME$' /etc/hosts || echo '$OIP $ONAME' >> /etc/hosts"
echo "  hostname: $(hostname)"

echo "## IP + MTU 9000"
if ! ip -4 addr show "$IF" | grep -q "${IP%/*}/"; then
  S ip link set "$IF" up
  S ip addr add "$IP" dev "$IF"
fi
S ip link set "$IF" mtu 9000
ip -4 -o addr show "$IF" | awk '{print "  "$2,$4}'
ip -o link show "$IF" | grep -oE 'mtu [0-9]+' | head -1 | xargs -I {} echo "  {}"

echo "## NIC tuning"
S ethtool -L "$IF" combined 32 2>/dev/null
S ethtool -G "$IF" rx 2047 tx 2047 2>/dev/null
S ip link set "$IF" txqueuelen 10000

echo "## CPU governor + irqbalance off"
S cpupower frequency-set -g performance 2>&1 | tail -1
S systemctl stop irqbalance 2>/dev/null

echo "## TCP buffer tuning"
S bash -c 'cat > /etc/sysctl.d/99-100g-tune.conf <<EOF
net.core.rmem_max = 268435456
net.core.wmem_max = 268435456
net.core.rmem_default = 33554432
net.core.wmem_default = 33554432
net.core.netdev_max_backlog = 250000
net.ipv4.tcp_rmem = 4096 87380 268435456
net.ipv4.tcp_wmem = 4096 65536 268435456
net.ipv4.tcp_mtu_probing = 1
EOF'
S sysctl -p /etc/sysctl.d/99-100g-tune.conf > /dev/null 2>&1
echo "  rmem_max: $(sysctl -n net.core.rmem_max)"

echo "## RoCE port state"
rdma link show 2>/dev/null | sed 's/^/  /'

echo "## LLDP — link partner (switch identity)"
S lldpctl 2>/dev/null | head -25 | sed 's/^/  /'
"""

print("\n" + "=" * 70); print("# Apply config on both hosts"); print("=" * 70)
for h, info in HOSTS.items():
    other = [v for k,v in HOSTS.items() if k != h][0]
    print(f"\n--- {h} ({info['name']}) ---")
    c = conn(h)
    cmd = (TUNE.replace("__IF__", info['iface'])
                .replace("__IP__", info['ip'])
                .replace("__NAME__", info['name'])
                .replace("__OIP__", other['ip'].split('/')[0])
                .replace("__ONAME__", other['name']))
    o, _ = run(c, cmd, 120)
    print(o)
    c.close()

time.sleep(2)
print("\n" + "=" * 70); print("# Bidirectional ping (standard + jumbo)"); print("=" * 70)
client = conn("172.16.11.132"); server = conn("172.16.15.21")
print("\n--- standard ping ---")
o,_ = run(client, "ping -c 4 -W 2 -I enp1s0np0 10.10.10.1 | tail -5", 20)
print("srv132 -> srv21:"); print(o)
o,_ = run(server, "ping -c 4 -W 2 -I ens8f1np1 10.10.10.2 | tail -5", 20)
print("srv21 -> srv132:"); print(o)
print("\n--- jumbo ping (8972 bytes, DF set) ---")
o,_ = run(client, "ping -c 4 -W 2 -M do -s 8972 -I enp1s0np0 10.10.10.1 | tail -5", 20)
print("srv132 -> srv21 (jumbo):"); print(o)
client.close(); server.close()
