"""
CPU-load comparison: RoCE (ib_write_bw) vs TCP (iperf3) at ~line rate.
Captures mpstat per-second per-core CPU usage on BOTH sides during each test,
plus pidstat for the workload processes.

For each test:
  - 60 s duration
  - mpstat -P ALL 1 65 captured on both srv218 and srv148
  - pidstat -u 1 65 captured on both
  - throughput recorded

Output: side-by-side comparison showing how much CPU each workload spent
to push ~100 Gb/s of traffic.
"""
import paramiko, threading, time, re, statistics, sys

USER, PASS = "user", "netweb"
SRV = dict(host="172.16.11.218", ip="10.10.10.1", dev="rocep202s0f1",
           iface="ens8f1np1", base_core=40, n_cores=128, label="srv218 (Xeon 6338)")
CLI = dict(host="172.16.14.8",   ip="10.10.10.2", dev="rocep1s0",
           iface="enp1s0np0",  base_core=4,  n_cores=64,  label="srv148 (EPYC 9135)")

DUR = 60

def conn(h):
    for _ in range(4):
        try:
            c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(h, username=USER, password=PASS, timeout=30,
                      banner_timeout=45, auth_timeout=45,
                      allow_agent=False, look_for_keys=False); return c
        except: time.sleep(5)
    raise RuntimeError(f"connect failed {h}")
def run(c, cmd, t=300):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

sc = conn(SRV["host"]); cc = conn(CLI["host"])

def kill_all():
    for c in [sc, cc]:
        run(c, "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|mpstat|pidstat' 2>/dev/null; sleep 1; true", 15)
    time.sleep(2)

# Make sure sysstat is installed
print("=== ensuring sysstat (mpstat / pidstat) is installed ===")
for c, label in [(sc, "srv218"), (cc, "srv148")]:
    o, _ = run(c, "command -v mpstat && command -v pidstat || echo MISSING", 5)
    if "MISSING" in o:
        print(f"  installing on {label}...")
        run(c, "echo netweb | sudo -S -p '' apt-get install -y -qq sysstat 2>&1 | tail -2", 120)
    o, _ = run(c, "mpstat -V 2>&1 | head -1; pidstat -V 2>&1 | head -1", 5)
    print(f"  {label}: {o.strip()}")

# ---------- the test runner ----------
def parse_mpstat(text, dur):
    """Extract per-core averages from mpstat -P ALL 1 N output.
    Returns dict: { 'all_avg': {usr,sys,irq,soft,idle}, 'per_core': {core: {...}}, 'top5': [...]} """
    # mpstat output lines look like:
    # 14:24:50      CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle
    # 14:24:51      all    1.10    0.00    0.20    0.00    0.00    0.45    0.00    0.00    0.00   98.25
    # 14:24:51        0    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00
    per_core_samples = {}  # core -> list of (usr,sys,soft,idle)
    all_samples = []        # list of (usr,sys,soft,idle) for 'all' rows
    for line in text.splitlines():
        toks = line.split()
        if len(toks) < 12: continue
        # second column is CPU id or 'all'
        try:
            time.strptime(toks[0], "%H:%M:%S")
        except:
            continue
        if toks[1] == "CPU": continue
        try:
            usr = float(toks[2]); sys_ = float(toks[4]); soft = float(toks[7]); idle = float(toks[-1])
        except: continue
        if toks[1] == "all":
            all_samples.append((usr, sys_, soft, idle))
        else:
            try:
                core = int(toks[1])
                per_core_samples.setdefault(core, []).append((usr, sys_, soft, idle))
            except: pass
    # average the 'Average:' line ones — actually mpstat prints both per-second AND an Average row at the end with header "Average:"
    # For robustness, just compute from samples ourselves
    def avg(samples):
        if not samples: return None
        n = len(samples)
        u = sum(s[0] for s in samples)/n
        sy= sum(s[1] for s in samples)/n
        so= sum(s[2] for s in samples)/n
        i = sum(s[3] for s in samples)/n
        return dict(usr=u, sys=sy, soft=so, idle=i, busy=100-i)
    all_avg = avg(all_samples) or {}
    per_core_avg = {c: avg(v) for c, v in per_core_samples.items() if v}
    # top 5 busiest cores
    top5 = sorted(per_core_avg.items(), key=lambda kv: kv[1]['busy'], reverse=True)[:5]
    return all_avg, per_core_avg, top5, len(all_samples)

def run_test(name, server_cmd, client_cmd, sniffer_extra=""):
    print(f"\n{'='*70}\n# Test: {name}\n{'='*70}")
    kill_all()
    # Start mpstat on both
    mpstat_srv = f"mpstat -P ALL 1 {DUR+10} > /tmp/mpstat_{name}.srv 2>&1"
    mpstat_cli = f"mpstat -P ALL 1 {DUR+10} > /tmp/mpstat_{name}.cli 2>&1"
    s_log = {"srv":"", "cli":"", "test_srv":"", "test_cli":""}
    # mpstat in background threads
    def m_srv(): s_log["srv"] = run(sc, mpstat_srv, DUR+30)[0]
    def m_cli(): s_log["cli"] = run(cc, mpstat_cli, DUR+30)[0]
    tm_s = threading.Thread(target=m_srv, daemon=True); tm_c = threading.Thread(target=m_cli, daemon=True)
    tm_s.start(); tm_c.start()
    time.sleep(2)  # let mpstat ramp

    # Launch workload
    def work_srv(): s_log["test_srv"] = run(sc, server_cmd, DUR+60)[0]
    def work_cli(): s_log["test_cli"] = run(cc, client_cmd, DUR+60)[0]
    tw_s = threading.Thread(target=work_srv, daemon=True); tw_s.start()
    time.sleep(3)
    tw_c = threading.Thread(target=work_cli, daemon=True); tw_c.start()

    t0 = time.time()
    tw_c.join(timeout=DUR+90)
    tw_s.join(timeout=30)
    print(f"  workload elapsed: {time.time()-t0:.0f}s")

    # let mpstat finish remaining intervals
    tm_s.join(timeout=30); tm_c.join(timeout=30)

    return s_log

