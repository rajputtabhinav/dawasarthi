#!/bin/bash
# Wait for burn end, corrected DRAM benches, post-test health + DIMM temps (post-removal retest)
cd ~
echo "=== WAIT FOR STRESS END ==="
while pgrep -f 'stress-ng --vm' >/dev/null; do sleep 5; done
date -u +"LOAD_END %Y-%m-%d %H:%M:%S" | tee -a load_window.txt
echo "=== STRESS LOG ==="
cat stress_vm.log
echo "=== SAMPLER LOG (key samples) ==="
grep -A3 '^---' sampler.log | tail -40
echo "=== STREAM corrected (stress-ng --stream 64 --stream-l3-size 256M, 30s) ==="
stress-ng --stream $(nproc) --stream-l3-size 256M --metrics-brief --timeout 30s 2>&1 | grep -E 'memory rate \(MB per sec\)'
echo "=== SYSBENCH READ 64T 1G-blocks ==="
sysbench memory --memory-block-size=1G --memory-total-size=4000G --memory-oper=read --memory-scope=local --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== SYSBENCH WRITE 64T 1G-blocks ==="
sysbench memory --memory-block-size=1G --memory-total-size=4000G --memory-oper=write --memory-scope=local --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== MBW 1T (1 GiB memcpy x3) ==="
mbw -n 3 1024 2>/dev/null | grep AVG
echo "=== MBW NUMA LOCAL (cpu0->mem0, 2 GiB) ==="
numactl --cpunodebind=0 --membind=0 mbw -n 2 2048 2>/dev/null | grep AVG
echo "=== MBW NUMA REMOTE (cpu0->mem1, 2 GiB) ==="
numactl --cpunodebind=0 --membind=1 mbw -n 2 2048 2>/dev/null | grep AVG
echo "=== EDAC POST ==="
grep . /sys/devices/system/edac/mc/mc*/ce_count /sys/devices/system/edac/mc/mc*/ue_count 2>/dev/null
echo "=== MCE POST (count) ==="
echo netweb | sudo -S -p '' dmesg 2>/dev/null | grep -ciE 'mce|machine check'
echo "=== SEL POST ==="
echo netweb | sudo -S -p '' ipmitool sel info 2>/dev/null | grep -E 'Entries|Last Add'
echo "=== DIMM TEMPS (P0 bank, post-bench) ==="
echo netweb | sudo -S -p '' ipmitool sdr type Temperature 2>/dev/null | grep -E 'DIMM'
echo "=== TEMP/FREQ NOW ==="
echo netweb | sudo -S -p '' turbostat --quiet --Summary --show Bzy_MHz,PkgTmp,PkgWatt -i 3 -n 1 2>/dev/null | tail -3
echo "=== DONE ==="
date -u
