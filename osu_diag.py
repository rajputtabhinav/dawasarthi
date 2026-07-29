import paramiko, time

USER, PASS = "user", "netweb"

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

# Kill stale procs on both
print("=== killing stale procs ===")
for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h)
    run(c, "pkill -f osu_ ; pkill -f mpirun ; pkill -f orted ; true", 10)
    o, _ = run(c, "pgrep -a -f 'osu_|mpirun|orted' || echo none", 10)
    print(f"  {h}: {o.strip()}")
    c.close()

time.sleep(2)

# Simplest possible mpirun: let UCX/OMPI auto-pick everything
# Start with osu_latency (low traffic, fast feedback)
cc = conn("172.16.14.8")
SIMPLE = (
    "mpirun -np 2 "
    "--host 10.10.10.2,10.10.10.1 "
    "--mca pml ucx "
    "--mca btl ^openib "
    "-x UCX_LOG_LEVEL=info "
    "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt/osu_latency"
)
print(f"\n=== simple test: osu_latency (no pinning, UCX_LOG_LEVEL=info, 60s timeout) ===\n$ {SIMPLE}\n")
t0 = time.time()
try:
    o, e = run(cc, SIMPLE, 60)
    print(f"elapsed: {time.time()-t0:.0f}s")
    print("--- stdout ---"); print(o[:5000])
    print("--- stderr ---"); print(e[:3000])
except Exception as ex:
    print(f"TIMEOUT/ERR after {time.time()-t0:.0f}s: {ex}")

cc.close()
