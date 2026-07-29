import paramiko
USER, PASS = "user", "netweb"
TARGETS = [("172.16.11.218", "ens8f1np1"),
           ("172.16.14.8", "enp1s0np0")]

PROBE = r"""
IF=__IF__
echo "## hostname: $(hostname)"
echo "## NIC numa_node:  $(cat /sys/class/net/$IF/device/numa_node)"
echo "## NUMA topology (lscpu):"
lscpu | grep -E 'NUMA node|Socket|Core|CPU\(s\)' | sed 's/^/   /'
echo "## numactl --hardware (cpus per node):"
command -v numactl >/dev/null && numactl --hardware | grep -E 'available|node [0-9]+ (cpus|size)' | sed 's/^/   /' || echo "   numactl not installed"
echo "## NIC IRQ distribution (top 8):"
awk -v ifn="$IF" '$NF ~ ifn {print $1, $NF}' /proc/interrupts | head -16 | sed 's/^/   /'
echo "## first 4 NIC IRQ smp_affinity_list:"
for irq in $(awk -v ifn="$IF" '$NF ~ ifn {gsub(":","",$1); print $1}' /proc/interrupts | head -4); do
  aff=$(cat /proc/irq/$irq/smp_affinity_list 2>/dev/null)
  echo "   IRQ $irq -> CPUs $aff"
done
echo "## irqbalance status:"
systemctl is-active irqbalance 2>/dev/null | sed 's/^/   /'
"""

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for host, iface in TARGETS:
    c.connect(host, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    print(f"\n{'='*70}\n# {host}  ({iface})\n{'='*70}")
    _, o, _ = c.exec_command(PROBE.replace("__IF__", iface), timeout=20)
    print(o.read().decode(errors='replace'))
    c.close()
