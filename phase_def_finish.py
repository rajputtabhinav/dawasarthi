"""Resume Phases D (QP=64,128 + atomics), E (lat under load), F (mixed)."""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV_HOST = "172.16.11.218"; SRV_IP = "10.10.10.1"; SRV_DEV = "rocep202s0f1"; SRV_IF = "ens8f1np1"; SRV_CORE = 40
CLI_HOST = "172.16.14.8";   CLI_DEV = "rocep1s0";    CLI_IF = "enp1s0np0";  CLI_CORE = 4

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=120):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

sc = conn(SRV_HOST); cc = conn(CLI_HOST)

def kill_all():
    for c in [sc, cc]:
        run(c, "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|netperf' 2>/dev/null ; sleep 1; true", 10)
    time.sleep(2)

# ---- QP=64, QP=128 (resumed) ----
print("=" * 70)
print("# PHASE D continued — ib_write_bw QP=64, 128")
print("=" * 70)
for q in [64, 128]:
    kill_all()
    SCMD = f"taskset -c {SRV_CORE} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 15 -q {q} -s 65536 -p 17{q:03d} > /tmp/phD_q{q}.srv 2>&1"
    CCMD = f"taskset -c {CLI_CORE} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 15 -q {q} -s 65536 -p 17{q:03d} {SRV_IP} > /tmp/phD_q{q}.cli 2>&1"
    holder={}
    def srv(): holder['s']=run(sc, SCMD, 60)
    t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
    run(cc, CCMD, 60); t.join(timeout=10)
    o,_ = run(cc, f"cat /tmp/phD_q{q}.cli", 5)
    bw = "?"
    for line in o.splitlines():
        m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
        if m: bw = f"{m.group(2)} Gb/s"; break
    print(f"  QP={q:3d} : avg = {bw}")

# ---- Atomics quick check ----
print("\n  [D] RDMA atomics (fetch-add) — quick check")
kill_all()
SCMD = f"taskset -c {SRV_CORE} ib_atomic_lat -d {SRV_DEV} -F -R -n 1000 -p 17500 > /tmp/atom.srv 2>&1"
CCMD = f"taskset -c {CLI_CORE} ib_atomic_lat -d {CLI_DEV} -F -R -n 1000 -p 17500 {SRV_IP} > /tmp/atom.cli 2>&1"
holder={}
def srv(): holder['s']=run(sc, SCMD, 30)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
run(cc, CCMD, 30); t.join(timeout=5)
o,_ = run(cc, "cat /tmp/atom.cli", 5)
found_row = False
for line in o.splitlines():
    if re.match(r"\s*\d+\s+\d+\s+[\d.]+", line):
        parts = line.split()
        if len(parts) >= 5:
            print(f"    fetch-add atomic: msg={parts[0]}B iters={parts[1]} t_min={parts[2]}us t_typ={parts[4]}us")
            found_row = True
            break
if not found_row:
    print("    (no result line — last 4 lines of log:)")
    for l in o.strip().splitlines()[-4:]: print(f"      {l}")

# ---- PHASE E: latency under load ----
print("\n" + "=" * 70)
print("# PHASE E — Latency under load (saturating BG + lat measurement)")
print("=" * 70)
kill_all()

print("  launching saturating ib_write_bw (60s background, port 17999)...")
BG_S = f"taskset -c {SRV_CORE+4} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 60 -q 8 -s 65536 -p 17999 > /tmp/phE_bg.srv 2>&1"
BG_C = f"taskset -c {CLI_CORE+4} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 60 -q 8 -s 65536 -p 17999 {SRV_IP} > /tmp/phE_bg.cli 2>&1"
holder={}
def bgs(): holder['bs']=run(sc, BG_S, 90)
def bgc(): holder['bc']=run(cc, BG_C, 90)
ts=threading.Thread(target=bgs,daemon=True); tc=threading.Thread(target=bgc,daemon=True)
ts.start(); time.sleep(2); tc.start(); time.sleep(8)

print("  running ib_send_lat under load (port 17998)...")
LAT_S = f"taskset -c {SRV_CORE+6} ib_send_lat -d {SRV_DEV} -F -R -n 100000 -s 8 -p 17998 > /tmp/phE_lat.srv 2>&1"
LAT_C = f"taskset -c {CLI_CORE+6} ib_send_lat -d {CLI_DEV} -F -R -n 100000 -s 8 -p 17998 {SRV_IP} > /tmp/phE_lat.cli 2>&1"
holder2={}
def lats(): holder2['s']=run(sc, LAT_S, 60)
tls=threading.Thread(target=lats,daemon=True); tls.start(); time.sleep(2)
run(cc, LAT_C, 60); tls.join(timeout=10)

