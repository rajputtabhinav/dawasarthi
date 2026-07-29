"""
Phases B–F in one efficient script.
B: Bidirectional RoCE BW (-b) + bidirectional TCP via two iperf3
C: UDP throughput + sockperf ping-pong PPS
D: RDMA atomics + many-QP scaling
E: Latency under load (ib_send_lat while ib_write_bw saturates)
F: Mixed RoCE + TCP concurrently
All on the 10.10.10.x back-to-back link only.
"""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV_HOST = "172.16.11.218"; SRV_IP = "10.10.10.1"; SRV_DEV = "rocep202s0f1"; SRV_IF = "ens8f1np1"; SRV_CORE = 40
CLI_HOST = "172.16.14.8";   CLI_IP = "10.10.10.2"; CLI_DEV = "rocep1s0";    CLI_IF = "enp1s0np0";  CLI_CORE = 4

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
        run(c, "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|netperf' ; true", 10)
    time.sleep(1)

# --------- BASELINE COUNTERS ---------
def snapshot(c, iface):
    o, _ = run(c, f"ethtool -S {iface} | grep -E 'rx_total_frames|tx_total_frames|"
                  f"rx_bytes:|tx_bytes:|rx_discards_pkts|rx_discard_packets|"
                  f"rx_stat_discard|rx_fcs_err|rx_pcs_symbol_err|rx_align_err|"
                  f"rx_fec_uncorrectable|tx_pause_frames|rx_pause_frames|"
                  f"link_down_events|rx_stat_err|tx_err|missed_irqs|"
                  f"rx_total_ring_discards|tx_total_ring_discards'", 20)
    d = {}
    for line in o.splitlines():
        if ':' in line:
            k, v = line.split(':', 1); k=k.strip(); v=v.strip()
            try: d[k] = int(v)
            except: pass
    return d

print("=== capturing baseline counters ===")
base_srv = snapshot(sc, SRV_IF)
base_cli = snapshot(cc, CLI_IF)
print(f"  baseline keys: {len(base_srv)} srv, {len(base_cli)} cli")

# --------- PHASE B: bidirectional ---------
print("\n" + "=" * 70 + "\n# PHASE B — Bidirectional RoCE (ib_send_bw -b) 60s\n" + "=" * 70)
kill_all()
SCMD = f"taskset -c {SRV_CORE} ib_send_bw -d {SRV_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -b > /tmp/phB.srv 2>&1"
CCMD = f"taskset -c {CLI_CORE} ib_send_bw -d {CLI_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -b {SRV_IP} > /tmp/phB.cli 2>&1"
holder={}
def srv(): holder['s']=run(sc, SCMD, 90)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
t0=time.time(); run(cc, CCMD, 90); print(f"  elapsed {time.time()-t0:.0f}s")
t.join(timeout=10)
o,_ = run(cc, "cat /tmp/phB.cli", 5)
m = re.search(r"\s+65536\s+\d+\s+([\d.]+)\s+([\d.]+)", o)
if m:
    print(f"  RESULT: peak={m.group(1)} Gb/s  avg={m.group(2)} Gb/s  (each direction, sum to aggregate)")
    # bidirectional in perftest -b shows AGGREGATE in the avg column
    print(f"  >>> Bidirectional aggregate: {float(m.group(2)):.2f} Gb/s (~ {float(m.group(2))/2:.2f} Gb/s each way)")
else:
    print("  output tail:");
    for l in o.strip().splitlines()[-6:]: print(f"    {l}")

# --------- PHASE C: UDP + PPS ---------
print("\n" + "=" * 70 + "\n# PHASE C — UDP throughput + PPS (sockperf)\n" + "=" * 70)
kill_all()

# C1: iperf3 UDP bulk
print("\n  [C1] iperf3 UDP -P 8 -b 100G 30s (bulk UDP throughput)")
SCMD = "iperf3 -s -B 10.10.10.1 -1 > /tmp/phC1.srv 2>&1"
CCMD = "iperf3 -c 10.10.10.1 -u -b 100G -P 8 -t 30 -l 1400 > /tmp/phC1.cli 2>&1"
holder={}
def srv(): holder['s']=run(sc, SCMD, 60)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
run(cc, CCMD, 60); t.join(timeout=5)
o,_ = run(cc, "tail -20 /tmp/phC1.cli", 5)
# parse SUM lines
sender = receiver = lost = total = "?"
for line in o.splitlines():
    if "[SUM]" in line:
        if "sender" in line:
            sender = line
        elif "receiver" in line:
            receiver = line
        elif "%)" in line:
            # the SUM total line with lost packets
            total = line
print(f"    sender: {sender}")
print(f"    receiv: {receiver}")

