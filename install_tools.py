import paramiko, threading
USER, PASS = "user", "netweb"
HOSTS = ["172.16.15.21", "172.16.11.132"]

PKGS = ("perftest libibverbs1 ibverbs-utils rdma-core libibumad3 librdmacm1 "
        "iperf3 sockperf netperf sysstat lldpd ethtool linux-tools-common "
        "linux-tools-generic")
def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=30, banner_timeout=45,
              auth_timeout=45, allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=300):
    _, o, _ = c.exec_command(cmd, timeout=t); return o.read().decode(errors='replace')

def install(h):
    c = conn(h)
    o = run(c, f"echo netweb | sudo -S -p '' DEBIAN_FRONTEND=noninteractive "
                f"apt-get install -y -qq {PKGS} 2>&1 | tail -3", 300)
    o2 = run(c, "for x in ib_send_bw ib_write_bw ib_read_bw ib_send_lat "
                "ib_write_lat ib_read_lat iperf3 sockperf mpstat ibv_devinfo; do "
                "  command -v $x | sed 's|^|  |' || echo \"  $x MISSING\"; "
                "done; echo ''; ibv_devinfo 2>&1 | grep -E 'hca_id|state|link_layer|active_mtu' | head -5", 30)
    print(f"=== {h} ===\n{o.strip()}\n{o2.strip()}\n")
    c.close()

ts = [threading.Thread(target=install, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()
