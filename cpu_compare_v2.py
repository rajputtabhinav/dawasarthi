"""
CPU-load comparison v2: RoCE (ib_write_bw) vs TCP (iperf3) at ~line rate.
Fixed:
  - mpstat parser handles 'HH:MM:SS AM/PM TZ ...' timestamp format
  - iperf3 servers spread across cores 40-51 (one per core), matching client spread
"""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV = dict(host="172.16.11.218", ip="10.10.10.1", dev="rocep202s0f1",
           iface="ens8f1np1")
CLI = dict(host="172.16.14.8",   ip="10.10.10.2", dev="rocep1s0",
           iface="enp1s0np0")

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

def parse_mpstat(text):
    """Handles mpstat with 12-hour timestamp + TZ:
       e.g.  '02:22:29 PM IST  all   1.10  0.00  0.20 ...'
       Tokens: time, AM/PM, TZ, cpu, %usr, %nice, %sys, %iowait, %irq, %soft, ...
       Or 24-hour:  '14:22:29  all   1.10 ...'  ->  time, cpu, %usr, ...
    """
    per_core = {}
    all_samples = []
    for line in text.splitlines():
        toks = line.split()
        if len(toks) < 11: continue
        # find the CPU token — it's either 'all' or an integer
        cpu_idx = None
        for i in range(1, 5):
            if i < len(toks) and (toks[i] == "all" or toks[i].isdigit()):
                cpu_idx = i; break
        if cpu_idx is None: continue
        # stats start right after
        try:
            usr  = float(toks[cpu_idx+1])
            sys_ = float(toks[cpu_idx+3])     # %sys is 3 fields after CPU (skipping %nice)
            soft = float(toks[cpu_idx+6])     # %soft
            idle = float(toks[-1])
        except (ValueError, IndexError):
            continue
        # skip header rows (where toks[cpu_idx+1] won't parse to float anyway)
        cpu = toks[cpu_idx]
        if cpu == "all":
            all_samples.append((usr, sys_, soft, idle))
        else:
            per_core.setdefault(int(cpu), []).append((usr, sys_, soft, idle))
    def avg(samples):
        if not samples: return None
        n = len(samples)
        return dict(usr=sum(s[0] for s in samples)/n,
                    sys=sum(s[1] for s in samples)/n,
                    soft=sum(s[2] for s in samples)/n,
                    idle=sum(s[3] for s in samples)/n,
                    busy=100-sum(s[3] for s in samples)/n)
    all_avg = avg(all_samples) or {}
    per_core_avg = {c: avg(v) for c, v in per_core.items() if v}
    top5 = sorted(per_core_avg.items(), key=lambda kv: kv[1]['busy'], reverse=True)[:5]
    return all_avg, per_core_avg, top5, len(all_samples)

def run_test(name, server_cmd, client_cmd):
    print(f"\n{'='*70}\n# Test: {name}\n{'='*70}")
    kill_all()
    mpstat_srv = f"mpstat -P ALL 1 {DUR+10} > /tmp/mpstat_{name}.srv 2>&1"
    mpstat_cli = f"mpstat -P ALL 1 {DUR+10} > /tmp/mpstat_{name}.cli 2>&1"
    s_log = {}
    def m_srv(): s_log["srv_raw"] = run(sc, mpstat_srv, DUR+30)[0]
    def m_cli(): s_log["cli_raw"] = run(cc, mpstat_cli, DUR+30)[0]
    tm_s = threading.Thread(target=m_srv, daemon=True); tm_c = threading.Thread(target=m_cli, daemon=True)
    tm_s.start(); tm_c.start()
    time.sleep(2)

    def work_srv(): s_log["test_srv"] = run(sc, server_cmd, DUR+60)[0]
    def work_cli(): s_log["test_cli"] = run(cc, client_cmd, DUR+60)[0]
    tw_s = threading.Thread(target=work_srv, daemon=True); tw_s.start()
    time.sleep(3)
    tw_c = threading.Thread(target=work_cli, daemon=True); tw_c.start()
    t0 = time.time()
    tw_c.join(timeout=DUR+90)
    tw_s.join(timeout=30)
    print(f"  workload elapsed: {time.time()-t0:.0f}s")
    tm_s.join(timeout=30); tm_c.join(timeout=30)
    return s_log

# ---- iperf3 TCP — each server pinned to its own core (40..51), client matches ----
iperf_srv = (
    "C=40; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    "  taskset -c $C iperf3 -s -B 10.10.10.1 -p $p -1 > /tmp/iperf_s_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait"
)
iperf_cli = (
    "C=4; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    f"  taskset -c $C iperf3 -c 10.10.10.1 -p $p -t {DUR} -P 4 -i 0 > /tmp/iperf_c_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait; echo DONE"
)
A = run_test("iperf3_TCP", iperf_srv, iperf_cli)

