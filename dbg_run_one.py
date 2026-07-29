import paramiko, threading, time
USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

sc = conn("172.16.15.21"); cc = conn("172.16.11.132")

# Kill stale
for c in [sc, cc]:
    run(c, "echo netweb | sudo -S -p '' pkill -9 -f ib_ 2>/dev/null; sleep 1; true", 10)

# Permissions / capabilities
print("=== /dev/infiniband/* perms ===")
for label, c in [("srv21", sc), ("srv132", cc)]:
    o = run(c, "ls -l /dev/infiniband/ 2>&1; id", 5)
    print(f"--- {label} ---"); print(o)

# Try a single ib_send_bw foreground (no taskset/no redirect — see live stderr)
print("\n=== server: ib_send_bw on srv21 in BG ===")
def srv_run():
    return run(sc, "ib_send_bw -d bnxt_re0 -F -R --report_gbits -D 10 -s 65536 2>&1", 25)
holder = {}
def srv(): holder['s'] = srv_run()
t = threading.Thread(target=srv, daemon=True); t.start()
time.sleep(3)

print("\n=== client: ib_send_bw on srv132 -> 10.10.10.1 ===")
o = run(cc, "ib_send_bw -d bnxt_re0 -F -R --report_gbits -D 10 -s 65536 10.10.10.1 2>&1", 25)
print(o)

t.join(timeout=15)
print("\n=== server output ===")
print(holder.get('s', '(no srv output)'))

sc.close(); cc.close()