o,_ = run(cc, "cat /tmp/phE_lat.cli", 5)
print("  latency under heavy load (8B msg):")
for line in o.splitlines():
    if re.match(r"\s*\d+\s+\d+\s+[\d.]+", line):
        parts = line.split()
        if len(parts) >= 9:
            print(f"    size={parts[0]}B iters={parts[1]}  min={parts[2]}us  typ={parts[4]}us  "
                  f"avg={parts[5]}us  stdev={parts[6]}us")
            print(f"        99%={parts[7]}us  99.9%={parts[8]}us")
            break

# also read BG bw for context
time.sleep(2)
bo,_ = run(cc, "cat /tmp/phE_bg.cli", 5)
for line in bo.splitlines():
    m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)\s+", line)
    if m:
        print(f"  (background ib_write_bw was running at {m.group(2)} Gb/s)")
        break

kill_all(); ts.join(timeout=5); tc.join(timeout=5)

# ---- PHASE F: mixed RoCE + TCP ----
print("\n" + "=" * 70)
print("# PHASE F — Mixed RoCE + TCP coexistence (60s)")
print("=" * 70)
kill_all()

print("  launching ib_write_bw (RoCE) + iperf3 (TCP) at the same time on the same link")
ROCE_S = f"taskset -c {SRV_CORE} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -p 18888 > /tmp/phF_roce.srv 2>&1"
ROCE_C = f"taskset -c {CLI_CORE} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -p 18888 {SRV_IP} > /tmp/phF_roce.cli 2>&1"
TCP_S  = "iperf3 -s -B 10.10.10.1 -p 18877 -1 > /tmp/phF_tcp.srv 2>&1"
TCP_C  = f"taskset -c {CLI_CORE+4} iperf3 -c 10.10.10.1 -p 18877 -t 60 -P 4 -i 0 > /tmp/phF_tcp.cli 2>&1"

holder={}
def rs(): holder['rs']=run(sc, ROCE_S, 90)
def tps(): holder['ts']=run(sc, TCP_S, 90)
trs=threading.Thread(target=rs,daemon=True); tts=threading.Thread(target=tps,daemon=True)
trs.start(); tts.start(); time.sleep(3)

def rc(): holder['rc']=run(cc, ROCE_C, 90)
def tpc(): holder['tc']=run(cc, TCP_C, 90)
trc=threading.Thread(target=rc,daemon=True); ttc=threading.Thread(target=tpc,daemon=True)
trc.start(); ttc.start()
t0=time.time(); trc.join(timeout=120); ttc.join(timeout=120)
trs.join(timeout=10); tts.join(timeout=10)
print(f"  elapsed {time.time()-t0:.0f}s")

o,_ = run(cc, "cat /tmp/phF_roce.cli", 5)
roce_bw = "?"
for line in o.splitlines():
    m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
    if m: roce_bw = m.group(2); break
o,_ = run(cc, "tail -8 /tmp/phF_tcp.cli", 5)
tcp_bw = "?"
for line in o.splitlines():
    if "[SUM]" in line and "sender" in line:
        m = re.search(r"([\d.]+)\s*Gbits/sec", line)
        if m: tcp_bw = m.group(1); break
print(f"    RoCE BW (concurrent): {roce_bw} Gb/s")
print(f"    TCP  BW (concurrent): {tcp_bw} Gb/s")
try:
    s = float(roce_bw) + float(tcp_bw)
    print(f"    SUM (shared 100G link): {s:.2f} Gb/s")
except: pass

# ---- Final counters ----
print("\n" + "=" * 70)
print("# Counter delta (after all phases)")
print("=" * 70)
kill_all()
def snap(c, iface):
    o,_ = run(c, f"ethtool -S {iface} | grep -E '^[[:space:]]*(rx_total_frames|tx_total_frames|"
                 f"rx_bytes:|tx_bytes:|rx_stat_discard|rx_fcs_err|rx_pcs_symbol_err|rx_align_err|"
                 f"rx_fec_uncorrectable|tx_pause_frames|rx_pause_frames|link_down_events|"
                 f"rx_stat_err|tx_err|rx_discard_packets_cos4|rx_total_ring_discards):'", 20)
    d = {}
    for line in o.splitlines():
        if ':' in line:
            k, v = line.split(':', 1); k=k.strip(); v=v.strip()
            try: d[k] = int(v)
            except: pass
    return d

fs = snap(sc, SRV_IF); fc = snap(cc, CLI_IF)
print("\n  srv218 current:")
for k in sorted(fs):
    print(f"    {k:40s} {fs[k]}")
print("\n  srv148 current:")
for k in sorted(fc):
    print(f"    {k:40s} {fc[k]}")

sc.close(); cc.close()