# C2: sockperf throughput (PPS test)
print("\n  [C2] sockperf throughput (PPS / Mpps with 64-byte messages, 20s)")
kill_all()
SCMD = "sockperf server --tcp -i 10.10.10.1 -p 11111 > /tmp/phC2.srv 2>&1"
CCMD = "sockperf throughput --tcp -i 10.10.10.1 -p 11111 -m 64 -t 20 > /tmp/phC2.cli 2>&1"
holder={}
def srv(): holder['s']=run(sc, SCMD, 45)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
run(cc, CCMD, 45); kill_all(); t.join(timeout=5)
o,_ = run(cc, "tail -30 /tmp/phC2.cli", 5)
print("    sockperf output (key lines):")
for line in o.splitlines():
    if any(k in line.lower() for k in ["mpps","msgrate","bw","drops","sent","received"]):
        print(f"      {line}")

# C3: sockperf ping-pong (small-msg latency)
print("\n  [C3] sockperf ping-pong (round-trip latency, 14B, 10s)")
SCMD = "sockperf server --tcp -i 10.10.10.1 -p 11112 > /tmp/phC3.srv 2>&1"
CCMD = "sockperf ping-pong --tcp -i 10.10.10.1 -p 11112 -m 14 -t 10 --full-rtt > /tmp/phC3.cli 2>&1"
holder={}
def srv(): holder['s']=run(sc, SCMD, 30)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
run(cc, CCMD, 30); kill_all(); t.join(timeout=5)
o,_ = run(cc, "tail -25 /tmp/phC3.cli", 5)
for line in o.splitlines():
    if any(k in line.lower() for k in ["percentile","avg-lat","median","summary","min-lat","max-lat","stdev"]):
        print(f"      {line}")

# --------- PHASE D: atomics + many-QP ---------
print("\n" + "=" * 70 + "\n# PHASE D — RDMA atomics + many-QP scaling\n" + "=" * 70)
kill_all()

# D1: atomic latency
for tool, fname in [("ib_atomic_lat", "phD_atomic_lat"), ("ib_atomic_bw", "phD_atomic_bw")]:
    print(f"\n  [D] {tool} (fetch-add atomic)")
    extra = "-D 15 -q 4" if "bw" in tool else "-n 5000"
    SCMD = f"taskset -c {SRV_CORE} {tool} -d {SRV_DEV} -F -R --report_gbits -A FA {extra} > /tmp/{fname}.srv 2>&1"
    CCMD = f"taskset -c {CLI_CORE} {tool} -d {CLI_DEV} -F -R --report_gbits -A FA {extra} {SRV_IP} > /tmp/{fname}.cli 2>&1"
    holder={}
    def srv(): holder['s']=run(sc, SCMD, 60)
    t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
    run(cc, CCMD, 60); t.join(timeout=5)
    o,_ = run(cc, f"tail -8 /tmp/{fname}.cli", 5)
    for line in o.splitlines():
        if re.match(r"\s*\d+\s+\d+\s+[\d.]+", line):
            print(f"      {line.strip()}")

# D2: many-QP scaling for ib_write_bw
print("\n  [D] ib_write_bw QP scaling (-q 1, 16, 64, 128) 15s each:")
for q in [1, 16, 64, 128]:
    kill_all()
    SCMD = f"taskset -c {SRV_CORE} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 15 -q {q} -s 65536 > /tmp/phD_q{q}.srv 2>&1"
    CCMD = f"taskset -c {CLI_CORE} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 15 -q {q} -s 65536 {SRV_IP} > /tmp/phD_q{q}.cli 2>&1"
    holder={}
    def srv(): holder['s']=run(sc, SCMD, 45)
    t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
    run(cc, CCMD, 45); t.join(timeout=5)
    o,_ = run(cc, f"cat /tmp/phD_q{q}.cli", 5)
    bw = "?"
    for line in o.splitlines():
        m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)\s+", line)
        if m: bw = f"{m.group(2)} Gb/s"; break
    print(f"      QP={q:3d} : avg = {bw}")

# --------- PHASE E: latency under load ---------
print("\n" + "=" * 70 + "\n# PHASE E — Latency under load (tail %iles)\n" + "=" * 70)
kill_all()

# Start ib_write_bw saturating in background, then run ib_send_lat
print("\n  Step 1: launching saturating ib_write_bw (60s background)...")
BG_S = f"taskset -c {SRV_CORE+1} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 60 -q 8 -s 65536 -p 19999 > /tmp/phE_bg.srv 2>&1"
BG_C = f"taskset -c {CLI_CORE+1} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 60 -q 8 -s 65536 -p 19999 {SRV_IP} > /tmp/phE_bg.cli 2>&1"
holder={}
def bgs(): holder['bs']=run(sc, BG_S, 90)
def bgc(): holder['bc']=run(cc, BG_C, 90)
ts=threading.Thread(target=bgs,daemon=True); tc=threading.Thread(target=bgc,daemon=True)
ts.start(); time.sleep(2); tc.start()
time.sleep(8)  # let it ramp up

print("  Step 2: running ib_send_lat on a different port (10s) under load...")
LAT_S = f"taskset -c {SRV_CORE+2} ib_send_lat -d {SRV_DEV} -F -R -n 50000 -s 8 -p 19998 > /tmp/phE_lat.srv 2>&1"
LAT_C = f"taskset -c {CLI_CORE+2} ib_send_lat -d {CLI_DEV} -F -R -n 50000 -s 8 -p 19998 {SRV_IP} > /tmp/phE_lat.cli 2>&1"
holder2={}
def lats(): holder2['s']=run(sc, LAT_S, 60)
tls=threading.Thread(target=lats,daemon=True); tls.start(); time.sleep(2)
run(cc, LAT_C, 60); tls.join(timeout=10)

