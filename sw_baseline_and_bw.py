"""Stage A+B: Baseline counters, link health, RoCE BW + latency through switch."""
import paramiko, threading, time, re

USER, PASS = "user", "netweb"
SRV = dict(host="172.16.15.21", ip="10.10.10.1", dev="bnxt_re0",
           iface="ens8f1np1", core=40, label="srv21 (Xeon 6338)")
CLI = dict(host="172.16.11.132", ip="10.10.10.2", dev="bnxt_re0",
           iface="enp1s0np0", core=4,  label="srv132 (EPYC 9135)")

def conn(h):
    for _ in range(4):
        try:
            c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(h, username=USER, password=PASS, timeout=30,
                      banner_timeout=45, auth_timeout=45,
                      allow_agent=False, look_for_keys=False); return c
        except: time.sleep(5)
    raise RuntimeError(f"connect failed {h}")
def run(c, cmd, t=180):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

sc = conn(SRV["host"]); cc = conn(CLI["host"])
def kill_all():
    for c in [sc, cc]:
        run(c, "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|mpstat|turbostat|netperf' 2>/dev/null; sleep 1; true", 15)
    time.sleep(1)

# --- Re-check LLDP (now warm) on srv132 100G interface ---
print("=" * 70); print("# LLDP on srv132 100G port (confirm switch in path)"); print("=" * 70)
o, _ = run(cc, "echo netweb | sudo -S -p '' lldpctl enp1s0np0 2>&1 | head -30", 20)
print(o)

# --- Baseline counters & link health ---
print("\n" + "=" * 70); print("# Link health + baseline counters"); print("=" * 70)
HEALTH = r"""
IF=__IF__
echo "## $IF on $(hostname)"
ethtool $IF 2>/dev/null | grep -E 'Speed|Duplex|Port|Link detected' | sed 's/^/  /'
echo "## error/drop/pause counters (non-zero only):"
ethtool -S $IF 2>/dev/null | grep -iE 'err|drop|miss|discard|crc|fcs|symbol|fec|pause|align|under|over|abort' | awk -F: '{gsub(/^[ \t]+/,"",$1); gsub(/^[ \t]+/,"",$2)} $2+0!=0 && $2!="" {printf "  %-50s %s\n", $1, $2}' | head -30
echo "## frame counters (current):"
ethtool -S $IF 2>/dev/null | grep -E 'rx_total_frames|tx_total_frames|rx_bytes:|tx_bytes:|link_down_events' | sed 's/^/  /' | head -10
echo "## PCIe NIC link width:"
NIC_BDF=$(readlink "/sys/class/net/$IF/device" | xargs basename)
echo netweb | sudo -S -p '' lspci -vv -s "$NIC_BDF" 2>/dev/null | grep -E 'LnkCap:|LnkSta:' | sed 's/^/  /'
"""
for label, c, iface in [("srv21", sc, SRV["iface"]), ("srv132", cc, CLI["iface"])]:
    print(f"\n--- {label} ---")
    o, _ = run(c, HEALTH.replace("__IF__", iface), 30)
    print(o)

# --- snapshot baseline counters (keys to track) ---
def snap(c, iface):
    o, _ = run(c, f"ethtool -S {iface} | grep -E '^[[:space:]]*(rx_total_frames|"
                  f"tx_total_frames|rx_bytes:|tx_bytes:|rx_stat_discard|rx_fcs_err|"
                  f"rx_pcs_symbol_err|rx_align_err|rx_fec_uncorrectable|tx_pause_frames|"
                  f"rx_pause_frames|link_down_events|rx_stat_err|tx_err|"
                  f"rx_total_ring_discards|rx_total_oom_discards|rx_total_netpoll_discards|"
                  f"continuous_roce_pause_events|continuous_pause_events):'", 20)
    d = {}
    for line in o.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            k = k.strip(); v = v.strip()
            try: d[k] = int(v)
            except: pass
    return d

base_srv = snap(sc, SRV["iface"]); base_cli = snap(cc, CLI["iface"])
print(f"\nBaseline counter keys captured: srv21={len(base_srv)}, srv132={len(base_cli)}")

# ---- RoCE BW (3 tests × 2 message sizes) ----
print("\n" + "=" * 70); print("# RoCE BW — through switch (30 s each)"); print("=" * 70)
SIZES = [65536, 1048576]
TOOLS = [("ib_send_bw", ""), ("ib_write_bw", ""), ("ib_read_bw", " --outs 16")]
results_bw = []
for tool, extra in TOOLS:
    for size in SIZES:
        kill_all()
        common = f"-F -R --report_gbits -D 30 -q 4 -s {size}{extra}"
        scmd = f"taskset -c {SRV['core']} {tool} -d {SRV['dev']} {common} > /tmp/{tool}_{size}.srv 2>&1"
        ccmd = f"taskset -c {CLI['core']} {tool} -d {CLI['dev']} {common} {SRV['ip']} > /tmp/{tool}_{size}.cli 2>&1"
        holder = {}
        def srv(): holder['s'] = run(sc, scmd, 90)
        t = threading.Thread(target=srv, daemon=True); t.start(); time.sleep(2)
        run(cc, ccmd, 90); t.join(timeout=10)
        o, _ = run(cc, f"cat /tmp/{tool}_{size}.cli", 5)
        bw = "?"
        for line in o.splitlines():
            m = re.match(rf"\s*{size}\s+\d+\s+([\d.]+)\s+([\d.]+)\s+", line)
            if m: bw = float(m.group(2)); break
        print(f"  {tool:<14} size={size:>7}  : avg = {bw} Gb/s")
        results_bw.append((tool, size, bw))

