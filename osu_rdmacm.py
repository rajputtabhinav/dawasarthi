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

# Force rdmacm for connection (udcm needs multicast which fails on RoCE),
# bind to the RoCE subnet, allow RoCE (ETH link)
MPI = (
    "mpirun -np 2 --host srv148,srv218 "
    "--mca pml ob1 "
    "--mca btl openib,vader,self "
    "--mca btl_openib_allow_ib true "
    "--mca btl_openib_cpc_include rdmacm "
    "--mca btl_openib_if_include rocep1s0:1,rocep202s0f1:1 "
    "--mca btl_openib_warn_default_gid_prefix 0 "
    "--mca btl_openib_warn_no_device_params_found 0 "
    "--mca mtl ^ofi "
    "--mca plm_rsh_args '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR' "
    "-x RDMAV_FORK_SAFE=1 "
    f"{OSU}/osu_latency"
)
print(f"$ {MPI}\n")
t0 = time.time()
o, e = run(LAUNCH, MPI, 60)
print(f"elapsed {time.time()-t0:.0f}s")
print("OUT:", o[:3000])
if e.strip():
    err = [l for l in e.splitlines() if l.strip() and "deprecat" not in l.lower()]
    if err: print("ERR:", "\n".join(err)[:2500])
LAUNCH.close()
