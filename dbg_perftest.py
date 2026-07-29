import paramiko
USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

sc = conn("172.16.15.21"); cc = conn("172.16.11.132")
print("=== check perftest binaries on both ===")
for label, c in [("srv21", sc), ("srv132", cc)]:
    print(f"  {label}:", run(c, "command -v ib_send_bw ib_write_bw ib_read_bw ib_send_lat", 5).strip().replace('\n','  '))

print("\n=== last client logs ===")
for tool in ["ib_send_bw_65536", "ib_send_bw_1048576", "ib_write_bw_65536",
             "ib_read_bw_65536", "ib_send_lat", "ib_write_lat", "ib_read_lat", "bidi"]:
    o = run(cc, f"cat /tmp/{tool}.cli 2>/dev/null | head -30", 5)
    print(f"\n--- /tmp/{tool}.cli ---")
    print(o or "(empty)")
print("\n=== last server logs (perftest server side) ===")
for tool in ["ib_send_bw_65536", "ib_write_bw_65536", "ib_read_bw_65536"]:
    o = run(sc, f"cat /tmp/{tool}.srv 2>/dev/null | head -30", 5)
    print(f"\n--- /tmp/{tool}.srv (srv21) ---")
    print(o or "(empty)")

print("\n=== RoCE device + GIDs (srv132) ===")
print(run(cc, "ibv_devinfo -v 2>&1 | head -60", 10))

sc.close(); cc.close()
