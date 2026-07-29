import paramiko, time

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

# Kill stale procs
for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h)
    run(c, "pkill -f osu_ ; pkill -f mpirun ; pkill -f orted ; pkill -9 -f orted ; true", 10)
    c.close()
time.sleep(2)

cc = conn("172.16.14.8")

# Disable OFI/EFA, force UCX
MPI = (
    "RDMAV_FORK_SAFE=1 FI_PROVIDER=^efa "
    "mpirun -np 2 "
    "--host 10.10.10.2,10.10.10.1 "
    "--mca pml ucx "
    "--mca btl ^openib,ofi,tcp "
    "--mca mtl ^ofi "
    "--mca opal_common_ofi_provider_include ^efa "
    "-x RDMAV_FORK_SAFE -x FI_PROVIDER "
    "-x UCX_TLS=rc,sm,self "
    "-x UCX_LOG_LEVEL=warn "
    "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt/osu_latency"
)
print(f"$ {MPI}\n")
t0 = time.time()
o, e = run(cc, MPI, 90)
print(f"elapsed: {time.time()-t0:.0f}s")
print("--- stdout ---"); print(o[:6000])
print("--- stderr ---"); print(e[:3000])
cc.close()
