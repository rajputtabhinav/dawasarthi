import paramiko, threading, time, re, sys

USER, PASS = "user", "netweb"
SERVER_HOST = "172.16.11.218"; SERVER_IP = "10.10.10.1"; SERVER_IF = "ens8f1np1"
CLIENT_HOST = "172.16.14.8";   CLIENT_IF = "enp1s0np0"

# Configurable
DUR        = int(sys.argv[1]) if len(sys.argv) > 1 else 60
INSTANCES  = int(sys.argv[2]) if len(sys.argv) > 2 else 8
STREAMS_PER= int(sys.argv[3]) if len(sys.argv) > 3 else 4
BASE_CORE  = 2                 # avoid cpu0/cpu1 which often handle housekeeping
BASE_PORT  = 5201

def conn(h):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    return c
def run(c, cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

ports = [BASE_PORT + i for i in range(INSTANCES)]
cores = [BASE_CORE + i for i in range(INSTANCES)]

sc = conn(SERVER_HOST); cc = conn(CLIENT_HOST)
print(f"=== config: {INSTANCES} instances × {STREAMS_PER} streams "
      f"= {INSTANCES*STREAMS_PER} streams, duration {DUR}s ===")

# Quick NIC queue info
print("\n=== NIC queue/RSS info ===")
for label, c, iface in [("server", sc, SERVER_IF), ("client", cc, CLIENT_IF)]:
    o, _ = run(c, f"ethtool -l {iface} 2>/dev/null | tail -10; echo ---; "
                  f"echo -n 'IRQ count: '; grep -c {iface} /proc/interrupts || echo 0",
               10)
    print(f"  [{label}] {iface}:")
    for line in o.strip().splitlines():
        print(f"    {line}")

# Kill stale servers
run(sc, "echo netweb | sudo -S -p '' pkill -x iperf3 ; true", 10)
time.sleep(1)

# Start servers
print(f"\n=== starting {INSTANCES} iperf3 servers (ports {ports[0]}..{ports[-1]}, "
      f"cores {cores[0]}..{cores[-1]}) ===")
for p, core in zip(ports, cores):
    run(sc, f"nohup taskset -c {core} iperf3 -s -B {SERVER_IP} -p {p} -1 "
            f">/tmp/iperf3-s-{p}.log 2>&1 &", 10)
time.sleep(2)
o, _ = run(sc, "pgrep -c iperf3", 10)
print(f"  server iperf3 procs: {o.strip()}")

# Launch clients
print(f"\n=== launching {INSTANCES} clients ===")
parts = []
for p, core in zip(ports, cores):
    parts.append(f"taskset -c {core} iperf3 -c {SERVER_IP} -p {p} -t {DUR} "
                 f"-P {STREAMS_PER} -i 0 --connect-timeout 5000 "
                 f">/tmp/iperf3-c-{p}.log 2>&1 &")
launch = " ".join(parts) + " wait; echo ALL-DONE"
t0 = time.time()
co, ce = run(cc, launch, DUR + 120)
print(f"  elapsed: {time.time()-t0:.0f}s")
if "ALL-DONE" not in co:
    print("  WARNING: ALL-DONE not seen")
if ce.strip(): print("  STDERR:", ce.strip()[-300:])

# Collect per-instance bitrate
print("\n=== per-instance (client logs) ===")
total = 0.0
detail = []
for p in ports:
    o, _ = run(cc, f"tail -30 /tmp/iperf3-c-{p}.log", 10)
    m = re.search(r"\[SUM\][^\n]*?([\d.]+)\s*([KMGT])bits/sec[^\n]*sender", o)
    if not m:
        m = re.search(r"\[\s*\d+\][^\n]*?([\d.]+)\s*([KMGT])bits/sec[^\n]*sender", o)
    if m:
        val = float(m.group(1))
        unit = m.group(2)
        mult = {"K":1e-6,"M":1e-3,"G":1,"T":1e3}[unit]
        gbps = val * mult
        detail.append((p, gbps))
        total += gbps
        print(f"  port {p}: {gbps:6.2f} Gb/s")
    else:
        print(f"  port {p}: NO SUMMARY")
        for line in o.strip().splitlines()[-5:]:
            print(f"    {line}")

print(f"\n=== AGGREGATE: {total:.2f} Gb/s "
      f"(per-instance avg {total/max(1,len(detail)):.2f} Gb/s) ===")

sc.close(); cc.close()
