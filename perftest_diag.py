import paramiko
USER, PASS = "user", "netweb"
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.16.14.8", username=USER, password=PASS, timeout=10,
          allow_agent=False, look_for_keys=False)
for tool in ["ib_send_bw", "ib_write_bw", "ib_read_bw"]:
    print(f"\n=== /tmp/{tool}.cli.log ===")
    _, o, _ = c.exec_command(f"cat /tmp/{tool}.cli.log", timeout=10)
    print(o.read().decode(errors='replace')[:1200])
c.close()
