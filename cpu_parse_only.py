"""Read mpstat files from servers and parse — workloads already ran."""
import paramiko, time

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=30):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

def parse_mpstat(text):
    per_core = {}; all_samples = []
    for line in text.splitlines():
        toks = line.split()
        if len(toks) < 11: continue
        cpu_idx = None
        for i in range(1, 5):
            if i < len(toks) and (toks[i] == "all" or toks[i].isdigit()):
                cpu_idx = i; break
        if cpu_idx is None: continue
        try:
            usr  = float(toks[cpu_idx+1])
            sys_ = float(toks[cpu_idx+3])
            soft = float(toks[cpu_idx+6])
            idle = float(toks[-1])
        except (ValueError, IndexError): continue
        cpu = toks[cpu_idx]
        if cpu == "all": all_samples.append((usr, sys_, soft, idle))
        else: per_core.setdefault(int(cpu), []).append((usr, sys_, soft, idle))
    def avg(s):
        if not s: return None
        n=len(s)
        return dict(usr=sum(x[0] for x in s)/n, sys=sum(x[1] for x in s)/n,
                    soft=sum(x[2] for x in s)/n, idle=sum(x[3] for x in s)/n,
                    busy=100-sum(x[3] for x in s)/n)
    all_avg = avg(all_samples) or {}
    per_core_avg = {c: avg(v) for c, v in per_core.items() if v}
    top5 = sorted(per_core_avg.items(), key=lambda kv: kv[1]['busy'], reverse=True)[:5]
    return all_avg, per_core_avg, top5

sc = conn("172.16.11.218"); cc = conn("172.16.14.8")
A_srv_text = run(sc, "cat /tmp/mpstat_iperf3_TCP.srv", 15)
A_cli_text = run(cc, "cat /tmp/mpstat_iperf3_TCP.cli", 15)
B_srv_text = run(sc, "cat /tmp/mpstat_RoCE_write_bw.srv", 15)
B_cli_text = run(cc, "cat /tmp/mpstat_RoCE_write_bw.cli", 15)

# Throughputs (already known)
TCP_GBPS, ROCE_GBPS = 94.34, 98.16

A_srv = parse_mpstat(A_srv_text); A_cli = parse_mpstat(A_cli_text)
B_srv = parse_mpstat(B_srv_text); B_cli = parse_mpstat(B_cli_text)

def fmt(a):
    if not a: return "(no data)"
    return (f"busy={a['busy']:5.2f}%  usr={a['usr']:5.2f}%  sys={a['sys']:5.2f}%  "
            f"soft={a['soft']:5.2f}%  idle={a['idle']:5.2f}%")

print("=" * 78)
print("# CPU LOAD COMPARISON  —  RoCE  vs  TCP  at ~line rate")
print("=" * 78)

def report(side, A_, B_):
    print(f"\n--- {side} ---")
    print(f"  TCP (iperf3)  : {fmt(A_[0])}")
    print(f"  RoCE (write)  : {fmt(B_[0])}")
    print(f"\n  Top 5 busiest cores — TCP iperf3:")
    for c, v in A_[2]:
        print(f"    core {c:3d}: busy={v['busy']:5.1f}%  sys={v['sys']:5.1f}%  soft={v['soft']:5.1f}%")
    print(f"  Top 5 busiest cores — RoCE ib_write_bw:")
    for c, v in B_[2]:
        print(f"    core {c:3d}: busy={v['busy']:5.1f}%  sys={v['sys']:5.1f}%  soft={v['soft']:5.1f}%")

report("SERVER  (srv218, Xeon Gold 6338  ·  128 logical cores)", A_srv, B_srv)
report("CLIENT  (srv148, EPYC 9135       ·  64 logical cores)",  A_cli, B_cli)

print(f"\n\n--- Throughput during the measurements ---")
print(f"  TCP iperf3  (12 procs × 4 streams = 48 streams)  : {TCP_GBPS:.2f} Gb/s")
print(f"  RoCE ib_write_bw (1 proc × 4 QPs)               : {ROCE_GBPS:.2f} Gb/s")

if A_cli[0] and B_cli[0]:
    tc  = A_cli[0]['busy']/TCP_GBPS
    rc  = B_cli[0]['busy']/ROCE_GBPS
    ratio = tc/rc if rc else 0
    print(f"\n--- CPU cost per Gb/s (system-wide busy%) — CLIENT (srv148) ---")
    print(f"  TCP : {tc:.4f} %busy / Gb/s")
    print(f"  RoCE: {rc:.4f} %busy / Gb/s")
    if ratio: print(f"  >> TCP burns ~{ratio:.1f}× more CPU per Gb/s than RoCE")

    tcs = A_srv[0]['busy']/TCP_GBPS if A_srv[0] else 0
    rcs = B_srv[0]['busy']/ROCE_GBPS if B_srv[0] else 0
    rs = tcs/rcs if rcs else 0
    print(f"\n--- CPU cost per Gb/s — SERVER (srv218) ---")
    print(f"  TCP : {tcs:.4f} %busy / Gb/s")
    print(f"  RoCE: {rcs:.4f} %busy / Gb/s")
    if rs: print(f"  >> TCP burns ~{rs:.1f}× more CPU per Gb/s than RoCE")

sc.close(); cc.close()
