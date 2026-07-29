import paramiko

USER, PASS = "user", "netweb"
TESTS = [
    ("172.16.11.218", "ens8f1np1", "10.10.10.2"),
    ("172.16.14.8",   "enp1s0np0", "10.10.10.1"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface, peer in TESTS:
    print(f"\n=== {host}: ping {peer} via {iface} ===")
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    _, out, _ = c.exec_command(
        f"ip -4 -o addr show {iface} | awk '{{print $2,$4}}'; "
        f"ping -c 4 -W 2 -I {iface} {peer}", timeout=20)
    print(out.read().decode(errors="replace"), end="")
    c.close()
