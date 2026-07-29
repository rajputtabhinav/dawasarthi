"""
Run OSU 2-process benchmarks over RoCE between 10.10.10.2 (rank 0) and 10.10.10.1 (rank 1).
We force UCX to use RDMA (rc transport over verbs) and pin each rank to NUMA-local cores.
"""
import paramiko, time

USER, PASS = "user", "netweb"
LAUNCHER_HOST = "172.16.14.8"  # client side; mpirun launched here

# Build a per-host wrapper that does:
#   - sets UCX_NET_DEVICES to the local RoCE device
#   - pins to local NUMA node + a free core
WRAPPER = r"""#!/bin/bash
# Pick local RoCE device and NUMA node based on hostname/IP
IP=$(hostname -I | tr ' ' '\n' | grep '^10\.10\.10\.')
case "$IP" in
  10.10.10.1) DEV=rocep202s0f1; NN=1; CORE=40 ;;
  10.10.10.2) DEV=rocep1s0;     NN=0; CORE=4  ;;
  *)          DEV=;             NN=0; CORE=0  ;;
esac
export UCX_NET_DEVICES=${DEV}:1
export UCX_TLS=rc,sm,self
export UCX_LOG_LEVEL=warn
exec numactl --cpunodebind=$NN --membind=$NN --physcpubind=$CORE -- "$@"
"""

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=120):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

# Distribute wrapper to both hosts
import io
for h in ["172.16.11.218", "172.16.14.8"]:
    c = conn(h)
    sftp = c.open_sftp()
    with sftp.open("/home/user/osu_wrap.sh", "w") as f:
        f.write(WRAPPER)
    sftp.chmod("/home/user/osu_wrap.sh", 0o755)
    sftp.close()
    o, _ = run(c, "head -3 /home/user/osu_wrap.sh && ls -l /home/user/osu_wrap.sh", 10)
    print(f"[{h}] wrapper: {o.strip().splitlines()[-1]}")
    c.close()

OSU = "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt"
COLLECT = "/home/user/osu/libexec/osu-micro-benchmarks/mpi/collective"

BENCHMARKS = [
    ("osu_latency",   f"{OSU}/osu_latency",       []),
    ("osu_bw",        f"{OSU}/osu_bw",            []),
    ("osu_bibw",      f"{OSU}/osu_bibw",          []),
    ("osu_mbw_mr",    f"{OSU}/osu_mbw_mr",        []),
    ("osu_multi_lat", f"{OSU}/osu_multi_lat",     []),
]

# Hostfile content
HOSTFILE = "/tmp/osu_hosts.txt"
HOSTFILE_CONTENT = "10.10.10.2 slots=1\n10.10.10.1 slots=1\n"

cc = conn(LAUNCHER_HOST)
sftp = cc.open_sftp()
with sftp.open(HOSTFILE, "w") as f:
    f.write(HOSTFILE_CONTENT)
sftp.close()
print(f"\nhostfile written: {HOSTFILE_CONTENT.strip()}")

# Build mpirun base command
MPIRUN_BASE = (
    f"mpirun -np 2 --hostfile {HOSTFILE} "
    f"--mca pml ucx --mca btl ^openib,tcp "
    f"--bind-to none --map-by node "
    f"-x UCX_TLS -x UCX_NET_DEVICES -x UCX_LOG_LEVEL "
    f"-x LD_LIBRARY_PATH "
    f"/home/user/osu_wrap.sh "
)

results = {}
for name, binpath, extra in BENCHMARKS:
    cmd = MPIRUN_BASE + binpath + " " + " ".join(extra)
    print(f"\n{'='*70}\n### {name}\n{'='*70}\n$ {cmd}")
    t0 = time.time()
    o, e = run(cc, cmd, 300)
    print(f"elapsed {time.time()-t0:.0f}s")
    print(o[:4000])
    if e.strip():
        e2 = "\n".join(l for l in e.splitlines() if l.strip())
        print("STDERR:", e2[:1500])
    results[name] = o

cc.close()
print("\n=== all done ===")
