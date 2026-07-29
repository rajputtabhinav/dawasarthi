import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV_HOST = "172.16.11.218"; SRV_IP = "10.10.10.1"; SRV_DEV = "rocep202s0f1"; SRV_CORE = 40
CLI_HOST = "172.16.14.8";                          CLI_DEV = "rocep1s0";   CLI_CORE = 4

# Two BW recipes per tool: 64K (perftest default) and 1MB.
# ib_read_bw also gets --outs 16 for outstanding reads.
SIZES = [65536, 1048576]
TESTS = ["ib_send_bw", "ib_write_bw", "ib_read_bw"]

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

sc = conn(SRV_HOST); cc = conn(CLI_HOST)
results = []

for tool in TESTS:
    for size in SIZES:
        print(f"\n{'='*70}\n### {tool} -s {size} -D 30 -q 4\n{'='*70}")
        run(sc, f"echo netweb | sudo -S -p '' pkill -x {tool} ; true", 10)
        time.sleep(1)
        extra_outs = " --outs 16" if tool == "ib_read_bw" else ""
        common = (f"-F -R --report_gbits -D 30 -q 4 -s {size}{extra_outs}")
        s_cmd = (f"taskset -c {SRV_CORE} {tool} -d {SRV_DEV} {common} "
                 f"> /tmp/{tool}_{size}.srv.log 2>&1")
        c_cmd = (f"taskset -c {CLI_CORE} {tool} -d {CLI_DEV} {common} {SRV_IP} "
                 f"> /tmp/{tool}_{size}.cli.log 2>&1")
        # Launch server in BG thread
        holder = {}
        def srv():
            holder["o"], holder["e"] = run(sc, s_cmd, 120)
        th = threading.Thread(target=srv, daemon=True); th.start()
        time.sleep(2)
        t0 = time.time()
        cli_o, cli_e = run(cc, c_cmd, 120)
        th.join(timeout=30)
        elapsed = time.time() - t0
        # Read client log
        o, _ = run(cc, f"cat /tmp/{tool}_{size}.cli.log", 20)
        # find result row
        # ib_*_bw output rows look like:
        # 65536    30000   90.50           90.45     0.172560
        # cols: bytes iters bw_peak[Gb/s] bw_avg[Gb/s] msgrate[Mpps]
        row = None
        for l in o.splitlines():
            if re.match(rf"\s*{size}\s+\d+\s+[\d.]+", l):
                row = l; break
        if row:
            print(f"   {row}")
            parts = row.split()
            try:
                bw_peak = float(parts[2]); bw_avg = float(parts[3])
                msgrate = float(parts[4]) if len(parts) > 4 else 0
            except (ValueError, IndexError):
                bw_peak = bw_avg = msgrate = 0
            results.append((tool, size, bw_peak, bw_avg, msgrate))
            print(f"   >>> peak={bw_peak} Gb/s  avg={bw_avg} Gb/s  msgrate={msgrate} Mpps   (elapsed {elapsed:.0f}s)")
        else:
            print(f"   NO RESULT — log tail:")
            for l in o.strip().splitlines()[-8:]:
                print(f"     {l}")
            results.append((tool, size, 0, 0, 0))

print("\n\n" + "=" * 80)
print("# RDMA bandwidth summary")
print("=" * 80)
print(f"{'tool':<14} {'size':>10} {'peak Gb/s':>12} {'avg Gb/s':>12} {'msgrate Mpps':>14}")
print("-" * 80)
for tool, size, p, a, m in results:
    print(f"{tool:<14} {size:>10} {p:>12.2f} {a:>12.2f} {m:>14.3f}")

sc.close(); cc.close()
