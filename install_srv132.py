import paramiko
USER, PASS = "user", "netweb"
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.16.11.132", username=USER, password=PASS, timeout=30,
          banner_timeout=45, auth_timeout=45,
          allow_agent=False, look_for_keys=False)

# update package list, then install without linux-tools (already broken pkg version)
PKGS = ("perftest libibverbs1 ibverbs-utils rdma-core libibumad3 librdmacm1 "
        "iperf3 sockperf netperf sysstat lldpd ethtool")
_, o, _ = c.exec_command(
    f"echo netweb | sudo -S -p '' apt-get update -qq 2>&1 | tail -3; "
    f"echo netweb | sudo -S -p '' DEBIAN_FRONTEND=noninteractive "
    f"apt-get install -y -qq --fix-missing {PKGS} 2>&1 | tail -5; "
    f"echo '--- verify ---'; "
    f"for x in ib_send_bw ib_write_bw ib_read_bw ib_send_lat ib_write_lat "
    f"ib_read_lat iperf3 sockperf mpstat ibv_devinfo; do "
    f"  command -v $x | sed 's|^|  |' || echo \"  $x MISSING\"; done; "
    f"echo ''; ibv_devinfo 2>&1 | grep -E 'hca_id|state|link_layer|active_mtu' | head -5",
    timeout=300)
print(o.read().decode(errors='replace'))
c.close()
