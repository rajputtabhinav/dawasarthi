"""Fix route + ensure GIDs populated on both hosts."""
import paramiko, time
USER, PASS = "user", "netweb"
HOSTS = {
    "172.16.15.21":  dict(iface="ens8f1np1", ip="10.10.10.1"),
    "172.16.11.132": dict(iface="enp1s0np0", ip="10.10.10.2"),
}
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

for h, info in HOSTS.items():
    print(f"\n=== {h} ===")
    c = conn(h)
    FIX = f"""
S() {{ echo netweb | sudo -S -p '' "$@" 2>/dev/null; }}
IF={info['iface']}; IP={info['ip']}
# Cleanly remove the IP, then re-add — guarantees route is fresh
S ip addr del $IP/24 dev $IF 2>/dev/null
S ip addr add $IP/24 dev $IF
S ip link set $IF mtu 9000
# Re-add subnet route just in case
S ip route add 10.10.10.0/24 dev $IF 2>/dev/null
echo "--- post fix ---"
ip -4 -o addr show $IF | awk '{{print "  IP:    ",$2,$4}}'
ip route show 10.10.10.0/24 | sed 's/^/  ROUTE: /'
echo "--- GIDs with IPv4 mapping for 10.10.10.x ---"
for i in $(seq 0 30); do
  G=$(cat /sys/class/infiniband/bnxt_re0/ports/1/gids/$i 2>/dev/null)
  if echo "$G" | grep -q "ffff:0a0a:0a0"; then
    T=$(cat /sys/class/infiniband/bnxt_re0/ports/1/gid_attrs/types/$i 2>/dev/null)
    printf "  idx=%-3d gid=%s  type=%s\\n" "$i" "$G" "$T"
  fi
done
"""
    print(run(c, FIX, 30))
    c.close()

# Ping check
print("\n=== bidirectional ping ===")
cc = conn("172.16.11.132"); sc = conn("172.16.15.21")
print(run(cc, "ping -c 3 -W 2 -I enp1s0np0 10.10.10.1 | tail -4", 15))
print(run(sc, "ping -c 3 -W 2 -I ens8f1np1 10.10.10.2 | tail -4", 15))
cc.close(); sc.close()
