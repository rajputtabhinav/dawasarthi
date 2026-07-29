#!/bin/bash
# Phase 2: 5-min 100% memory load (90% of MemAvailable, write+verify, all patterns)
mkdir -p /tmp/memval132
cd /tmp/memval132
W=$(nproc)
AVAIL_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
PER=$(( AVAIL_KB * 1024 * 90 / 100 / W ))
TOT_GB=$(( PER * W / 1024 / 1024 / 1024 ))
echo "workers=$W per_worker_bytes=$PER total_GB=$TOT_GB"
date -u +"LOAD_START %Y-%m-%d %H:%M:%S" | tee load_window.txt
nohup stress-ng --vm $W --vm-bytes $PER --vm-method all --verify --metrics-brief --timeout 300s > stress_vm.log 2>&1 &
echo $! > stress.pid
nohup bash -c 'for i in $(seq 1 16); do
  echo "--- $(date -u +%T)" >> sampler.log
  free -g | grep -E "Mem|Swap" >> sampler.log
  awk "/cpu MHz/{print \$4}" /proc/cpuinfo | sort -rn | head -1 | sed "s/^/maxMHz /" >> sampler.log
  uptime | sed "s/.*load/load/" >> sampler.log
  sleep 20
done' > /dev/null 2>&1 &
echo LAUNCHED
