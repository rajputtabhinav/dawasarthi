"""Fix srv132's GID table by re-adding the IP (forces bnxt_re to re-enumerate)."""
import paramiko, time, threading

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

cc = conn("172.16.11.132")
print("=== killing any stale perftest ===")
run(cc, "echo netweb | sudo -S -p '' pkill -9 -f ib_ 2>/dev/null; sleep 1; true", 10)

print("\n=== refreshing GID table — link down/up bounce ===")
o,_ = run(cc, """
echo netweb | sudo -S -p '' bash -c '
ip addr show enp1s0np0 | head -5
ip link set enp1s0np0 down
sleep 1
ip link set enp1s0np0 up
sleep 2
ip link set enp1s0np0 mtu 9000
# re-add the IP if it was cleared
ip addr show enp1s0np0 | grep -q "10\\.10\\.10\\.2" || ip addr add 10.10.10.2/24 dev enp1s0np0
ip addr show enp1s0np0 | head -8
'
""", 30)
print(o)

time.sleep(3)
print("\n=== GID table after refresh ===")
GID_PROBE = r"""
P=/sys/class/infiniband/bnxt_re0/ports/1
for i in $(seq 0 30); do
  G=$(cat $P/gids/$i 2>/dev/null)
  N=$(cat $P/gid_attrs/ndevs/$i 2>/dev/null)
  T=$(cat $P/gid_attrs/types/$i 2>/dev/null)
  if [ -n "$G" ] && [ "$G" != "0000:0000:0000:0000:0000:0000:0000:0000" ]; then
    printf "  idx=%-3d gid=%s  ndev=%-12s type=%s\n" "$i" "$G" "$N" "$T"
  fi
done
"""
o,_ = run(cc, GID_PROBE, 15)
print(o)

# Look for 10.10.10.2 mapping
if "0a0a:0a02" in o.lower():
    print(">>> ✓ GID for 10.10.10.2 found")
else:
    print(">>> ⚠ Still no IPv4-mapped GID for 10.10.10.2 — bnxt_re may need a module reload")

# Verify ping still works
o,_ = run(cc, "ping -c 2 -W 2 -I enp1s0np0 10.10.10.1 | tail -3", 10)
print("\n=== ping ==="); print(o)
cc.close()