# ---- RoCE ib_write_bw — single proc each side ----
roce_srv = (
    "taskset -c 40 ib_write_bw -d rocep202s0f1 -F -R --report_gbits "
    f"-D {DUR} -q 4 -s 65536 > /tmp/roce_s.log 2>&1"
)
roce_cli = (
    "taskset -c 4 ib_write_bw -d rocep1s0 -F -R --report_gbits "
    f"-D {DUR} -q 4 -s 65536 10.10.10.1 > /tmp/roce_c.log 2>&1; echo DONE"
)
B = run_test("RoCE_write_bw", roce_srv, roce_cli)

# ---- Throughput pulled from client logs ----
def tcp_bw():
    o, _ = run(cc, "for f in /tmp/iperf_c_5{201..212}.log; do grep '\\[SUM\\].*sender' $f | head -1; done", 15)
    total = 0.0; n = 0
    for line in o.splitlines():
        m = re.search(r"([\d.]+)\s*Gbits/sec", line)
        if m: total += float(m.group(1)); n += 1
    return total, n
def roce_bw():
    o, _ = run(cc, "cat /tmp/roce_c.log", 5)
    for line in o.splitlines():
        m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
        if m: return float(m.group(2)), 1
    return 0.0, 0

tcp_g, tcp_n = tcp_bw()
roce_g, roce_n = roce_bw()

A_srv = parse_mpstat(A["srv_raw"]); A_cli = parse_mpstat(A["cli_raw"])
B_srv = parse_mpstat(B["srv_raw"]); B_cli = parse_mpstat(B["cli_raw"])

def fmt(a):
    if not a: return "(no data)"
    return (f"busy={a['busy']:5.2f}%  usr={a['usr']:5.2f}%  sys={a['sys']:5.2f}%  "
            f"soft={a['soft']:5.2f}%  idle={a['idle']:5.2f}%")

print("\n\n" + "=" * 78)
print("# CPU LOAD COMPARISON — RoCE vs TCP at near line rate")
print("=" * 78)

def report(side, A_, B_):
    print(f"\n--- {side} (across all cores, averaged over {DUR}s) ---")
    print(f"  TCP (iperf3) : {fmt(A_[0])}")
    print(f"  RoCE (write) : {fmt(B_[0])}")
    print(f"\n  Top 5 busiest cores during TCP iperf3:")
    for c, v in A_[2]:
        print(f"    core {c:3d}:  busy={v['busy']:5.1f}%   sys={v['sys']:5.1f}%   soft={v['soft']:5.1f}%")
    print(f"  Top 5 busiest cores during RoCE ib_write_bw:")
    for c, v in B_[2]:
        print(f"    core {c:3d}:  busy={v['busy']:5.1f}%   sys={v['sys']:5.1f}%   soft={v['soft']:5.1f}%")

report("SERVER (srv218 — Xeon 6338, 128 logical cores)", A_srv, B_srv)
report("CLIENT (srv148 — EPYC 9135, 64 logical cores)", A_cli, B_cli)

print(f"\n\n--- Throughput during the measurements ---")
print(f"  TCP iperf3  (12 procs × 4 streams = 48 streams): {tcp_g:.2f} Gb/s  (across {tcp_n} ports)")
print(f"  RoCE ib_write_bw (1 proc, -q 4)               : {roce_g:.2f} Gb/s")

# CPU cost per Gb/s normalised
if A_cli[0] and B_cli[0] and tcp_g and roce_g:
    tcp_cost  = A_cli[0]['busy']  / tcp_g
    roce_cost = B_cli[0]['busy']  / roce_g
    ratio = tcp_cost / roce_cost if roce_cost else 0
    print(f"\n--- CPU cost per Gb/s (system-wide busy% / throughput) — CLIENT side ---")
    print(f"  TCP : {tcp_cost:.4f}  %busy per Gb/s")
    print(f"  RoCE: {roce_cost:.4f}  %busy per Gb/s")
    if ratio:
        print(f"  >> TCP burns ~{ratio:.1f}× more CPU per Gb/s than RoCE")

    tcp_cost_s  = A_srv[0]['busy']  / tcp_g
    roce_cost_s = B_srv[0]['busy']  / roce_g
    ratio_s = tcp_cost_s / roce_cost_s if roce_cost_s else 0
    print(f"\n--- CPU cost per Gb/s — SERVER side ---")
    print(f"  TCP : {tcp_cost_s:.4f}  %busy per Gb/s")
    print(f"  RoCE: {roce_cost_s:.4f}  %busy per Gb/s")
    if ratio_s:
        print(f"  >> TCP burns ~{ratio_s:.1f}× more CPU per Gb/s than RoCE")

sc.close(); cc.close()
