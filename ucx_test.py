import paramiko, threading, time

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

# Kill stale
for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h); run(c, "pkill -9 -f 'osu_|mpirun|orted|ucx_perftest' ; true", 10); c.close()
time.sleep(2)

sc = conn("172.16.11.218")
cc = conn("172.16.14.8")

# Confirm ucx_perftest installed
o1, _ = run(sc, "command -v ucx_perftest", 5)
o2, _ = run(cc, "command -v ucx_perftest", 5)
print(f"server: {o1.strip() or 'MISSING'}")
print(f"client: {o2.strip() or 'MISSING'}")
if not o1.strip() or not o2.strip():
    print("Installing ucx-utils...")
    for c in [sc, cc]:
        run(c, "echo netweb | sudo -S -p '' apt-get install -y ucx-utils 2>&1 | tail -2", 60)

# Server in BG thread
holder = {}
SCMD = ("UCX_TLS=rc,sm,self UCX_NET_DEVICES=rocep202s0f1:1 UCX_IB_GID_INDEX=3 "
        "ucx_perftest -t tag_lat -p 12345 > /tmp/ucxs.log 2>&1")
def srv():
    holder["o"], holder["e"] = run(sc, SCMD, 60)
th = threading.Thread(target=srv, daemon=True); th.start()
time.sleep(2)

# Client
CCMD = ("UCX_TLS=rc,sm,self UCX_NET_DEVICES=rocep1s0:1 UCX_IB_GID_INDEX=3 "
        "ucx_perftest -t tag_lat -p 12345 10.10.10.1 2>&1 | head -40")
print(f"\nclient: {CCMD}")
t0 = time.time()
o, _ = run(cc, CCMD, 30)
print(f"elapsed {time.time()-t0:.0f}s")
print(o)

# Get server log
time.sleep(1)
slog, _ = run(sc, "cat /tmp/ucxs.log", 5)
print("\n--- server log ---"); print(slog[:1500])

sc.close(); cc.close()
