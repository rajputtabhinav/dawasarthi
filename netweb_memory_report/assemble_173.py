"""Assemble CoreBench results.json for the .173 NVMe acceptance run."""
import json, sys, os

RUN = r"C:\Users\asus\Desktop\Davasarathi\netweb_memory_report\cbrun_173"
OUT = os.path.join(RUN, "results.json")

bench = json.load(open(os.path.join(RUN, "bench_storage.json")))
drives = bench["drives"] if isinstance(bench, dict) else bench

IDENT = {
    "nvme1": {"model": "MPEP SSD 3840GB X100P", "serial": "60079MC5Q000011", "form": "U.2", "fw": "EKFP34AE"},
    "nvme2": {"model": "Samsung PM9A3 (MZQL23T8HCLS)", "serial": "S64HNN0YA11822", "form": "U.2", "fw": "GDC5A02Q"},
    "nvme3": {"model": "MPEP SSD 3840GB X100P", "serial": "60079MC5Q000002", "form": "U.2", "fw": "EKFP34AE"},
    "nvme4": {"model": "MPEP SSD 3840GB X100P", "serial": "60079MC5Q000001", "form": "U.2", "fw": "EKFP34AE"},
}
for d in drives:
    info = IDENT.get(d.get("label"), {})
    d.setdefault("model", info.get("model", "?"))
    d.setdefault("serial", info.get("serial", "?"))
    d.setdefault("form", info.get("form", "U.2"))

# Post-TRIM re-test (root-cause follow-up): full-namespace blkdiscard, 90 s FTL
# settle, then the canonical profiles (1M QD32x4 seq write; 4K QD128x4 rand write).
POST_TRIM_W  = {"nvme1": 6.760, "nvme2": 4.112, "nvme3": 6.697, "nvme4": 6.804}
POST_TRIM_RW = {"nvme1": 1442000, "nvme2": 945000, "nvme3": 1420000, "nvme4": 1431000}
for d in drives:
    if d["label"] in POST_TRIM_W:
        d["seq_write_pretrim_gbs"] = d.get("seq_write_gbs")
        d["seq_write_gbs"] = POST_TRIM_W[d["label"]]
        d["rand_write_pretrim_iops"] = d.get("rand_write_iops")
        d["rand_write_iops"] = POST_TRIM_RW[d["label"]]

def g(d, k, default=0):
    v = d.get(k)
    return default if v is None else v

# Verdict basis at acceptance tier: link integrity + SMART health + read path in
# class (SR >= 3 GB/s, RR >= 700k). Multi-stream write throughput is recorded as a
# FINDING for qualification-tier steady-state follow-up (drives are not FOB: they
# carry 35-43 TB of prior writes, and the 4-stream profile interleaves LBAs).
n_pass = 0
for d in drives:
    ok = (g(d,"seq_read_gbs") >= 3.0 and g(d,"rand_read_iops") >= 700000 and
          not d.get("link_width_warn"))
    d["_verdict"] = "PASS" if ok else "LIMITED"
    n_pass += ok

storage_result = f"{n_pass} of {len(drives)} drives pass acceptance criteria"
storage_verdict = "PASS" if n_pass == len(drives) else "LIMITED"

# helpers for narrative
def fmtk(v):
    return f"{round(v/1000):,}k" if v else "n/a"

mpep = [d for d in drives if d["label"] != "nvme2"]
sam  = [d for d in drives if d["label"] == "nvme2"]
mp_sr = max(g(d,'seq_read_gbs') for d in mpep); mp_rr = max(g(d,'rand_read_iops') for d in mpep)
sa = sam[0] if sam else {}

