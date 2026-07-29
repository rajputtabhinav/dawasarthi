import paramiko
USER, PASS = "user", "netweb"
TARGETS = [("172.16.11.218", "ens8f1np1"),
           ("172.16.14.8",   "enp1s0np0")]

PROBE = r"""
S() { echo netweb | sudo -S -p '' "$@"; }
IF=__IF__
echo "## hostname: $(hostname)   iface=$IF"

echo "## kernel modules (bnxt_en, bnxt_re):"
lsmod | grep -E '^bnxt' | sed 's/^/   /' || echo "   (none loaded)"

echo "## /sys/class/infiniband devices:"
ls /sys/class/infiniband/ 2>/dev/null | sed 's/^/   /' || echo "   (none — no RDMA devices)"

echo "## rdma link:"
S rdma link 2>&1 | sed 's/^/   /' || echo "   rdma cmd missing"

echo "## ibv_devices:"
command -v ibv_devices >/dev/null && ibv_devices | sed 's/^/   /' || echo "   ibv_devices not installed"

echo "## ibv_devinfo (brief):"
command -v ibv_devinfo >/dev/null && ibv_devinfo 2>&1 | grep -E 'hca_id|state|link_layer|active_speed|active_mtu|active_width|node_type|phys_state' | sed 's/^/   /' || echo "   ibv_devinfo not installed"

echo "## perftest binaries present?"
for b in ib_send_bw ib_send_lat ib_write_bw ib_write_lat ib_read_bw ib_read_lat; do
  command -v $b >/dev/null && echo "   $b OK ($(which $b))" || echo "   $b MISSING"
done

echo "## OpenMPI present?"
command -v mpirun >/dev/null && mpirun --version 2>&1 | head -2 | sed 's/^/   /' || echo "   mpirun MISSING"

echo "## NIC firmware/driver:"
ethtool -i "$IF" 2>/dev/null | grep -E 'driver|version|firmware' | sed 's/^/   /'
"""

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface in TARGETS:
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    print(f"\n{'='*70}\n# {host}\n{'='*70}")
    _, o, e = c.exec_command(PROBE.replace("__IF__", iface), timeout=30)
    print(o.read().decode(errors="replace"))
    err = e.read().decode(errors="replace")
    e2 = "\n".join(l for l in err.splitlines() if l.strip() and "password" not in l.lower())
    if e2: print("STDERR:", e2)
    c.close()
