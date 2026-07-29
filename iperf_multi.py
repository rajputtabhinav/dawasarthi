"""
Multi-process iperf3: 4 parallel iperf3 instances on 4 ports, each pinned to
its own CPU core, 4 streams each. This bypasses the iperf3 single-thread cap.

Server: 10.10.10.1 (172.16.11.218) — bind iperf3 -s on 5201..5204 pinned to cores 2..5
Client: 10.10.10.2 (172.16.14.8)  — 4 iperf3 -c processes pinned to cores 2..5
"""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SERVER_HOST = "172.16.11.218"; SERVER_IP = "10.10.10.1"
CLIENT_HOST = "172.16.14.8"

DUR     = 300
INSTANCES = 4
STREAMS_PER = 4         # 4 procs × 4 streams = 16 streams total, spread across 4 cores
PORTS = [5201, 5202, 5203, 5204]
CORES = [2, 3, 4, 5]    # pin both sides to same logical cores (independent CPUs)

def conn(h):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    return c

def run(c, cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

sc = conn(SERVER_HOST)
cc = conn(CLIENT_HOST)

print("=== killing any stale iperf3 on server ===")
run(sc, "echo netweb | sudo -S -p '' pkill -x iperf3 ; true", 10)
time.sleep(1)

# Start N iperf3 servers as background daemons
print(f"=== starting {INSTANCES} iperf3 servers on ports {PORTS} ===")
for p, core in zip(PORTS, CORES):
    cmd = (f"nohup taskset -c {core} iperf3 -s -B {SERVER_IP} -p {p} -1 "
           f">/tmp/iperf3-s-{p}.log 2>&1 &")
    run(sc, cmd, 10)
time.sleep(2)
o, _ = run(sc, "pgrep -a iperf3", 10)
print(o.strip())

# Launch N clients in parallel on the client host using a single ssh exec
# Each process is pinned to a distinct core.
client_cmd_parts = []
for p, core in zip(PORTS, CORES):
    client_cmd_parts.append(
        f"taskset -c {core} iperf3 -c {SERVER_IP} -p {p} -t {DUR} "
        f"-P {STREAMS_PER} -i 0 --connect-timeout 5000 > /tmp/iperf3-c-{p}.log 2>&1 &"
    )
launch = " ".join(client_cmd_parts) + " wait; echo ALL-DONE"
print(f"=== launching {INSTANCES} parallel iperf3 clients ({DUR}s) ===")
print(f"(streams_per={STREAMS_PER}, total streams={INSTANCES*STREAMS_PER}, "
      f"cores={CORES})")
t0 = time.time()
co, ce = run(cc, launch, DUR + 120)
print(f"elapsed: {time.time()-t0:.0f}s")
print(co.strip()[-200:] if co else "(no client stdout)")
if ce.strip(): print("STDERR:", ce.strip()[-300:])

# Read per-port logs from client
print("\n=== per-instance summary (client side logs) ===")
total = 0.0
per_inst = []
for p in PORTS:
    o, _ = run(cc, f"tail -25 /tmp/iperf3-c-{p}.log", 10)
    # Find SUM ... sender line
    m = re.search(r"\[SUM\][^\n]*?([\d.]+)\s*([KMGT])bits/sec[^\n]*sender", o)
    if m:
        val = float(m.group(1))
        unit = m.group(2)
        mult = {"K":1e-6,"M":1e-3,"G":1,"T":1e3}[unit]
        gbps = val * mult
        per_inst.append((p, gbps))
        total += gbps
        print(f"  port {p}: {val} {unit}bits/sec  ({gbps:.2f} Gb/s)")
    else:
        print(f"  port {p}: NO SUMMARY FOUND — last lines:")
        print("\n".join("    " + l for l in o.strip().splitlines()[-6:]))

print(f"\n=== AGGREGATE: {total:.2f} Gb/s across {INSTANCES} processes ===")

sc.close(); cc.close()
