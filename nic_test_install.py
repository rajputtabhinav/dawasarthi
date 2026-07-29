"""Install sockperf + netperf on both servers (small benchmark tools)."""
import paramiko, threading
USER, PASS = "user", "netweb"
HOSTS = ["172.16.11.218", "172.16.14.8"]

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=180):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

def install(h):
    c = conn(h)
    # check what's already there
    have = {}
    for pkg in ["sockperf", "netperf"]:
        o, _ = run(c, f"command -v {pkg} || echo NO", 5)
        have[pkg] = "NO" not in o
    missing = [p for p, ok in have.items() if not ok]
    if missing:
        cmd = f"echo netweb | sudo -S -p '' apt-get install -y -qq {' '.join(missing)} 2>&1 | tail -3"
        o, _ = run(c, cmd, 180)
        print(f"[{h}] installed {missing}: {o.strip()[-200:]}")
    # verify
    o, _ = run(c, "command -v sockperf; command -v netperf", 5)
    print(f"[{h}] final: {o.strip().replace(chr(10), ' | ')}")
    c.close()

ts = [threading.Thread(target=install, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()