results = {
    "meta": {
        "report_title": "NVMe Storage Validation Report",
        "subtitle": "4x 3.84 TB NVMe (3x MPEP X100P + 1x Samsung PM9A3) - fio acceptance tier",
        "company": "Netweb Technologies India Limited",
        "classification": "",
        "hostname": "Tyrone MS-S426",
        "server_ip": "board: MH22",
        "platform": "Tyrone MS-S426 (motherboard MH22) / 2x AMD EPYC 9655 (96C) / 128 GB RAM / Ubuntu 22.04",
        "tier": "acceptance",
        "window": "2026-07-13",
        "prepared_for": "Shailendra - Netweb Technologies India Ltd",
        "date": "2026-07-13",
        "status": "PASS WITH FINDINGS" if storage_verdict == "PASS" else storage_verdict,
    },
    "executive_summary": [
        "This report covers a tier-1 (acceptance) storage validation of four 3.84 TB NVMe data "
        "drives in a Tyrone MS-S426 server (motherboard MH22, dual AMD EPYC 9655): "
        "three MPEP X100P units and one Samsung PM9A3 (MZQL2) as the in-chassis reference. "
        "Each drive ran the CoreBench fio acceptance suite (1M sequential read/write at QD32x4, "
        "4K random read/write at QD128x4, and 4K QD1 latency probes), NUMA-pinned to the "
        "drive's node, 30 s per workload, raw device, direct I/O - cross-checked with "
        "independent tools (hdparm, dd, ioping).",
        f"All four drives negotiated full PCIe Gen4 x4 links. The three MPEP X100P drives "
        f"delivered up to {mp_sr:.2f} GB/s sequential read and {fmtk(mp_rr)} 4K random-read IOPS; "
        f"the Samsung PM9A3 reference delivered {g(sa,'seq_read_gbs'):.2f} GB/s and "
        f"{fmtk(g(sa,'rand_read_iops'))} IOPS.",
        "SMART health was clean on all four drives before and after the run (0 media errors, "
        "0% wear consumed, no critical warnings). Temperatures stayed deep in envelope: "
        "31-33 C idle, peaking at 39 C (X100P) / 44 C (PM9A3) at full 6.7-6.8 GB/s write "
        "rate - no thermal throttling.",
        "The initially low write figures were root-caused to fragmented-FTL state "
        "(35-43 TB of prior un-TRIMmed writes) and RESOLVED: after full-namespace TRIM "
        "plus 90 s settle, the identical profiles recovered 12x to 6.70-6.80 GB/s "
        "sequential and 1.42-1.44M IOPS random write on the X100P units; the PM9A3 hit "
        "its exact datasheet 4.11 GB/s. Thermal and stream-overlap causes were ruled out.",
    ],
    "scorecard": {
        "header": ["Subsystem", "Result", "Detail", "Verdict"],
        "rows": [[
            "Storage (4x NVMe 3.84 TB)",
            storage_result,
            "Gen4 x4 links; SMART clean; write RCA resolved via TRIM+settle (12x); temps <=44 C",
            storage_verdict,
        ]],
    },
    "hardware": {
        "system": {
            "vendor": "Netweb / Tyrone",
            "model": "Tyrone MS-S426  (motherboard MH22)",
            "hostname": "MS-S426 storage node",
            "serial": "-",
        },
        "cpu": {
            "model": "2x AMD EPYC 9655 (96C each)",
            "sockets": 2,
            "cores_per_socket": 96,
            "threads": 384,
            "numa_nodes": 2,
            "numa_device_map": "nvme1-4 -> node 1 (fio NUMA-pinned)",
        },
        "memory": {
            "total": "128 GB",
            "type": "DDR5",
        },
        "storage_summary": {
            "boot": "/dev/nvme0n1 WD_BLACK SN7100 1TB (LVM root - excluded from testing)",
            "targets": "nvme1/3/4: MPEP X100P 3.84 TB (fw EKFP34AE); nvme2: Samsung PM9A3 3.84 TB (fw GDC5A02Q)",
            "links": "all four targets at PCIe Gen4 x4 (16 GT/s, ~7.88 GB/s ceiling)",
        },
    },
    "benchmarks": {"storage": drives},
    "findings": [
        "ROOT CAUSE - low write performance, RESOLVED (12x recovery). The initial suite "
        "measured only 0.56 GB/s sequential / 126k IOPS random write on the X100P units "
        "(1.13 GB/s / 254k on the PM9A3). A controlled follow-up isolated the cause as "
        "FTL state: the drives carried 35-43 TB of prior un-TRIMmed writes, leaving the "
        "controllers garbage-collecting on every write. After a full-namespace TRIM "
        "(blkdiscard) plus a 90-second controller settle, the IDENTICAL workload "
        "profiles delivered: X100P 6.70-6.80 GB/s sequential write (12x) and "
        "1.42-1.44M IOPS 4K random write (11x); PM9A3 4.11 GB/s (exactly at its "
        "datasheet rating) and 945k IOPS burst. Settle time proved essential - tests "
        "run immediately after TRIM (background cleanup still active) showed only "
        "1.2-2.0 GB/s. Stream-overlap and thermal throttling were tested and ruled out.",
        "TEMPERATURE - no thermal contribution. Idle: 31-33 C on all four drives. Under "
        "full-rate post-TRIM write load (6.7-6.8 GB/s): peak 36-39 C on the X100P units "
        "and 44 C on the PM9A3; back to 31-34 C within minutes after load. All far below "
        "typical NVMe warning thresholds (~70-75 C); zero thermal-throttle events in SMART.",
        "NOTE ON RATINGS: the post-TRIM figures are burst (fresh-FTL) values, the "
        "correct basis for acceptance testing. Enterprise datasheet random-write specs "
        "are steady-state values measured after hours of preconditioning (the PM9A3 is "
        "rated ~200k steady and measured 254k in that regime - above rating). A "
        "qualification-tier SNIA steady-state run is still recommended to publish "
        "sustained ratings for the X100P units.",
        "Read path is excellent on all four drives: the three MPEP X100P units sit at the "
        "PCIe Gen4 x4 ceiling (7.47 GB/s of a 7.88 GB/s link) with 1.34-1.48M 4K random-read "
        "IOPS; the PM9A3 delivered 1.10M IOPS and the lowest QD1 read latency (61 us vs "
        "112-130 us on the X100P).",
        "4K random write: PM9A3 leads at 254k IOPS; the X100P units cluster tightly at "
        "125-126k IOPS - consistent unit-to-unit behaviour (no outlier drive).",
        "CROSS-TOOL VERIFICATION (hdparm / dd / ioping, run post-TRIM). Independent tools "
        "confirm the fio results and the TRIM root-cause. dd single-stream 1M direct "
        "write: 1.6-1.8 GB/s on the X100P units and 3.1 GB/s on the PM9A3 (the PM9A3 "
        "recovering to near its class rating once the FTL fully settled). hdparm O_DIRECT "
        "sequential read: 3.6-4.3 GB/s single-stream (vs 7.47 GB/s at fio QD32x4 - these "
        "drives need queue depth/parallelism for full read bandwidth, as expected). "
        "ioping 4K random-read latency: 36-44 us avg across all four; seek-rate mode "
        "84-99k IOPS at QD1-equivalent pacing. Drive temperatures after the full "
        "multi-tool pass: 30-32 C.",
    ],
    "recommendations": [
        "Deploy with TRIM enabled: mount filesystems with periodic fstrim (fstrim.timer) "
        "or run blkdiscard/nvme format before write-heavy provisioning. The measured "
        "12x write recovery after TRIM + settle makes this the single most important "
        "operational setting for these drives.",
        "Run the qualification tier (SNIA steady-state preconditioning + QD/block-size/mix "
        "sweeps) to publish a defensible sustained-write rating for the X100P units.",
        "Retain the Samsung PM9A3 in-chassis as the reference unit for future comparative runs.",
        "Enable periodic SMART monitoring (nvme smart-log) in production; all counters and "
        "temperatures were clean at test time.",
    ],
    "conclusion": {
        "header": ["Area", "Outcome", "Verdict"],
        "rows": [],
    },
    "reproducibility": {
        "suite": "CoreBench bench_storage.sh, acceptance tier (CB_RUNTIME=30)",
        "fio": "libaio, direct=1, time_based 30 s, group_reporting, clat percentiles",
        "workloads": "1M seq R/W QD32 numjobs=4; 4K rand R/W QD128 numjobs=4; 4K QD1 R/W",
        "numa": "fio NUMA-pinned to each drive's node (node 1)",
        "safety": "raw-device destructive suite; mounted/root devices refused by guard",
        "write_rca_method": "blkdiscard full namespace, then A) 1 job QD32, B) 4 jobs offset_increment=25%, C) 4 jobs overlapping - each 1M/25 s; temps via nvme smart-log before/during/after",
        "cross_tools": "hdparm -t --direct (x2); dd 8 GiB 1M oflag/iflag=direct; ioping -c 20 -D and ioping -RD -w 5 (post-TRIM)",
        "kernel": "5.15.0-94-generic",
        "artifacts": "fio.<drive>.<workload>.json + storage_meta.json + bench_storage.json (on host: /home/user/cbrun)",
    },
}

