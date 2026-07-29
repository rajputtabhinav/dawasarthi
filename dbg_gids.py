import paramiko, threading, time
USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

sc = conn("172.16.15.21"); cc = conn("172.16.11.132")

# Show GID table linkage
print("=== GID table search for 10.10.10.x ===")
GID_PROBE = r"""
DEV=bnxt_re0
P=/sys/class/infiniband/$DEV/ports/1
echo "hostname: $(hostname)  netdev: $(cat $P/gid_attrs/ndevs/0 2>/dev/null) etc..."
echo "## GID index attrs (looking for one bound to RoCE iface and v2 type):"
for i in $(seq 0 30); do
  G=$(cat $P/gids/$i 2>/dev/null)
  N=$(cat $P/gid_attrs/ndevs/$i 2>/dev/null)
  T=$(cat $P/gid_attrs/types/$i 2>/dev/null)
  if [ -n "$G" ] && [ "$G" != "0000:0000:0000:0000:0000:0000:0000:0000" ]; then
    printf "  idx=%-3d gid=%s  ndev=%-12s type=%s\n" "$i" "$G" "$N" "$T"
  fi
done
echo "## RDMA-CM stats:"
echo netweb | sudo -S -p '' rdma resource show | sed 's/^/  /'
"""
for label, c in [("srv21", sc), ("srv132", cc)]:
    print(f"\n--- {label} ---"); print(run(c, GID_PROBE, 15))

# Try ib_send_bw WITHOUT -R (no rdma_cm; uses IB CM via OOB TCP for bootstrap)
print("\n=== Try ib_send_bw WITHOUT -R (using TCP OOB) ===")
for c in [sc, cc]:
    run(c, "echo netweb | sudo -S -p '' pkill -9 -f ib_ 2>/dev/null; sleep 1; true", 10)

holder = {}
def srv():
    holder['s'] = run(sc, "ib_send_bw -d bnxt_re0 -F --report_gbits -D 10 -s 65536 2>&1", 25)
t = threading.Thread(target=srv, daemon=True); t.start()
time.sleep(3)
o = run(cc, "ib_send_bw -d bnxt_re0 -F --report_gbits -D 10 -s 65536 10.10.10.1 2>&1", 25)
print("--- CLIENT ---"); print(o)
t.join(timeout=15)
print("--- SERVER ---"); print(holder.get('s','(none)'))

sc.close(); cc.close()
