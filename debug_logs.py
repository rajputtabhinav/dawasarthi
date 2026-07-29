import paramiko, time
USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=20):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

cc = conn("172.16.14.8")
print("=== mpstat sample (5 lines) ===")
print(run(cc, "head -15 /tmp/mpstat_iperf3_TCP.cli", 5))
print("\n=== iperf3 client logs — SUM lines ===")
print(run(cc, "grep -H SUM /tmp/iperf_c_5{201..212}.log | head -40", 5))
print("\n=== which iperf3 client logs exist ===")
print(run(cc, "ls -la /tmp/iperf_c_*.log 2>&1 | head -20", 5))
print("\n=== first iperf client log (port 5201) ===")
print(run(cc, "tail -15 /tmp/iperf_c_5201.log", 5))
sc = conn("172.16.11.218")
print("\n=== iperf server logs (srv218) ===")
print(run(sc, "ls -la /tmp/iperf_s_*.log 2>&1 | head", 5))
print(run(sc, "tail -8 /tmp/iperf_s_5201.log", 5))
cc.close(); sc.close()