# Read latency results
o,_ = run(cc, "cat /tmp/phE_lat.cli", 5)
print("  latency under load (8 B):")
for line in o.splitlines():
    if re.match(r"\s*\d+\s+\d+\s+[\d.]+", line):
        # cols: size iters t_min t_max t_typ t_avg t_stdev t_99 t_99.9
        parts = line.split()
        if len(parts) >= 9:
            print(f"      size={parts[0]} min={parts[2]}us typ={parts[4]}us avg={parts[5]}us "
                  f"stdev={parts[6]}us 99%={parts[7]}us 99.9%={parts[8]}us")
            break

# wait for BG to finish (or kill)
time.sleep(2); kill_all(); ts.join(timeout=5); tc.join(timeout=5)

# --------- PHASE F: mixed RoCE + TCP ---------
print("\n" + "=" * 70 + "\n# PHASE F — Mixed RoCE + TCP coexistence (60s)\n" + "=" * 70)
kill_all()

# Start iperf3 server on srv, ib_write_bw server on srv (different ports)
print("  Step: launching ib_write_bw (RoCE) + iperf3 (TCP) at the same time")
ROCE_S = f"taskset -c {SRV_CORE} ib_write_bw -d {SRV_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -p 18888 > /tmp/phF_roce.srv 2>&1"
ROCE_C = f"taskset -c {CLI_CORE} ib_write_bw -d {CLI_DEV} -F -R --report_gbits -D 60 -q 4 -s 65536 -p 18888 {SRV_IP} > /tmp/phF_roce.cli 2>&1"
TCP_S  = "iperf3 -s -B 10.10.10.1 -p 18877 -1 > /tmp/phF_tcp.srv 2>&1"
TCP_C  = f"taskset -c {CLI_CORE+4} iperf3 -c 10.10.10.1 -p 18877 -t 60 -P 4 -i 0 > /tmp/phF_tcp.cli 2>&1"

holder={}
def rs(): holder['rs']=run(sc, ROCE_S, 90)
def ts2(): holder['ts']=run(sc, TCP_S, 90)
def rc(): holder['rc']=run(cc, ROCE_C, 90)
def tc(): holder['tc']=run(cc, TCP_C, 90)
trs=threading.Thread(target=rs,daemon=True); tts=threading.Thread(target=ts2,daemon=True)
trs.start(); tts.start(); time.sleep(2)
trc=threading.Thread(target=rc,daemon=True); ttc=threading.Thread(target=tc,daemon=True)
trc.start(); ttc.start()
t0=time.time(); trc.join(timeout=90); ttc.join(timeout=90); trs.join(timeout=10); tts.join(timeout=10)
print(f"  elapsed {time.time()-t0:.0f}s")

o,_ = run(cc, "cat /tmp/phF_roce.cli", 5)
roce_bw = "?"
for line in o.splitlines():
    m = re.match(r"\s*\d+\s+\d+\s+([\d.]+)\s+([\d.]+)\s+", line)
    if m: roce_bw = m.group(2); break
o,_ = run(cc, "tail -8 /tmp/phF_tcp.cli", 5)
tcp_bw = "?"
for line in o.splitlines():
    if "[SUM]" in line and "sender" in line:
        m = re.search(r"([\d.]+)\s*Gbits/sec", line)
        if m: tcp_bw = m.group(1); break
print(f"    RoCE BW (concurrent): {roce_bw} Gb/s")
print(f"    TCP  BW (concurrent): {tcp_bw} Gb/s")
print(f"    sum: {(float(roce_bw)+float(tcp_bw)) if roce_bw!='?' and tcp_bw!='?' else '?'} Gb/s")

# --------- FINAL COUNTERS ---------
print("\n" + "=" * 70 + "\n# Final counter delta vs baseline\n" + "=" * 70)
kill_all()
final_srv = snapshot(sc, SRV_IF)
final_cli = snapshot(cc, CLI_IF)
print("\n  srv218 deltas (only non-zero changes):")
for k in sorted(set(base_srv) | set(final_srv)):
    d = final_srv.get(k, 0) - base_srv.get(k, 0)
    if d:
        marker = " ⚠" if any(s in k for s in ['err','fcs','crc','drop','discard','symbol','align','uncorr','pause']) else ""
        print(f"    {k:50s} +{d}{marker}")
print("\n  srv148 deltas (only non-zero changes):")
for k in sorted(set(base_cli) | set(final_cli)):
    d = final_cli.get(k, 0) - base_cli.get(k, 0)
    if d:
        marker = " ⚠" if any(s in k for s in ['err','fcs','crc','drop','discard','symbol','align','uncorr','pause']) else ""
        print(f"    {k:50s} +{d}{marker}")

sc.close(); cc.close()
print("\n=== Phases B–F complete ===")
