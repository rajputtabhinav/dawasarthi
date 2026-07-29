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
    run(c, "pkill -9 -f 'osu_|mpirun|orted' ; true", 10)
    c.close()
time.sleep(2)

cc = conn("172.16.14.8")

# Test 1: can mpirun even launch hostname remotely?
print("=== TEST 1: mpirun hostname (no RDMA needed) ===")
c1 = ("mpirun -np 2 --host 10.10.10.2,10.10.10.1 "
      "--mca pml ob1 --mca btl ^openib,ofi,tcp "
      "--mca mtl ^ofi -x PATH "
      "hostname")
print(f"$ {c1}")
t0=time.time(); o,e = run(cc, c1, 30); print(f"elapsed {time.time()-t0:.0f}s")
print("OUT:", o); print("ERR:", e[:800])

# Test 2: with openib BTL (skip UCX entirely)
print("\n=== TEST 2: openib BTL osu_latency (no UCX) ===")
c2 = ("mpirun -np 2 --host 10.10.10.2,10.10.10.1 "
      "--mca pml ob1 --mca btl openib,vader,self "
      "--mca mtl ^ofi "
      "--mca btl_openib_allow_ib true "
      "--mca btl_openib_warn_default_gid_prefix 0 "
      "--mca btl_openib_warn_no_device_params_found 0 "
      "-x RDMAV_FORK_SAFE=1 "
      "/home/user/osu/libexec/osu-micro-benchmarks/mpi/pt2pt/osu_latency")
print(f"$ {c2}")
t0=time.time(); o,e = run(cc, c2, 60); print(f"elapsed {time.time()-t0:.0f}s")
print("OUT:", o[:3000]); print("ERR:", e[:2500])

cc.close()
