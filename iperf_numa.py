"""
NUMA-aware iperf3:
  Server (172.16.11.218): NIC on node 1 -> pin iperf3 -s to cores 40-51 (node 1)
  Client (172.16.14.8):   NIC on node 0 -> pin iperf3 -c to cores 4-15  (node 0)
Stops irqbalance on the client so our pinning sticks.
"""
import paramiko, threading, time, re, sys

USER, PASS = "user", "netweb"
SERVER_HOST = "172.16.11.218"; SERVER_IP = "10.10.10.1"
CLIENT_HOST = "172.16.14.8"

DUR        = int(sys.argv[1]) if len(sys.argv) > 1 else 60
INSTANCES  = int(sys.argv[2]) if len(sys.argv) > 2 else 12
STREAMS    = int(sys.argv[3]) if len(sys.argv) > 3 else 4
BASE_PORT  = 5201
SERVER_BASE_CORE = 40   # NUMA node 1 on server (NIC's node)
CLIENT_BASE_CORE = 4    # NUMA node 0 on client (NIC's node)

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

sc = conn(SERVER_HOST); cc = conn(CLIENT_HOST)

# Stop irqbalance on client (it would undo any IRQ pinning we set)
print("=== stopping irqbalance on client ===")
o, _ = run(cc, "echo netweb | sudo -S -p '' systemctl stop irqbalance; "
               "systemctl is-active irqbalance", 10)
print(f"  irqbalance: {o.strip().splitlines()[-1] if o.strip() else '?'}")

# Kill stale iperf3 servers
run(sc, "echo netweb | sudo -S -p '' pkill -x iperf3 ; true", 10)
time.sleep(1)

ports = [BASE_PORT + i for i in range(INSTANCES)]
s_cores = [SERVER_BASE_CORE + i for i in range(INSTANCES)]
c_cores = [CLIENT_BASE_CORE + i for i in range(INSTANCES)]

print(f"\n=== config: {INSTANCES} × {STREAMS} streams = {INSTANCES*STREAMS} streams, {DUR}s")
print(f"   server cores {s_cores[0]}..{s_cores[-1]} (NUMA node 1)")
print(f"   client cores {c_cores[0]}..{c_cores[-1]} (NUMA node 0)")

# Start servers
for p, core in zip(ports, s_cores):
    run(sc, f"nohup taskset -c {core} iperf3 -s -B {SERVER_IP} -p {p} -1 "
            f">/tmp/iperf3-s-{p}.log 2>&1 &", 10)
time.sleep(2)
o, _ = run(sc, "pgrep -c iperf3", 10)
print(f"   server procs alive: {o.strip()}")

# Launch all clients in parallel
parts = []
for p, core in zip(ports, c_cores):
    parts.append(f"taskset -c {core} iperf3 -c {SERVER_IP} -p {p} -t {DUR} "
                 f"-P {STREAMS} -i 0 --connect-timeout 5000 "
                 f">/tmp/iperf3-c-{p}.log 2>&1 &")
launch = " ".join(parts) + " wait; echo ALL-DONE"
t0 = time.time()
co, ce = run(cc, launch, DUR + 120)
print(f"   elapsed: {time.time()-t0:.0f}s")

print("\n=== per-instance ===")
total = 0.0
for p in ports:
    o, _ = run(cc, f"tail -30 /tmp/iperf3-c-{p}.log", 10)
    m = re.search(r"\[SUM\][^\n]*?([\d.]+)\s*([KMGT])bits/sec[^\n]*sender", o)
    if not m:
        m = re.search(r"\[\s*\d+\][^\n]*?([\d.]+)\s*([KMGT])bits/sec[^\n]*sender", o)
    if m:
        v = float(m.group(1)); u = m.group(2)
        g = v * {"K":1e-6,"M":1e-3,"G":1,"T":1e3}[u]
        total += g
        print(f"  port {p}: {g:6.2f} Gb/s")
    else:
        print(f"  port {p}: NO SUMMARY")
        for line in o.strip().splitlines()[-4:]:
            print(f"    {line}")

print(f"\n=== AGGREGATE: {total:.2f} Gb/s ===")
sc.close(); cc.close()
