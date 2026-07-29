import paramiko
USER, PASS = "user", "netweb"
TARGETS = [("172.16.14.8", "enp1s0np0", 32),
           ("172.16.11.218", "ens8f1np1", 32)]  # both to 32 combined
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface, q in TARGETS:
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    cmd = (f"echo netweb | sudo -S -p '' ethtool -L {iface} combined {q} 2>&1; "
           f"echo ---; ethtool -l {iface} | tail -8")
    _, o, e = c.exec_command(cmd, timeout=30)
    print(f"=== {host} {iface} -> combined {q} ===")
    print(o.read().decode(errors='replace'))
    err = e.read().decode(errors='replace')
    e2 = "\n".join(l for l in err.splitlines() if l.strip() and "password" not in l.lower())
    if e2: print("STDERR:", e2)
    c.close()
