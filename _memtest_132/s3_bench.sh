#!/bin/bash
# Phase 3: bandwidth benchmarks + post-test health (run after the 5-min load completes)
cd /tmp/memval132
echo "=== WAIT FOR STRESS END ==="
while pgrep -f 'stress-ng --vm' >/dev/null; do sleep 5; done
date -u +"LOAD_END %Y-%m-%d %H:%M:%S" | tee -a load_window.txt
echo "=== STRESS LOG ==="
cat stress_vm.log
echo "=== SAMPLER LOG ==="
cat sampler.log
echo "=== STREAM (stress-ng --stream 64, 40s) ==="
stress-ng --stream $(nproc) --metrics-brief --timeout 40s 2>&1 | grep -E 'memory rate|bogo|stream'
echo "=== SYSBENCH WRITE 64T ==="
sysbench memory --memory-block-size=1M --memory-total-size=2000G --memory-oper=write --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== SYSBENCH READ 64T ==="
sysbench memory --memory-block-size=1M --memory-total-size=2000G --memory-oper=read --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== SYSBENCH WRITE 1T ==="
sysbench memory --memory-block-size=1M --memory-total-size=100G --memory-oper=write --threads=1 --time=15 run | grep -E 'transferred|total time:'
echo "=== MBW 1T (1 GiB memcpy x3) ==="
mbw -n 3 1024 2>/dev/null | grep -E 'AVG'
echo "=== NUMA LOCAL (cpu0->mem0) ==="
numactl --cpunodebind=0 --membind=0 sysbench memory --memory-block-size=1M --memory-total-size=300G --memory-oper=write --threads=8 --time=10 run | grep -E 'transferred'
echo "=== NUMA REMOTE (cpu0->mem1) ==="
numactl --cpunodebind=0 --membind=1 sysbench memory --memory-block-size=1M --memory-total-size=300G --memory-oper=write --threads=8 --time=10 run | grep -E 'transferred'
echo "=== EDAC POST ==="
grep . /sys/devices/system/edac/mc/mc*/ce_count /sys/devices/system/edac/mc/mc*/ue_count 2>/dev/null
echo "=== MCE POST (count) ==="
echo netweb | sudo -S -p '' dmesg 2>/dev/null | grep -ciE 'mce|machine check'
echo "=== DMESG WINDOW (errors since load start) ==="
echo netweb | sudo -S -p '' dmesg -T 2>/dev/null | grep -iE 'error|mce|machine check|oom|out of memory|corrected' | tail -15
echo "=== SEL POST ==="
echo netweb | sudo -S -p '' ipmitool sel info 2>/dev/null | grep -E 'Entries|Last Add'
echo "=== TEMP/FREQ NOW ==="
echo netweb | sudo -S -p '' turbostat --quiet --Summary --show Bzy_MHz,PkgTmp,PkgWatt -i 3 -n 1 2>/dev/null | tail -3
echo "=== DONE ==="
date -u
