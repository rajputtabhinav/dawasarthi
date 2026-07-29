"""
Stage C+D+E through switch:
  C: 5-min sustained TCP (12 procs × 4 streams, NUMA-pinned)
  D: CPU load comparison (TCP vs RoCE at line rate, 60s each, mpstat sampling)
  E: Power consumption (idle / TCP / RoCE) via ipmitool dcmi + turbostat
"""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV = dict(host="172.16.15.21",  ip="10.10.10.1", dev="bnxt_re0",
           iface="ens8f1np1", base_core=40)
CLI = dict(host="172.16.11.132", ip="10.10.10.2", dev="bnxt_re0",
           iface="enp1s0np0", base_core=4)

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
        run(c, "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|mpstat|turbostat|netperf' 2>/dev/null; sleep 1; true", 15)
    time.sleep(1)

# ----- STAGE C: 5-min sustained TCP -----
print("=" * 70); print("# STAGE C — 5-MIN SUSTAINED TCP through switch"); print("=" * 70)
kill_all()

TCP_DUR = 300  # 5 minutes
SRV_CMD = (
    "C=40; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    "  taskset -c $C iperf3 -s -B 10.10.10.1 -p $p -1 > /tmp/iperf_s_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait"
)
CLI_CMD = (
    "C=4; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    f"  taskset -c $C iperf3 -c 10.10.10.1 -p $p -t {TCP_DUR} -P 4 -i 0 > /tmp/iperf_c_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait; echo DONE"
)
holder={}
def srv(): holder['s'] = run(sc, SRV_CMD, TCP_DUR+90)
t=threading.Thread(target=srv,daemon=True); t.start()
time.sleep(2)
t0 = time.time()
run(cc, CLI_CMD, TCP_DUR+90)
print(f"  client elapsed: {time.time()-t0:.0f}s")
t.join(timeout=30)

# Parse TCP results
o,_ = run(cc, "for f in /tmp/iperf_c_5{201..212}.log; do grep '\\[SUM\\].*sender' $f | head -1; done", 15)
total = 0.0; retr = 0; n = 0
for line in o.splitlines():
    m = re.search(r"([\d.]+)\s*Gbits/sec\s+(\d+)", line)
    if m:
        total += float(m.group(1)); retr += int(m.group(2)); n += 1
print(f"  >>> TCP 5-min through switch: {total:.2f} Gb/s aggregate ({n} ports), total retransmits: {retr}")

# ----- STAGE D: CPU comparison (TCP vs RoCE at line rate, 60s each) -----
print("\n" + "=" * 70); print("# STAGE D — CPU LOAD comparison (60s each)"); print("=" * 70)
kill_all()

CPU_DUR = 60

def run_with_mpstat(name, srv_cmd, cli_cmd):
    s_mp = f"mpstat -P ALL 1 {CPU_DUR+10} > /tmp/mpstat_{name}.srv 2>&1"
    c_mp = f"mpstat -P ALL 1 {CPU_DUR+10} > /tmp/mpstat_{name}.cli 2>&1"
    holder = {}
    def m_srv(): holder['s_mp'] = run(sc, s_mp, CPU_DUR+30)
    def m_cli(): holder['c_mp'] = run(cc, c_mp, CPU_DUR+30)
    ts = threading.Thread(target=m_srv, daemon=True); tc = threading.Thread(target=m_cli, daemon=True)
    ts.start(); tc.start()
    time.sleep(2)
    def w_srv(): holder['s_w'] = run(sc, srv_cmd, CPU_DUR+60)
    def w_cli(): holder['c_w'] = run(cc, cli_cmd, CPU_DUR+60)
    tws = threading.Thread(target=w_srv, daemon=True); tws.start()
    time.sleep(2)
    twc = threading.Thread(target=w_cli, daemon=True); twc.start()
    twc.join(timeout=CPU_DUR+90); tws.join(timeout=30)
    ts.join(timeout=30); tc.join(timeout=30)
    print(f"  {name}: workload done")

