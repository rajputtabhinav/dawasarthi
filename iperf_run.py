import paramiko
import threading
import time
import sys

SERVER_HOST = "172.16.11.218"   # iperf3 -s lives here
SERVER_IP   = "10.10.10.1"
CLIENT_HOST = "172.16.14.8"
USER, PASS  = "user", "netweb"

DUR     = 300   # 5 minutes
STREAMS = 16
INT     = 30    # interval (s) reports on client side
PORT    = 5201

def conn(h):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    return c

def run(c, cmd, timeout):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")

print("=== checking iperf3 ===")
sc = conn(SERVER_HOST)
cc = conn(CLIENT_HOST)
for label, c in [("server", sc), ("client", cc)]:
    o, _ = run(c, "command -v iperf3 || echo MISSING", 10)
    o = o.strip()
    if "MISSING" in o or not o:
        print(f"  {label}: installing iperf3...")
        io, ie = run(c, "echo netweb | sudo -S -p '' apt-get install -y iperf3", 180)
        print(f"  {label}: install done")
    else:
        print(f"  {label}: {o}")

# Make sure no stale iperf3 server is bound
print("=== killing any stale iperf3 server on", SERVER_HOST, "===")
run(sc, "echo netweb | sudo -S -p '' pkill -x iperf3 ; true", 10)
time.sleep(1)

# Start server in a background thread (-1 = exit after one client)
SERVER_CMD = f"iperf3 -s -B {SERVER_IP} -p {PORT} -1"
server_out = {"o": "", "e": ""}
def server_thread():
    o, e = run(sc, SERVER_CMD, DUR + 90)
    server_out["o"] = o
    server_out["e"] = e

t = threading.Thread(target=server_thread, daemon=True)
t.start()
print(f"=== server started: {SERVER_CMD} ===")
time.sleep(3)

CLIENT_CMD = (f"iperf3 -c {SERVER_IP} -p {PORT} -t {DUR} -P {STREAMS} "
              f"-i {INT} --connect-timeout 5000")
print(f"=== client: {CLIENT_CMD} ===")
print(f"(running for {DUR}s = {DUR//60} min, please wait...)")
sys.stdout.flush()

co, ce = run(cc, CLIENT_CMD, DUR + 90)
print(co)
if ce.strip():
    print("CLIENT STDERR:", ce)

t.join(timeout=30)
if server_out["o"].strip() or server_out["e"].strip():
    print("=== server log ===")
    if server_out["o"].strip():
        print(server_out["o"])
    if server_out["e"].strip():
        print("server STDERR:", server_out["e"])

sc.close(); cc.close()