# ---- RoCE Latency (3 tests) ----
print("\n" + "=" * 70); print("# RoCE Latency — through switch"); print("=" * 70)
LAT = [("ib_send_lat", "-a -n 5000"),
       ("ib_write_lat","-a -n 5000"),
       ("ib_read_lat", "-a -n 5000")]
results_lat = []
for tool, extra in LAT:
    kill_all()
    common = f"-F -R --report_gbits {extra}"
    scmd = f"taskset -c {SRV['core']} {tool} -d {SRV['dev']} {common} > /tmp/{tool}.srv 2>&1"
    ccmd = f"taskset -c {CLI['core']} {tool} -d {CLI['dev']} {common} {SRV['ip']} > /tmp/{tool}.cli 2>&1"
    holder = {}
    def srv(): holder['s'] = run(sc, scmd, 120)
    t = threading.Thread(target=srv, daemon=True); t.start(); time.sleep(2)
    run(cc, ccmd, 120); t.join(timeout=10)
    o, _ = run(cc, f"cat /tmp/{tool}.cli", 5)
    # find smallest-size row
    min_lat = None; min_size = None; typ = None; lat99 = None
    for line in o.splitlines():
        toks = line.split()
        if len(toks) < 8: continue
        try:
            size = int(toks[0]); t_min = float(toks[2])
            t_typ = float(toks[4]); t_99 = float(toks[-2])
            if min_size is None or size < min_size:
                min_size = size; min_lat = t_min; typ = t_typ; lat99 = t_99
        except: pass
    print(f"  {tool:<14} : min={min_lat}us  typ={typ}us  99%={lat99}us  @ {min_size}B")
    results_lat.append((tool, min_size, min_lat, typ, lat99))

# ---- Bidirectional ----
print("\n" + "=" * 70); print("# Bidirectional RoCE (60 s, -b)"); print("=" * 70)
kill_all()
scmd = f"taskset -c {SRV['core']} ib_send_bw -d {SRV['dev']} -F -R --report_gbits -D 60 -q 4 -s 65536 -b > /tmp/bidi.srv 2>&1"
ccmd = f"taskset -c {CLI['core']} ib_send_bw -d {CLI['dev']} -F -R --report_gbits -D 60 -q 4 -s 65536 -b {SRV['ip']} > /tmp/bidi.cli 2>&1"
holder={}
def srv(): holder['s'] = run(sc, scmd, 120)
t=threading.Thread(target=srv,daemon=True); t.start(); time.sleep(2)
run(cc, ccmd, 120); t.join(timeout=15)
o,_ = run(cc, "cat /tmp/bidi.cli", 5)
bidi_bw = "?"
for line in o.splitlines():
    m = re.match(r"\s*65536\s+\d+\s+([\d.]+)\s+([\d.]+)", line)
    if m: bidi_bw = float(m.group(2)); break
print(f"  Aggregate bidirectional: {bidi_bw} Gb/s")

# ---- Counter delta after BW/lat phase ----
print("\n" + "=" * 70); print("# Counter delta vs baseline (after BW/lat)"); print("=" * 70)
post_srv = snap(sc, SRV["iface"]); post_cli = snap(cc, CLI["iface"])
print("\n  srv21 deltas (non-zero only):")
for k in sorted(set(base_srv) | set(post_srv)):
    d = post_srv.get(k,0) - base_srv.get(k,0)
    if d:
        mark = " ⚠" if any(s in k for s in ["err","fcs","crc","drop","discard","symbol","align","uncorr","pause"]) else ""
        print(f"    {k:50s} +{d}{mark}")
print("\n  srv132 deltas (non-zero only):")
for k in sorted(set(base_cli) | set(post_cli)):
    d = post_cli.get(k,0) - base_cli.get(k,0)
    if d:
        mark = " ⚠" if any(s in k for s in ["err","fcs","crc","drop","discard","symbol","align","uncorr","pause"]) else ""
        print(f"    {k:50s} +{d}{mark}")

print("\n\n=== Stage A+B summary ===")
for t, s, b in results_bw:
    print(f"  {t:<14} {s:>7}B  : {b} Gb/s")
print(f"  bidirectional : {bidi_bw} Gb/s")
for t, s, mn, ty, t99 in results_lat:
    print(f"  {t:<14} : min={mn}us, typ={ty}us, 99%={t99}us @ {s}B")

sc.close(); cc.close()