# ----- Test A: iperf3 TCP -----
# 12 NUMA-local instances on client, single iperf3 server bind
# We'll start 12 servers (ports 5201..5212), 12 clients
iperf_srv = (
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    "  taskset -c 40 iperf3 -s -B 10.10.10.1 -p $p -1 > /tmp/iperf_s_$p.log 2>&1 & "
    "done; wait"
)
iperf_cli = (
    "C=4; for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    f"  taskset -c $C iperf3 -c 10.10.10.1 -p $p -t {DUR} -P 4 -i 0 > /tmp/iperf_c_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait; echo DONE"
)
A = run_test("iperf3_TCP", iperf_srv, iperf_cli)

# ----- Test B: RoCE ib_write_bw -----
roce_srv = (
    "taskset -c 40 ib_write_bw -d rocep202s0f1 -F -R --report_gbits "
    f"-D {DUR} -q 4 -s 65536 > /tmp/roce_s.log 2>&1"
)
roce_cli = (
    "taskset -c 4 ib_write_bw -d rocep1s0 -F -R --report_gbits "
    f"-D {DUR} -q 4 -s 65536 10.10.10.1 > /tmp/roce_c.log 2>&1; echo DONE"
)
B = run_test("RoCE_write_bw", roce_srv, roce_cli)

# ----- Parse results -----
def get_throughput_tcp(log):
    # log is stdout from the 'for ... iperf3 -c' command — DONE at end
    # actual results are in /tmp/iperf_c_*.log on srv148; fetch them
    o, _ = run(cc, "for f in /tmp/iperf_c_5{201..212}.log; do tail -5 $f; done", 15)
    bws = []
    for line in o.splitlines():
        if "[SUM]" in line and "sender" in line:
            m = re.search(r"([\d.]+)\s*Gbits/sec", line)
            if m: bws.append(float(m.group(1)))
    return sum(bws), len(bws)
def get_throughput_roce(log):
    o, _ = run(cc, "cat /tmp/roce_c.log", 5)
    for line in o.splitlines():
        m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
        if m: return float(m.group(2)), 1
    return 0.0, 0

tcp_bw, tcp_n = get_throughput_tcp(A["test_cli"])
roce_bw, roce_n = get_throughput_roce(B["test_cli"])

# Parse mpstat for both tests, both sides
A_srv = parse_mpstat(A["srv"], DUR)
A_cli = parse_mpstat(A["cli"], DUR)
B_srv = parse_mpstat(B["srv"], DUR)
B_cli = parse_mpstat(B["cli"], DUR)

def fmt_avg(a):
    if not a: return "(no data)"
    return (f"busy={a['busy']:5.2f}%  usr={a['usr']:5.2f}%  sys={a['sys']:5.2f}%  "
            f"soft={a['soft']:5.2f}%  idle={a['idle']:5.2f}%")

print("\n\n" + "=" * 78)
print("# CPU LOAD COMPARISON — RoCE vs TCP at line rate")
print("=" * 78)

def report(label, A_, B_, side):
    print(f"\n--- {side} ({label}) ---")
    print(f"  TCP (iperf3) :  {fmt_avg(A_[0])}")
    print(f"  RoCE (write) :  {fmt_avg(B_[0])}")
    print(f"  Top 5 busiest cores during TCP:")
    for c, v in A_[2]:
        print(f"    core {c:3d}: busy={v['busy']:5.1f}%  sys={v['sys']:5.1f}%  soft={v['soft']:5.1f}%")
    print(f"  Top 5 busiest cores during RoCE:")
    for c, v in B_[2]:
        print(f"    core {c:3d}: busy={v['busy']:5.1f}%  sys={v['sys']:5.1f}%  soft={v['soft']:5.1f}%")

report(SRV["label"], A_srv, B_srv, "SERVER side (srv218)")
report(CLI["label"], A_cli, B_cli, "CLIENT side (srv148)")

print("\n--- Throughput achieved during these CPU measurements ---")
print(f"  TCP (iperf3, 12 procs × 4 streams) : {tcp_bw:.2f} Gb/s aggregate")
print(f"  RoCE (ib_write_bw, -q 4, single proc) : {roce_bw:.2f} Gb/s")

# Compute the ratio
if A_cli[0] and B_cli[0] and tcp_bw and roce_bw:
    tcp_total_busy = A_cli[0]['busy']
    roce_total_busy = B_cli[0]['busy']
    # CPU cost per Gb/s
    tcp_cost = tcp_total_busy / tcp_bw if tcp_bw else 0
    roce_cost = roce_total_busy / roce_bw if roce_bw else 0
    ratio = tcp_cost / roce_cost if roce_cost else 0
    print(f"\n  Normalised CPU cost (system busy % / Gb/s) — client side:")
    print(f"    TCP : {tcp_cost:.3f}  %busy per Gb/s")
    print(f"    RoCE: {roce_cost:.3f}  %busy per Gb/s")
    if ratio:
        print(f"    >> TCP uses ~{ratio:.1f}× more CPU per Gb/s than RoCE")

sc.close(); cc.close()