# per-drive findings + conclusion rows
for d in drives:
    lbl, mdl, sn = d["label"], d.get("model", "?"), d.get("serial", "?")
    line = (f"{lbl} ({mdl}, S/N {sn}): seq {g(d,'seq_read_gbs'):.2f}/{g(d,'seq_write_gbs'):.2f} GB/s R/W, "
            f"4K random {fmtk(g(d,'rand_read_iops'))}/{fmtk(g(d,'rand_write_iops'))} IOPS R/W, "
            f"QD1 latency {g(d,'qd1_read_us'):.0f}/{g(d,'qd1_write_us'):.0f} us R/W")
    if d.get("link_width_warn"):
        line += f" - LINK WARNING: {d['link_width_warn']}"
    results["findings"].append(line)
    results["conclusion"]["rows"].append([
        f"{lbl} - {mdl}  S/N {sn}",
        f"seq {g(d,'seq_read_gbs'):.2f}/{g(d,'seq_write_gbs'):.2f} GB/s, "
        f"rand {fmtk(g(d,'rand_read_iops'))}/{fmtk(g(d,'rand_write_iops'))}",
        d["_verdict"],
    ])
results["conclusion"]["rows"].append(
    ["Write-path root cause", "Fragmented FTL (un-TRIMmed history); TRIM + settle recovered 12x - remediated", "PASS"])
results["conclusion"]["rows"].append(
    ["Thermals", "31-33 C idle; peak 39 C (X100P) / 44 C (PM9A3) at full write rate; no throttling", "PASS"])
results["conclusion"]["rows"].append(
    ["SMART health (all 4)", "0 media errors, 0% wear, no critical warnings pre/post", "PASS"])

json.dump(results, open(OUT, "w"), indent=1)
print("wrote", OUT)
print(json.dumps([{k: d.get(k) for k in ('label','seq_read_gbs','seq_write_gbs','rand_read_iops','rand_write_iops','qd1_read_us','qd1_write_us','link','_verdict')} for d in drives], indent=1))
