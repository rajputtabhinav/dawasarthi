import paramiko, threading, time, sys

USER, PASS = "user", "netweb"

SERVER_HOST = "172.16.11.218"
SERVER_IP   = "10.10.10.1"
SERVER_IF   = "ens8f1np1"
CLIENT_HOST = "172.16.14.8"
CLIENT_IP   = "10.10.10.2"
CLIENT_IF   = "enp1s0np0"

DUR, STREAMS, INT, PORT = 300, 16, 30, 5201

FIX = r"""
S() { echo netweb | sudo -S -p '' "$@"; }
IF=__IF__
echo "## ring buffers -> max (2047)"
S ethtool -G "$IF" rx 2047 tx 2047 2>&1 | sed 's/^/   /' || true
ethtool -g "$IF" 2>/dev/null | sed -n '/Current hardware/,$p' | head -5 | sed 's/^/   /'

echo "## CPU governor (try cpupower, then sysfs)"
S apt-get install -y -qq linux-tools-common linux-tools-$(uname -r) linux-tools-generic 2>&1 | tail -2 | sed 's/^/   /'
S cpupower frequency-set -g performance 2>&1 | tail -3 | sed 's/^/   /' || true
# fallback for any remaining cpus
for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  cur=$(cat "$g" 2>/dev/null)
  [ "$cur" != "performance" ] && echo performance | S tee "$g" >/dev/null 2>&1
done
echo "   governors (unique): $(cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>/dev/null | sort -u | tr '\n' ' ')"

echo "## scaling driver"
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver 2>/dev/null | sed 's/^/   /'

echo "## final state"
ip -o link show "$IF" | grep -oE 'mtu [0-9]+|qlen [0-9]+' | xargs
ip -4 -o addr show "$IF" | awk '{print "   "$4}'
sysctl -n net.ipv4.tcp_congestion_control | sed 's/^/   cc: /'
sysctl -n net.core.rmem_max | sed 's/^/   rmem_max: /'
"""

def conn(h):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    return c

def run(c, cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

# Apply fixes both ends
sc = conn(SERVER_HOST)
cc = conn(CLIENT_HOST)

for label, c, iface in [("SERVER " + SERVER_HOST, sc, SERVER_IF),
                        ("CLIENT " + CLIENT_HOST, cc, CLIENT_IF)]:
    print(f"\n{'='*70}\n# {label}  ({iface})\n{'='*70}")
    o, e = run(c, FIX.replace("__IF__", iface), 180)
    print(o)
    e = "\n".join(l for l in e.splitlines() if l.strip() and "password" not in l.lower())
    if e:
        print("STDERR:", e)

# Jumbo ping check (DF, payload 8972 = 9000-28)
print(f"\n{'='*70}\n# jumbo ping check (size 8972, DF set)\n{'='*70}")
o, _ = run(cc, f"ping -c 4 -W 2 -M do -s 8972 -I {CLIENT_IF} {SERVER_IP}", 20)
print(o)

# Kill any stale iperf3 on server, then run test
print(f"\n{'='*70}\n# iperf3 — {DUR}s, {STREAMS} streams, interval {INT}s\n{'='*70}")
run(sc, "echo netweb | sudo -S -p '' pkill -x iperf3 ; true", 10)
time.sleep(1)

SCMD = f"iperf3 -s -B {SERVER_IP} -p {PORT} -1"
sout = {}
def srv():
    sout["o"], sout["e"] = run(sc, SCMD, DUR + 90)
t = threading.Thread(target=srv, daemon=True); t.start()
print(f"server: {SCMD}")
time.sleep(3)

CCMD = f"iperf3 -c {SERVER_IP} -p {PORT} -t {DUR} -P {STREAMS} -i {INT} --connect-timeout 5000"
print(f"client: {CCMD}")
sys.stdout.flush()
co, ce = run(cc, CCMD, DUR + 90)
# Only print SUM and per-stream summary lines to keep output sane
for line in co.splitlines():
    if "[SUM]" in line or "sender" in line or "receiver" in line or \
       line.startswith("Connecting") or "iperf Done" in line:
        print(line)
if ce.strip():
    print("CLIENT STDERR:", ce)

t.join(timeout=30)
sc.close(); cc.close()
