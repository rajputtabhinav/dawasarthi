import paramiko

HOSTS = ["172.16.14.8"]
USER = "user"
PASS = "netweb"

CMD = r"""
echo "### hostname: $(hostname)"
echo
echo "### /sys speeds + state"
for d in /sys/class/net/*; do
  i=$(basename "$d")
  [ "$i" = "lo" ] && continue
  spd=$(cat "$d/speed" 2>/dev/null || echo "?")
  st=$(cat "$d/operstate" 2>/dev/null || echo "?")
  car=$(cat "$d/carrier" 2>/dev/null || echo "?")
  printf "  %-18s speed=%sMb/s state=%s carrier=%s\n" "$i" "$spd" "$st" "$car"
done
echo
echo "### ethtool (Speed / Link detected)"
for i in $(ls /sys/class/net | grep -v '^lo$'); do
  out=$(ethtool "$i" 2>/dev/null | grep -E 'Speed:|Link detected:')
  [ -n "$out" ] && echo "  == $i ==" && echo "$out" | sed 's/^/    /'
done
echo
echo "### Full lspci Ethernet/network"
lspci 2>/dev/null | grep -iE 'ethernet|network|infiniband'
echo
echo "### lshw -class network (brief)"
sudo -n lshw -class network -short 2>/dev/null || lshw -class network -short 2>/dev/null || echo "  (lshw needs sudo / not installed)"
echo
echo "### dmesg recent NIC bring-up"
sudo -n dmesg 2>/dev/null | grep -iE 'bnxt|mlx|mellanox|broadcom|connectx|i40e|ice|ixgbe' | tail -20 || \
  dmesg 2>/dev/null | grep -iE 'bnxt|mlx|mellanox|broadcom|connectx|i40e|ice|ixgbe' | tail -20 || \
  echo "  (dmesg needs sudo)"
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for h in HOSTS:
    print(f"\n{'='*70}\n# {h}\n{'='*70}")
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(CMD, timeout=30)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("STDERR:\n" + err)
    c.close()
