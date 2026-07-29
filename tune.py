import paramiko

USER, PASS = "user", "netweb"
HOSTS = [
    ("172.16.11.218", "ens8f1np1", "10.10.10.1/24"),
    ("172.16.14.8",   "enp1s0np0", "10.10.10.2/24"),
]

TUNE = r"""
S() { echo netweb | sudo -S -p '' "$@"; }
IF=__IF__
IP=__IP__

echo "## before"
ip -o link show "$IF" | grep -oE 'mtu [0-9]+|qlen [0-9]+'
ip -4 -o addr show "$IF" | awk '{print "   "$4}'

echo "## ensure IP $IP present"
if ! ip -4 addr show "$IF" | grep -q "${IP%/*}/"; then
  S ip addr add "$IP" dev "$IF" 2>/dev/null || true
fi

echo "## MTU 9000"
S ip link set "$IF" mtu 9000
ip -o link show "$IF" | grep -oE 'mtu [0-9]+'

echo "## sysctl tuning"
S bash -c 'cat > /etc/sysctl.d/99-100g-tune.conf <<EOF
net.core.rmem_max = 268435456
net.core.wmem_max = 268435456
net.core.rmem_default = 33554432
net.core.wmem_default = 33554432
net.core.netdev_max_backlog = 250000
net.core.netdev_budget = 600
net.ipv4.tcp_rmem = 4096 87380 268435456
net.ipv4.tcp_wmem = 4096 65536 268435456
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_sack = 1
net.ipv4.tcp_timestamps = 1
EOF'
# try BBR; fall back silently
S modprobe tcp_bbr 2>/dev/null || true
if grep -q bbr /proc/sys/net/ipv4/tcp_available_congestion_control 2>/dev/null; then
  echo "net.ipv4.tcp_congestion_control = bbr" | S tee -a /etc/sysctl.d/99-100g-tune.conf >/dev/null
fi
S sysctl -p /etc/sysctl.d/99-100g-tune.conf 2>&1 | sed 's/^/   /'

echo "## ethtool ring buffers (max)"
MAX=$(ethtool -g "$IF" 2>/dev/null | awk '/^RX:/{r=$2}/^TX:/{t=$2}END{print r" "t}')
echo "   pre-set: $(ethtool -g "$IF" 2>/dev/null | grep -E '^RX:|^TX:' | head -2 | xargs)"
S ethtool -G "$IF" rx 4096 tx 4096 2>&1 | sed 's/^/   /' || true
echo "   current: $(ethtool -g "$IF" 2>/dev/null | grep -A1 'Current hardware' | tail -2 | xargs)"

echo "## offloads (tso/gso/gro/lro)"
S ethtool -K "$IF" tso on gso on gro on lro on 2>&1 | sed 's/^/   /' || true
ethtool -k "$IF" 2>/dev/null | grep -E 'tcp-segmentation-offload|generic-segmentation|generic-receive|large-receive' | sed 's/^/   /'

echo "## CPU governor -> performance"
for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  [ -f "$g" ] && echo performance | S tee "$g" >/dev/null
done
echo "   cpu0 governor: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo n/a)"

echo "## txqueuelen 10000"
S ip link set "$IF" txqueuelen 10000
ip -o link show "$IF" | grep -oE 'qlen [0-9]+'

echo "## PCIe link width"
DEV=$(readlink "/sys/class/net/$IF/device" | xargs basename)
echo "   PCIe BDF: $DEV"
S lspci -s "$DEV" -vv 2>/dev/null | grep -E 'LnkCap:|LnkSta:' | sed 's/^/   /'

echo "## final"
ip -o link show "$IF" | grep -oE 'mtu [0-9]+|qlen [0-9]+'
ip -4 -o addr show "$IF" | awk '{print "   "$4}'
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface, ip in HOSTS:
    print(f"\n{'='*70}\n# {host}  ({iface}  {ip})\n{'='*70}")
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    cmd = TUNE.replace("__IF__", iface).replace("__IP__", ip)
    _, o, e = c.exec_command(cmd, timeout=90)
    print(o.read().decode(errors='replace'))
    err = e.read().decode(errors='replace')
    e2 = "\n".join(l for l in err.splitlines() if l.strip() and "password" not in l.lower())
    if e2:
        print("STDERR:", e2)
    c.close()
