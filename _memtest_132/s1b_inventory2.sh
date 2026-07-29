#!/bin/bash
# Re-inventory after memory install + fresh pre-test baseline
echo "=== DATE ==="; date -u
echo "=== UPTIME ==="; uptime -s; uptime
echo "=== MEM ==="; free -b | head -2; grep -E 'MemTotal|MemAvailable' /proc/meminfo
echo "=== SLOTS TOTAL vs POPULATED ==="
echo netweb | sudo -S -p '' dmidecode -t 17 2>/dev/null > /tmp/dmi17.txt
grep -c '^Memory Device' /tmp/dmi17.txt
grep -c '^\s*Size: [0-9]' /tmp/dmi17.txt
echo "=== SPEED SUMMARY (uniq) ==="
grep -E '^\s*(Size|Speed|Configured Memory Speed):' /tmp/dmi17.txt | grep -v 'No Module' | sort | uniq -c
echo "=== PER-DIMM FULL ==="
grep -E '^\s+(Size|Locator|Bank Locator|Manufacturer|Serial Number|Part Number|Speed|Configured Memory Speed|Rank|Total Width|Type:|Type Detail)' /tmp/dmi17.txt | grep -v 'No Module Installed' | sed 's/^\s*//'
echo "=== NUMA ==="; numactl --hardware 2>/dev/null | head -8
echo "=== EDAC PRE ==="; grep . /sys/devices/system/edac/mc/mc*/ce_count /sys/devices/system/edac/mc/mc*/ue_count 2>/dev/null
echo "=== MCE PRE ==="; echo netweb | sudo -S -p '' dmesg 2>/dev/null | grep -ciE 'mce|machine check'
echo "=== SEL PRE ==="; echo netweb | sudo -S -p '' ipmitool sel info 2>/dev/null | grep -E 'Entries|Last Add'
echo "=== DMESG MEM TRAINING/ERRORS (last boot) ==="; echo netweb | sudo -S -p '' dmesg 2>/dev/null | grep -iE 'EDAC|ECC|memory.*error|dimm' | tail -10
echo "=== SWAP ==="; swapon --show 2>/dev/null
echo "=== STALE STRESS? ==="; pgrep -af 'stress-ng|memtester' || echo none
