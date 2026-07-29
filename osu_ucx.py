import paramiko, time

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h); run(c, "pkill -9 -f 'osu_|mpirun|orted' ; true", 10); c.close()
time.sleep(1)

LAUNCH = conn("172.16.14.8")
OSU = "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt"

# Pure UCX path with: EFA off, fork-safe, hwloc OpenCL probe off (was crashing)
MPI = (
    "mpirun -np 2 --host srv148,srv218 "
    "--mca pml ucx --mca pml_ucx_priority 100 "
    "--mca osc ucx "
    "--mca btl ^openib,ofi,tcp,uct "
    "--mca mtl ^ofi "
    "--mca plm_rsh_args '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR' "
    "-x UCX_TLS=rc,sm,self "
    "-x UCX_LOG_LEVEL=warn "
    "-x RDMAV_FORK_SAFE=1 "
    "-x HWLOC_COMPONENTS=-opencl "
    "-x FI_PROVIDER=tcp "
    f"{OSU}/osu_latency"
)
print(f"$ {MPI}\n")
t0 = time.time()
o, e = run(LAUNCH, MPI, 60)
print(f"elapsed {time.time()-t0:.0f}s")
print("--- STDOUT ---"); print(o[:4000])
if e.strip():
    print("--- STDERR ---")
    print("\n".join(l for l in e.splitlines() if l.strip() and "deprecat" not in l.lower())[:2500])
LAUNCH.close()
