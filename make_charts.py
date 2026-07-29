"""Generate the chart images for the report."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

OUT = r"C:\Users\asus\Desktop\Davasarathi\charts"
os.makedirs(OUT, exist_ok=True)

NAVY   = "#0B2545"
RED    = "#C8102E"
GRAY   = "#3F4756"
LIGHT  = "#EEF2F6"
OK     = "#2E7D32"
AMBER  = "#FFB400"

plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'font.size': 9,
    'axes.edgecolor': GRAY,
    'axes.labelcolor': GRAY,
    'xtick.color': GRAY,
    'ytick.color': GRAY,
    'axes.spines.top': False,
    'axes.spines.right': False,
})

# 1) TCP throughput progression chart
def chart_tcp_progression():
    stages = ["Untuned\n(P=16)", "MTU + buffers\n+ governor",
              "4 instances\nrandom cores", "8 instances\nrandom cores",
              "12 instances\nrandom cores", "12 instances\nNUMA-local\n(final)"]
    bw = [27.4, 28.0, 44.1, 74.1, 74.8, 94.04]
    colors_ = [RED, RED, AMBER, AMBER, AMBER, OK]
    fig, ax = plt.subplots(figsize=(7.5, 3.2))
    bars = ax.bar(stages, bw, color=colors_, edgecolor=NAVY, linewidth=0.6)
    ax.set_ylabel("TCP throughput (Gb/s)", fontweight='bold')
    ax.set_title("TCP tuning journey — 5-minute iperf3, NUMA-local pinning was the unlock",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.axhline(y=100, color=GRAY, linestyle=':', linewidth=0.7, alpha=0.5)
    ax.text(5.4, 100.5, "100 Gb/s line rate", color=GRAY, fontsize=8, ha='right')
    ax.set_ylim(0, 110)
    for b, v in zip(bars, bw):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+1.5,
                f"{v}", ha='center', fontsize=8.5, fontweight='bold',
                color=NAVY)
    ax.tick_params(axis='x', labelsize=7.8)
    fig.tight_layout()
    fig.savefig(f"{OUT}/tcp_progression.png", dpi=200, bbox_inches='tight')
    plt.close(fig)

# 2) RoCE bandwidth comparison chart
def chart_roce_bw():
    tests = ["ib_send_bw", "ib_write_bw", "ib_read_bw", "Bi-dir\naggregate"]
    ours = [98.18, 98.18, 98.17, 194.99]
    bcm_low  = [96, 96, 94, 190]
    bcm_high = [98, 98, 97, 196]
    cx6_low  = [96, 97, 96, 190]
    cx6_high = [98, 98, 98, 196]
    x = np.arange(len(tests))
    w = 0.27
    fig, ax = plt.subplots(figsize=(7.5, 3.3))
    # Industry ranges as floating bars
    ax.bar(x - w, [h-l for l,h in zip(bcm_low,bcm_high)], width=w,
           bottom=bcm_low, color="#A0AEC2", edgecolor=GRAY, linewidth=0.5,
           label="Broadcom Thor (published range)")
    ax.bar(x + w, [h-l for l,h in zip(cx6_low,cx6_high)], width=w,
           bottom=cx6_low, color="#6FA4B7", edgecolor=GRAY, linewidth=0.5,
           label="NVIDIA ConnectX-6 (published range)")
    # Our values as solid bars
    bars = ax.bar(x, ours, width=w, color=OK, edgecolor=NAVY, linewidth=0.7,
                  label="Our Tyrone box (measured)")
    for b, v in zip(bars, ours):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+2,
                f"{v}", ha='center', fontsize=8.5, fontweight='bold',
                color=NAVY)
    ax.set_xticks(x); ax.set_xticklabels(tests, fontsize=9)
    ax.set_ylabel("Bandwidth (Gb/s)", fontweight='bold')
    ax.set_title("RoCE v2 bandwidth — measured vs published references",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 215)
    ax.legend(loc='upper left', fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/roce_bw.png", dpi=200, bbox_inches='tight')
    plt.close(fig)

# 3) Latency comparison chart
def chart_latency():
    tests = ["ib_send_lat", "ib_write_lat", "ib_read_lat"]
    ours = [2.59, 2.41, 4.39]
    bcm_low  = [1.8, 1.6, 3.0]
    bcm_high = [2.5, 2.2, 4.0]
    cx6_low  = [1.0, 0.9, 1.5]
    cx6_high = [1.3, 1.2, 2.0]
    x = np.arange(len(tests))
    w = 0.27
    fig, ax = plt.subplots(figsize=(7.5, 3.1))
    ax.bar(x - w, [h-l for l,h in zip(bcm_low,bcm_high)], width=w,
           bottom=bcm_low, color="#A0AEC2", edgecolor=GRAY, linewidth=0.5,
           label="Broadcom Thor (published range)")
    ax.bar(x + w, [h-l for l,h in zip(cx6_low,cx6_high)], width=w,
           bottom=cx6_low, color="#6FA4B7", edgecolor=GRAY, linewidth=0.5,
           label="NVIDIA ConnectX-6 (published range)")
    bars = ax.bar(x, ours, width=w, color=OK, edgecolor=NAVY, linewidth=0.7,
                  label="Our Tyrone box (measured)")
    for b, v in zip(bars, ours):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+0.08,
                f"{v} µs", ha='center', fontsize=8.5, fontweight='bold',
                color=NAVY)
    ax.set_xticks(x); ax.set_xticklabels(tests, fontsize=9)
    ax.set_ylabel("Min latency (µs) — 2-byte msg", fontweight='bold')
    ax.set_title("RoCE v2 latency — small-message min vs published references",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 5.5)
    ax.legend(loc='upper left', fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/latency.png", dpi=200, bbox_inches='tight')
    plt.close(fig)

# 4) Topology diagram
def chart_topology():
    fig, ax = plt.subplots(figsize=(7.5, 2.6))
    ax.set_xlim(0, 10); ax.set_ylim(0, 5)
    ax.axis('off')

    # Left server box
    ax.add_patch(plt.Rectangle((0.4, 1.0), 3.5, 3.0,
                               facecolor=LIGHT, edgecolor=NAVY, linewidth=1.5))
    ax.text(2.15, 3.7, "srv218", fontsize=12, fontweight='bold',
            ha='center', color=NAVY)
    ax.text(2.15, 3.3, "Tyrone-Camarero", fontsize=8, ha='center', color=GRAY)
    ax.text(2.15, 3.0, "Xeon Gold 6338  ·  128 GB DDR4", fontsize=7, ha='center', color=GRAY)
    ax.text(2.15, 2.6, "BCM57508 (200G card)", fontsize=8, ha='center',
            color=RED, fontweight='bold')
    ax.text(2.15, 2.3, "ens8f1np1  ·  10.10.10.1", fontsize=7.5, ha='center', color=GRAY)
    ax.text(2.15, 2.0, "RoCE dev: rocep202s0f1", fontsize=7, ha='center', color=GRAY)
    ax.text(2.15, 1.7, "PCIe Gen4 × 16  ·  NUMA 1", fontsize=7, ha='center', color=GRAY)
    ax.text(2.15, 1.3, "MTU 9000  ·  Active MTU 4096", fontsize=7, ha='center', color=GRAY)

    # Right server box
    ax.add_patch(plt.Rectangle((6.1, 1.0), 3.5, 3.0,
                               facecolor=LIGHT, edgecolor=NAVY, linewidth=1.5))
    ax.text(7.85, 3.7, "srv148", fontsize=12, fontweight='bold',
            ha='center', color=NAVY)
    ax.text(7.85, 3.3, "Tyrone MDA200A2N-224", fontsize=8, ha='center', color=GRAY)
    ax.text(7.85, 3.0, "EPYC 9135  ·  512 GB DDR5", fontsize=7, ha='center', color=GRAY)
    ax.text(7.85, 2.6, "BCM57504 (100G card)", fontsize=8, ha='center',
            color=RED, fontweight='bold')
    ax.text(7.85, 2.3, "enp1s0np0  ·  10.10.10.2", fontsize=7.5, ha='center', color=GRAY)
    ax.text(7.85, 2.0, "RoCE dev: rocep1s0", fontsize=7, ha='center', color=GRAY)
    ax.text(7.85, 1.7, "PCIe Gen4 × 16  ·  NUMA 0", fontsize=7, ha='center', color=GRAY)
    ax.text(7.85, 1.3, "MTU 9000  ·  Active MTU 4096", fontsize=7, ha='center', color=GRAY)

    # The cable (back-to-back)
    ax.annotate("", xy=(6.0, 2.5), xytext=(4.0, 2.5),
                arrowprops=dict(arrowstyle="<->", color=NAVY, lw=2.5))
    ax.text(5.0, 2.85, "100 G DAC", fontsize=10, fontweight='bold',
            ha='center', color=NAVY)
    ax.text(5.0, 2.20, "back-to-back", fontsize=8, ha='center', color=GRAY, style='italic')
    ax.text(5.0, 1.95, "10.10.10.0/24", fontsize=8, ha='center', color=GRAY)

    # Title
    ax.text(5.0, 4.7, "Test topology — direct back-to-back, no switch in path",
            fontsize=10, fontweight='bold', ha='center', color=NAVY)
    fig.tight_layout()
    fig.savefig(f"{OUT}/topology.png", dpi=200, bbox_inches='tight')
    plt.close(fig)

for fn in [chart_tcp_progression, chart_roce_bw, chart_latency, chart_topology]:
    fn(); print(f"  ok: {fn.__name__}")
print(f"\nCharts in: {OUT}")
