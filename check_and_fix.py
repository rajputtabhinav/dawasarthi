import paramiko

PASS = "netweb"
USER = "user"

PLAN = [
    ("172.16.11.218", "ens8f1np1", "10.10.10.1/24", "10.10.10.2"),
    ("172.16.14.8",   "enp1s0np0", "10.10.10.2/24", "10.10.10.1"),
]

CMD_TMPL = r"""
S() {{ echo {pw} | sudo -S -p '' "$@"; }}
IF={iface}; WANT={ip}; PEER={peer}

echo "=== state of $IF ==="
ip -4 addr show "$IF" | sed -n 's/^/  /p'

# If WANT not present, add it
if ! ip -4 addr show "$IF" | grep -q "${{WANT%/*}}/"; then
  echo "=== $WANT missing — adding ==="
  S ip link set "$IF" up
  S ip addr add "$WANT" dev "$IF"
  echo "  result:"
  ip -4 addr show "$IF" | sed -n 's/^/  /p'
else
  echo "=== $WANT already present ==="
fi

# Optional: tell NetworkManager not to manage this iface for this session
if command -v nmcli >/dev/null 2>&1; then
  echo "=== NetworkManager view ==="
  nmcli -t -f DEVICE,STATE,CONNECTION dev | grep "$IF" || echo "  (not in nmcli)"
fi

echo "=== ping $PEER (3 pkts) ==="
ping -c 3 -W 2 -I "$IF" "$PEER" | tail -5
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface, ip, peer in PLAN:
    print(f"\n{'='*70}\n# {host} ({iface})\n{'='*70}")
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(
        CMD_TMPL.format(pw=PASS, iface=iface, ip=ip, peer=peer), timeout=30)
    print(stdout.read().decode(errors="replace"), end="")
    err = stderr.read().decode(errors="replace")
    e = "\n".join(l for l in err.splitlines() if l.strip())
    if e:
        print("STDERR:", e)
    c.close()
