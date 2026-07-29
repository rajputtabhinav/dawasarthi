import paramiko

PASS = "netweb"
USER = "user"

# (host, iface, ip/cidr)
PLAN = [
    ("172.16.11.218", "ens8f1np1", "10.10.10.1/24"),
    ("172.16.14.8",   "enp1s0np0", "10.10.10.2/24"),
]

# Configure IP, bring iface up, show result
SETUP_TMPL = r"""
S() {{ echo {pw} | sudo -S -p '' "$@"; }}
IF={iface}; IP={ip}
echo "== before =="
ip -4 addr show "$IF" | grep -E 'inet |state|mtu' || true
# Remove any existing 10.10.10.x to keep idempotent, then add
for old in $(ip -4 -o addr show "$IF" 2>/dev/null | awk '/10\.10\.10\./ {{print $4}}'); do
  S ip addr del "$old" dev "$IF"
done
S ip link set "$IF" up
S ip addr add "$IP" dev "$IF"
echo "== after =="
ip -4 addr show "$IF" | grep -E 'inet |state|mtu' || true
echo "== routes for 10.10.10.0/24 =="
ip route show 10.10.10.0/24
"""

PING_TMPL = r"""
echo "== ping 4 packets =="
ping -c 4 -W 2 -I {iface} {peer}
"""

def conn(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    return c

def run(c, label, cmd):
    print(f"--- {label} ---")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    print(out, end="")
    if err.strip():
        # sudo -S writes prompt to stderr even with -p ''; filter empty noise
        e = "\n".join(l for l in err.splitlines() if l.strip())
        if e:
            print("STDERR:", e)

# 1. Configure both ends
clients = {}
for host, iface, ip in PLAN:
    print(f"\n========== {host} ({iface} -> {ip}) ==========")
    c = conn(host)
    clients[host] = (c, iface, ip)
    run(c, "setup", SETUP_TMPL.format(pw=PASS, iface=iface, ip=ip))

# 2. Ping from each end to the other
peers = {
    "172.16.11.218": "10.10.10.2",
    "172.16.14.8":   "10.10.10.1",
}
for host, (c, iface, ip) in clients.items():
    print(f"\n========== ping from {host} ({iface}) -> {peers[host]} ==========")
    run(c, "ping", PING_TMPL.format(iface=iface, peer=peers[host]))

for c, _, _ in clients.values():
    c.close()
