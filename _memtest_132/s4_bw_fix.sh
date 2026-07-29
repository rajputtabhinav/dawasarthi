#!/bin/bash
# Phase 4: corrected DRAM bandwidth (buffers sized beyond L3 cache)
cd /tmp/memval132
echo "=== STREAM corrected (stress-ng --stream 64 --stream-l3-size 256M, 30s) ==="
stress-ng --stream $(nproc) --stream-l3-size 256M --metrics-brief --timeout 30s 2>&1 | grep -E 'memory rate \(MB per sec\)|bogo'
echo "=== SYSBENCH READ 64T 1G-blocks (DRAM-bound) ==="
sysbench memory --memory-block-size=1G --memory-total-size=4000G --memory-oper=read --memory-scope=local --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== SYSBENCH WRITE 64T 1G-blocks (DRAM-bound) ==="
sysbench memory --memory-block-size=1G --memory-total-size=4000G --memory-oper=write --memory-scope=local --threads=$(nproc) --time=20 run | grep -E 'transferred|total time:'
echo "=== MBW NUMA LOCAL (cpu node0 -> mem node0, 2 GiB) ==="
numactl --cpunodebind=0 --membind=0 mbw -n 2 2048 2>/dev/null | grep AVG
echo "=== MBW NUMA REMOTE (cpu node0 -> mem node1, 2 GiB) ==="
numactl --cpunodebind=0 --membind=1 mbw -n 2 2048 2>/dev/null | grep AVG
echo "=== DONE ==="
date -u
