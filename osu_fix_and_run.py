"""
Set distinct hostnames (transient, runtime only — restored to 'user' on reboot),
then run the OSU MPI benchmark suite.
"""
import paramiko, time, re

USER, PASS = "user", "netweb"
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

HOST_NAMES = {"172.16.11.218": "srv218", "172.16.14.8": "srv148"}

# Kill any stale OMPI/OSU procs
for h in HOST_NAMES:
    c = conn(h); run(c, "pkill -9 -f 'osu_|mpirun|orted' ; true", 10); c.close()
time.sleep(1)

# Set distinct hostnames (transient — `hostname X`; persists across session only)
print("=== setting distinct hostnames ===")
for h, name in HOST_NAMES.items():
    c = conn(h)
    o, _ = run(c, f"echo netweb | sudo -S -p '' hostname {name} ; hostname", 10)
    print(f"  {h} -> {o.strip().splitlines()[-1]}")
    # add to /etc/hosts so the new name resolves to RoCE IP
    roce_ip = "10.10.10.1" if h == "172.16.11.218" else "10.10.10.2"
    # Both nodes need entries for both
    other_name = "srv148" if h == "172.16.11.218" else "srv218"
    other_ip   = "10.10.10.2" if h == "172.16.11.218" else "10.10.10.1"
    setup_hosts = (
      f"echo netweb | sudo -S -p '' bash -c \""
      f"grep -q ' {name}\\$' /etc/hosts || echo '{roce_ip} {name}' >> /etc/hosts; "
      f"grep -q ' {other_name}\\$' /etc/hosts || echo '{other_ip} {other_name}' >> /etc/hosts\""
    )
    run(c, setup_hosts, 10)
    o, _ = run(c, f"grep -E 'srv148|srv218' /etc/hosts", 10)
    print(f"     /etc/hosts:\n{o}")
    c.close()

time.sleep(1)

# Now run OSU benchmarks via mpirun, using openib BTL over RoCE
LAUNCH = conn("172.16.14.8")
OSU = "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt"

# Base mpirun: pml ob1 + openib BTL (UCX caused fork/EFA crash; openib is the direct verbs path)
MPI_BASE = (
    "mpirun -np 2 --host srv148,srv218 "
    "--mca pml ob1 "
    "--mca btl openib,vader,self "
    "--mca btl_openib_allow_ib true "
    "--mca btl_openib_warn_default_gid_prefix 0 "
    "--mca btl_openib_warn_no_device_params_found 0 "
    "--mca mtl ^ofi "
    "-x RDMAV_FORK_SAFE=1 "
)

BENCHMARKS = [
    ("osu_latency",   f"{OSU}/osu_latency"),
    ("osu_bw",        f"{OSU}/osu_bw"),
    ("osu_bibw",      f"{OSU}/osu_bibw"),
    ("osu_multi_lat", f"{OSU}/osu_multi_lat"),
    ("osu_mbw_mr",    f"{OSU}/osu_mbw_mr"),
]

summary = {}
for name, binpath in BENCHMARKS:
    cmd = MPI_BASE + binpath
    print(f"\n{'='*70}\n### {name}\n{'='*70}\n$ {cmd}\n")
    t0 = time.time()
    o, e = run(LAUNCH, cmd, 300)
    print(f"elapsed {time.time()-t0:.0f}s")
    print(o[:3500])
    if e.strip():
        err = "\n".join(l for l in e.splitlines() if l.strip() and "warning" not in l.lower())
        if err: print("STDERR:", err[:1500])
    summary[name] = o

LAUNCH.close()
print("\n=== finished ===")
