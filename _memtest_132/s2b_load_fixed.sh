#!/bin/bash
# Phase 2 (corrected): 5-min ~100% memory load; --vm-bytes is TOTAL split across workers on this stress-ng
cd /tmp/memval132
pkill -f 'stress-ng --vm' 2>/dev/null
sleep 2
pkill -9 -f 'stress-ng --vm' 2>/dev/null
pkill -f 'seq 1 16' 2>/dev/null
sleep 1
W=$(nproc)
AVAIL_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
TOTB=$(( AVAIL_KB * 1024 * 92 / 100 ))
echo "workers=$W total_bytes=$TOTB total_GB=$(( TOTB/1024/1024/1024 ))"
date -u +"LOAD_START %Y-%m-%d %H:%M:%S" | tee load_window.txt
nohup stress-ng --vm $W --vm-bytes $TOTB --vm-keep --vm-method all --verify --metrics-brief --timeout 300s > stress_vm.log 2>&1 &
echo $! > stress.pid
rm -f sampler.log
nohup bash -c 'for i in $(seq 1 17); do
  echo "--- $(date -u +%T)" >> sampler.log
  free -g | grep -E "Mem|Swap" >> sampler.log
  awk "/cpu MHz/{print \$4}" /proc/cpuinfo | sort -rn | head -1 | sed "s/^/maxMHz /" >> sampler.log
  uptime | sed "s/.*load/load/" >> sampler.log
  sleep 20
done' > /dev/null 2>&1 &
echo RELAUNCHED
