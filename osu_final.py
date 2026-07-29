import paramiko, time

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

# pre-cache srv148/srv218 host keys on both hosts
print("=== caching host keys for srv148/srv218 on both ===")
for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h)
    run(c, "ssh-keyscan -H srv148 srv218 10.10.10.1 10.10.10.2 >> ~/.ssh/known_hosts 2>/dev/null", 20)
    o, _ = run(c, "ssh-keygen -F srv148 ; ssh-keygen -F srv218", 5)
    print(f"  {h}: known_hosts entries exist: {bool(o.strip())}")
    c.close()

# Run benchmarks
LAUNCH = conn("172.16.14.8")
OSU = "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt"

MPI_BASE = (
    "mpirun -np 2 --host srv148,srv218 "
    "--mca pml ob1 "
    "--mca btl openib,vader,self "
    "--mca btl_openib_allow_ib true "
    "--mca btl_openib_warn_default_gid_prefix 0 "
    "--mca btl_openib_warn_no_device_params_found 0 "
    "--mca mtl ^ofi "
    "--mca plm_rsh_args '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR' "
    "-x RDMAV_FORK_SAFE=1 "
)

BENCHMARKS = [
    ("osu_latency",   f"{OSU}/osu_latency"),
    ("osu_bw",        f"{OSU}/osu_bw"),
    ("osu_bibw",      f"{OSU}/osu_bibw"),
    ("osu_multi_lat", f"{OSU}/osu_multi_lat"),
    ("osu_mbw_mr",    f"{OSU}/osu_mbw_mr"),
]

# Save outputs
all_out = {}
for name, binpath in BENCHMARKS:
    cmd = MPI_BASE + binpath
    print(f"\n{'='*70}\n### {name}\n{'='*70}")
    t0 = time.time()
    o, e = run(LAUNCH, cmd, 300)
    print(f"elapsed {time.time()-t0:.0f}s")
    print(o[:4500])
    all_out[name] = o
    if e.strip():
        nonwarn = [l for l in e.splitlines() if l.strip() and
                   "warning" not in l.lower() and
                   "deprecat" not in l.lower()]
        if nonwarn:
            print("STDERR:", "\n".join(nonwarn)[:1200])

# Save all outputs to local file
with open("osu_results.txt", "w") as f:
    for name, content in all_out.items():
        f.write(f"\n\n======= {name} =======\n{content}\n")
print("\n[saved -> osu_results.txt]")

LAUNCH.close()
