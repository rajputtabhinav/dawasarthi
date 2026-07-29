#!/bin/bash
# Phase 1: inventory + pre-test counters
echo "=== DATE ==="; date -u
echo "=== HOSTNAME ==="; hostname; hostname -I 2>/dev/null
echo "=== OS ==="; . /etc/os-release && echo "$PRETTY_NAME"; uname -r
echo "=== LSCPU ==="; lscpu | grep -E 'Model name|Socket\(s\)|Core\(s\) per socket|Thread|^CPU\(s\)|NUMA node|max MHz|min MHz|L3'
echo "=== MEM ==="; free -b | head -2; grep -E 'MemTotal|MemAvailable' /proc/meminfo
echo "=== TOOLS ==="; for t in stress-ng sysbench mbw memtester numactl turbostat ipmitool dmidecode; do printf '%-10s: %s\n' "$t" "$(command -v $t || echo MISSING)"; done
echo "=== DMI SYSTEM ==="; echo netweb | sudo -S -p '' dmidecode -t 1 2>/dev/null | grep -E 'Manufacturer|Product Name'
echo "=== DMI MEM (populated) ==="; echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null | grep -E '^\s+(Size|Locator|Bank Locator|Type:|Speed|Configured Memory Speed|Manufacturer|Part Number)' | grep -v 'No Module Installed' | sed 's/^\s*//'
echo "=== DIMM COUNT ==="; echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null | grep -c '^\s*Size: [0-9]'
echo "=== NUMA ==="; numactl --hardware 2>/dev/null | head -6
echo "=== GOVERNOR ==="; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null
echo "=== EDAC PRE ==="; grep . /sys/devices/system/edac/mc/mc*/ce_count /sys/devices/system/edac/mc/mc*/ue_count 2>/dev/null | head -40 || echo "no EDAC sysfs"
echo "=== MCE PRE ==="; echo netweb | sudo -S -p '' dmesg 2>/dev/null | grep -ciE 'mce|machine check'
echo "=== SEL PRE ==="; echo netweb | sudo -S -p '' ipmitool sel info 2>/dev/null | grep -E 'Entries|Last Add' || echo "no ipmitool/BMC"
echo "=== SWAP ==="; swapon --show 2>/dev/null; echo "---"
