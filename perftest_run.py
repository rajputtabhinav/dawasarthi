"""
Full RoCE perftest suite, NUMA-aware.

Server: 172.16.11.218 (10.10.10.1)  device rocep202s0f1   NIC NUMA=1  → core 40
Client: 172.16.14.8   (10.10.10.2)  device rocep1s0       NIC NUMA=0  → core 4

For each test:
  server:  taskset -c <core_s> <tool>      -d rocep202s0f1 -F -R --report_gbits ...
  client:  taskset -c <core_c> <tool> <ip> -d rocep1s0     -F -R --report_gbits ...
Captures both sides, parses bandwidth/latency, builds summary.
"""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV_HOST = "172.16.11.218"; SRV_IP = "10.10.10.1"; SRV_DEV = "rocep202s0f1"; SRV_CORE = 40
CLI_HOST = "172.16.14.8";                          CLI_DEV = "rocep1s0";   CLI_CORE = 4

# (tool, kind, extra_flags)   kind = "bw" or "lat"
TESTS = [
    ("ib_send_bw",  "bw",  "-q 4 -D 30 -a"),
    ("ib_write_bw", "bw",  "-q 4 -D 30 -a"),
    ("ib_read_bw",  "bw",  "-q 4 -D 30 -a"),
    ("ib_send_lat", "lat", "-a -n 5000"),
    ("ib_write_lat","lat", "-a -n 5000"),
    ("ib_read_lat", "lat", "-a -n 5000"),
]

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

sc = conn(SRV_HOST); cc = conn(CLI_HOST)

print(f"# Perftest RoCE suite (server={SRV_HOST}/{SRV_DEV}@core{SRV_CORE} "
      f"client={CLI_HOST}/{CLI_DEV}@core{CLI_CORE})")

results = []

for tool, kind, extra in TESTS:
    print(f"\n{'='*70}\n### {tool}  ({kind})\n{'='*70}")
    # kill stale
    run(sc, f"echo netweb | sudo -S -p '' pkill -x {tool} ; true", 10)
    time.sleep(1)

    common = f"-d __DEV__ -F -R --report_gbits {extra}"
    s_cmd = (f"taskset -c {SRV_CORE} {tool} "
             + common.replace("__DEV__", SRV_DEV)
             + f" > /tmp/{tool}.srv.log 2>&1")
    c_cmd = (f"taskset -c {CLI_CORE} {tool} "
             + common.replace("__DEV__", CLI_DEV)
             + f" {SRV_IP} > /tmp/{tool}.cli.log 2>&1")

    print(f"server: {s_cmd}")
    print(f"client: {c_cmd}")

    # Launch server in background thread
    holder = {}
    def srv():
        holder["o"], holder["e"] = run(sc, s_cmd, 180)
    th = threading.Thread(target=srv, daemon=True); th.start()
    time.sleep(2)

    # Run client (blocks until done)
    t0 = time.time()
    cli_o, cli_e = run(cc, c_cmd, 180)
    th.join(timeout=30)
    print(f"   elapsed: {time.time()-t0:.0f}s")

    # Read client log
    o, _ = run(cc, f"cat /tmp/{tool}.cli.log", 20)

    # Parse perftest table. Lines look like:
    #   8388608    1000          11833.79            11833.78           0.001411
    # columns: #bytes #iterations BW_peak[Gb/s] BW_avg[Gb/s] MsgRate[Mpps]
    # for latency:
    #   8388608    1000          1234.56            1235.67          1240.01
    # cols differ — just print the tail and grab max BW or min latency line.
    lines = o.splitlines()
    table = [l for l in lines if re.match(r"\s*\d+\s+\d+\s+[\d.]+", l)]
    # Print first ~6 and last ~6 of the table
    if table:
        print("--- table (head/tail) ---")
        for l in table[:6]: print("  " + l)
        if len(table) > 12: print("  ...")
        for l in table[-6:]: print("  " + l)

    if kind == "bw":
        # Find max BW_avg (col 4)
        max_bw, max_size = 0.0, "?"
        for l in table:
            parts = l.split()
            try:
                size = parts[0]; bw_avg = float(parts[3])
                if bw_avg > max_bw:
                    max_bw, max_size = bw_avg, size
            except (IndexError, ValueError): pass
        print(f">>> {tool} peak BW: {max_bw:.2f} Gb/s @ msg size {max_size} bytes")
        results.append((tool, "BW(Gb/s)", f"{max_bw:.2f}", f"size={max_size}"))
    else:
        # Latency: find row with smallest size and read its min/typ latency
        # cols: bytes iters t_min t_max t_typ t_avg t_stdev t_99 t_99.9
        # Just grab the row with smallest size (first row) and pull t_typ
        min_lat = None; min_size = "?"; med_lat = None
        for l in table:
            parts = l.split()
            try:
                size = int(parts[0])
                # parts[2] = t_min, parts[5] (or 4) = average
                t_min = float(parts[2])
                # typical position varies — just print full row for first/last
                if min_lat is None or size < int(min_size or 1e18):
                    min_lat = t_min; min_size = parts[0]
            except (IndexError, ValueError): pass
        # Also pull last row's average/typ for medium-msg latency
        print(f">>> {tool} min latency: {min_lat} us  @ msg size {min_size} bytes")
        results.append((tool, "latency(us)", f"{min_lat}", f"size={min_size}"))

print("\n\n" + "=" * 78)
print("# SUMMARY (peak BW / min latency)")
print("=" * 78)
print(f"{'tool':<14} {'metric':<14} {'value':<12} note")
print("-" * 78)
for r in results:
    print(f"{r[0]:<14} {r[1]:<14} {r[2]:<12} {r[3]}")

sc.close(); cc.close()