# C-tcp
print("  [D1] TCP iperf3 at line rate, 60s")
kill_all()
TCP_S = (
    "C=40; for p in 5201..5212; do : ; done; "
    "C=40; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    "  taskset -c $C iperf3 -s -B 10.10.10.1 -p $p -1 > /tmp/c_iperf_s_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait"
)
TCP_C = (
    "C=4; "
    "for p in 5201 5202 5203 5204 5205 5206 5207 5208 5209 5210 5211 5212; do "
    f"  taskset -c $C iperf3 -c 10.10.10.1 -p $p -t {CPU_DUR} -P 4 -i 0 > /tmp/c_iperf_c_$p.log 2>&1 & "
    "  C=$((C+1)); "
    "done; wait; echo DONE"
)
run_with_mpstat("CPU_TCP", TCP_S, TCP_C)

# C-roce
print("  [D2] RoCE ib_write_bw at line rate, 60s")
kill_all()
ROCE_S = f"taskset -c 40 ib_write_bw -d {SRV['dev']} -F -R --report_gbits -D {CPU_DUR} -q 4 -s 65536 > /tmp/c_roce_s.log 2>&1"
ROCE_C = f"taskset -c 4 ib_write_bw -d {CLI['dev']} -F -R --report_gbits -D {CPU_DUR} -q 4 -s 65536 {SRV['ip']} > /tmp/c_roce_c.log 2>&1"
run_with_mpstat("CPU_RoCE", ROCE_S, ROCE_C)

# Get throughputs for normalisation
tcp_g = 0; n=0
o,_ = run(cc, "for f in /tmp/c_iperf_c_5{201..212}.log; do grep '\\[SUM\\].*sender' $f | head -1; done", 10)
for line in o.splitlines():
    m = re.search(r"([\d.]+)\s*Gbits/sec", line)
    if m: tcp_g += float(m.group(1)); n += 1
