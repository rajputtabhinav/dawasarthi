import paramiko
USER, PASS = "user", "netweb"
for h in ["172.16.11.218", "172.16.14.8"]:
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    _, o, _ = c.exec_command(
        "echo netweb | sudo -S -p '' pkill -9 -f 'ib_|iperf3|sockperf|netperf' 2>/dev/null; "
        "sleep 1; pgrep -af 'ib_|iperf3|sockperf|netperf' || echo NONE_RUNNING", timeout=15)
    print(f"[{h}] {o.read().decode().strip()}")
    c.close()