roce_g = 0
o,_ = run(cc, "cat /tmp/c_roce_c.log", 5)
for line in o.splitlines():
    m = re.match(r"\s*65536\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
    if m: roce_g = float(m.group(2)); break
print(f"\n  TCP throughput during CPU test: {tcp_g:.2f} Gb/s")
print(f"  RoCE throughput during CPU test: {roce_g:.2f} Gb/s")

# Parse mpstat
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
            usr  = float(toks[cpu_idx+1]); sys_ = float(toks[cpu_idx+3])
            soft = float(toks[cpu_idx+6]); idle = float(toks[-1])
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

A_s = parse_mpstat(run(sc, "cat /tmp/mpstat_CPU_TCP.srv", 15)[0])
A_c = parse_mpstat(run(cc, "cat /tmp/mpstat_CPU_TCP.cli", 15)[0])
B_s = parse_mpstat(run(sc, "cat /tmp/mpstat_CPU_RoCE.srv", 15)[0])
B_c = parse_mpstat(run(cc, "cat /tmp/mpstat_CPU_RoCE.cli", 15)[0])

def fmt(a):
    if not a: return "(no data)"
    return f"busy={a['busy']:5.2f}% usr={a['usr']:5.2f}% sys={a['sys']:5.2f}% soft={a['soft']:5.2f}% idle={a['idle']:5.2f}%"

print("\n  --- CPU summary (through switch) ---")
print(f"  SERVER (srv21):  TCP : {fmt(A_s[0])}")
print(f"  SERVER (srv21):  RoCE: {fmt(B_s[0])}")
print(f"  CLIENT (srv132): TCP : {fmt(A_c[0])}")
print(f"  CLIENT (srv132): RoCE: {fmt(B_c[0])}")

if A_s[0] and B_s[0] and tcp_g and roce_g:
    tcs = A_s[0]['busy']/tcp_g; rcs = B_s[0]['busy']/roce_g
    rs = tcs/rcs if rcs else 0
    tcc = A_c[0]['busy']/tcp_g; rcc = B_c[0]['busy']/roce_g
    rc = tcc/rcc if rcc else 0
    print(f"\n  CPU cost per Gb/s:")
    print(f"    SERVER:  TCP {tcs:.4f}  RoCE {rcs:.4f}  -> TCP burns {rs:.1f}x more")
    print(f"    CLIENT:  TCP {tcc:.4f}  RoCE {rcc:.4f}  -> TCP burns {rc:.1f}x more")

# ----- STAGE E: POWER CONSUMPTION -----
print("\n" + "=" * 70); print("# STAGE E — POWER CONSUMPTION (idle / TCP / RoCE)"); print("=" * 70)
kill_all()

POW_DUR = 30  # 30s of each phase

def sample_power(c, label, dur):
    """Sample IPMI DCMI power every second for `dur` seconds."""
    o, _ = run(c, f"for i in $(seq 1 {dur}); do "
                  f"  echo netweb | sudo -S -p '' ipmitool dcmi power reading 2>/dev/null | "
                  f"    grep -i 'Instantaneous' | head -1; sleep 1; "
                  f"done", dur+30)
    vals = []
    for line in o.splitlines():
        m = re.search(r"(\d+)\s*Watts", line)
        if m: vals.append(int(m.group(1)))
    return vals

def sample_pkg_power(c, label, dur):
    """Sample CPU package power via turbostat."""
    o, _ = run(c, f"echo netweb | sudo -S -p '' turbostat --quiet --num_iterations {dur} "
                  f"--interval 1 --show PkgWatt 2>&1 | awk '/^[0-9]/ {{print $1}}'", dur+30)
    vals = []
    for line in o.splitlines():
        try: vals.append(float(line.strip()))
        except: pass
    return vals

def stats(arr):
    if not arr: return None
    return dict(min=min(arr), max=max(arr), avg=sum(arr)/len(arr), n=len(arr))

# Phase 1: IDLE
print("  [E1] sampling power IDLE (30s)")
def s_pow(): pass
# sample both sides in parallel
power_idle = {'srv': {}, 'cli': {}}
def sx(): power_idle['srv']['ipmi'] = sample_power(sc, 'srv', POW_DUR)
def cx(): power_idle['cli']['ipmi'] = sample_power(cc, 'cli', POW_DUR)
def sx2(): power_idle['srv']['pkg'] = sample_pkg_power(sc, 'srv', POW_DUR)
def cx2(): power_idle['cli']['pkg'] = sample_pkg_power(cc, 'cli', POW_DUR)
ths = [threading.Thread(target=fn, daemon=True) for fn in [sx,cx,sx2,cx2]]
for t in ths: t.start()
for t in ths: t.join(timeout=POW_DUR+45)
print(f"    srv21  IPMI: {stats(power_idle['srv'].get('ipmi'))}    pkg: {stats(power_idle['srv'].get('pkg'))}")
print(f"    srv132 IPMI: {stats(power_idle['cli'].get('ipmi'))}    pkg: {stats(power_idle['cli'].get('pkg'))}")

# Phase 2: TCP at line rate, sampling power
print("\n  [E2] starting TCP at line rate, sampling power (30s)")
kill_all()
holder={}
def srv(): holder['s'] = run(sc, TCP_S, 90)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
TCP_C_dur = TCP_C.replace(f"-t {CPU_DUR}", f"-t {POW_DUR+10}")
def cli(): holder['c'] = run(cc, TCP_C_dur, 90)
tcli = threading.Thread(target=cli, daemon=True); tcli.start()
time.sleep(3)  # let traffic stabilize
power_tcp = {'srv': {}, 'cli': {}}
def sx_t(): power_tcp['srv']['ipmi'] = sample_power(sc, 'srv', POW_DUR)
def cx_t(): power_tcp['cli']['ipmi'] = sample_power(cc, 'cli', POW_DUR)
def sx2_t(): power_tcp['srv']['pkg'] = sample_pkg_power(sc, 'srv', POW_DUR)
def cx2_t(): power_tcp['cli']['pkg'] = sample_pkg_power(cc, 'cli', POW_DUR)
ths = [threading.Thread(target=fn, daemon=True) for fn in [sx_t,cx_t,sx2_t,cx2_t]]
for t in ths: t.start()
for t in ths: t.join(timeout=POW_DUR+45)
tcli.join(timeout=60); t.join(timeout=30)
print(f"    srv21  IPMI: {stats(power_tcp['srv'].get('ipmi'))}    pkg: {stats(power_tcp['srv'].get('pkg'))}")
print(f"    srv132 IPMI: {stats(power_tcp['cli'].get('ipmi'))}    pkg: {stats(power_tcp['cli'].get('pkg'))}")

# Phase 3: RoCE at line rate, sampling power
print("\n  [E3] starting RoCE at line rate, sampling power (30s)")
kill_all()
holder={}
def srv(): holder['s'] = run(sc, f"taskset -c 40 ib_write_bw -d {SRV['dev']} -F -R --report_gbits -D {POW_DUR+15} -q 4 -s 65536 > /tmp/p_roce_s.log 2>&1", 90)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
def cli(): holder['c'] = run(cc, f"taskset -c 4 ib_write_bw -d {CLI['dev']} -F -R --report_gbits -D {POW_DUR+15} -q 4 -s 65536 {SRV['ip']} > /tmp/p_roce_c.log 2>&1; echo DONE", 90)
tcli = threading.Thread(target=cli, daemon=True); tcli.start()
time.sleep(3)
power_roce = {'srv': {}, 'cli': {}}
def sx_r(): power_roce['srv']['ipmi'] = sample_power(sc, 'srv', POW_DUR)
def cx_r(): power_roce['cli']['ipmi'] = sample_power(cc, 'cli', POW_DUR)
def sx2_r(): power_roce['srv']['pkg'] = sample_pkg_power(sc, 'srv', POW_DUR)
def cx2_r(): power_roce['cli']['pkg'] = sample_pkg_power(cc, 'cli', POW_DUR)
ths = [threading.Thread(target=fn, daemon=True) for fn in [sx_r,cx_r,sx2_r,cx2_r]]
for t in ths: t.start()
for t in ths: t.join(timeout=POW_DUR+45)
tcli.join(timeout=60); t.join(timeout=30)
print(f"    srv21  IPMI: {stats(power_roce['srv'].get('ipmi'))}    pkg: {stats(power_roce['srv'].get('pkg'))}")
print(f"    srv132 IPMI: {stats(power_roce['cli'].get('ipmi'))}    pkg: {stats(power_roce['cli'].get('pkg'))}")

# Power summary
print("\n  ====== POWER SUMMARY ======")
def avg_or_n(d, key): return f"{d[key]['avg']:.1f}W" if d and d.get(key) else "n/a"
def avg_or_nP(s): return f"{s['avg']:.1f}W (n={s['n']})" if s else "n/a"

print(f"  srv21  total IPMI power:   idle={avg_or_nP(stats(power_idle['srv'].get('ipmi')))}  "
      f"TCP={avg_or_nP(stats(power_tcp['srv'].get('ipmi')))}  "
      f"RoCE={avg_or_nP(stats(power_roce['srv'].get('ipmi')))}")
print(f"  srv132 total IPMI power:   idle={avg_or_nP(stats(power_idle['cli'].get('ipmi')))}  "
      f"TCP={avg_or_nP(stats(power_tcp['cli'].get('ipmi')))}  "
      f"RoCE={avg_or_nP(stats(power_roce['cli'].get('ipmi')))}")
print(f"  srv21  CPU package power:  idle={avg_or_nP(stats(power_idle['srv'].get('pkg')))}  "
      f"TCP={avg_or_nP(stats(power_tcp['srv'].get('pkg')))}  "
      f"RoCE={avg_or_nP(stats(power_roce['srv'].get('pkg')))}")
print(f"  srv132 CPU package power:  idle={avg_or_nP(stats(power_idle['cli'].get('pkg')))}  "
      f"TCP={avg_or_nP(stats(power_tcp['cli'].get('pkg')))}  "
      f"RoCE={avg_or_nP(stats(power_roce['cli'].get('pkg')))}")

sc.close(); cc.close()
