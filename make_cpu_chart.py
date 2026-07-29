"""Generate the CPU efficiency comparison chart for Section 10."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

OUT = r"C:\Users\asus\Desktop\Davasarathi\charts"
os.makedirs(OUT, exist_ok=True)

NAVY  = "#0B2545"
RED   = "#C8102E"
GRAY  = "#3F4756"
OK    = "#2E7D32"
AMBER = "#FFB400"

plt.rcParams.update({
    'font.family': 'DejaVu Sans', 'font.size': 9,
    'axes.edgecolor': GRAY, 'axes.labelcolor': GRAY,
    'xtick.color': GRAY, 'ytick.color': GRAY,
    'axes.spines.top': False, 'axes.spines.right': False,
})

def chart_cpu_compare():
    # System-wide CPU busy %, side-by-side for TCP and RoCE
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8.0, 3.6))

    # ---- LEFT panel: system CPU busy % ----
    groups = ["Server (srv218)\nreceiver",
              "Client (srv148)\nsender"]
    tcp_vals  = [6.20, 2.40]
    roce_vals = [0.71, 1.36]
    x = np.arange(len(groups)); w = 0.35
    b1 = ax1.bar(x - w/2, tcp_vals,  width=w, color=RED,  edgecolor=NAVY, linewidth=0.6, label="TCP (iperf3)")
    b2 = ax1.bar(x + w/2, roce_vals, width=w, color=OK,   edgecolor=NAVY, linewidth=0.6, label="RoCE (ib_write_bw)")
    ax1.set_xticks(x); ax1.set_xticklabels(groups, fontsize=8.5)
    ax1.set_ylabel("System-wide CPU busy (%)", fontweight='bold')
    ax1.set_title("Average CPU usage at ~100 Gb/s line rate",
                  color=NAVY, fontweight='bold', fontsize=9.5)
    ax1.set_ylim(0, 8.0)
    for b, v in zip(b1, tcp_vals):
        ax1.text(b.get_x()+b.get_width()/2, b.get_height()+0.12,
                 f"{v}%", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
    for b, v in zip(b2, roce_vals):
        ax1.text(b.get_x()+b.get_width()/2, b.get_height()+0.12,
                 f"{v}%", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
    ax1.legend(loc='upper right', fontsize=8, frameon=False)

    # ---- RIGHT panel: CPU cost per Gb/s (normalised), ratio annotated ----
    groups = ["Server (srv218)\nreceiver",
              "Client (srv148)\nsender"]
    tcp_cost  = [0.0658, 0.0254]
    roce_cost = [0.0072, 0.0139]
    ratio     = [9.2, 1.8]
    b1 = ax2.bar(x - w/2, tcp_cost,  width=w, color=RED,  edgecolor=NAVY, linewidth=0.6, label="TCP")
    b2 = ax2.bar(x + w/2, roce_cost, width=w, color=OK,   edgecolor=NAVY, linewidth=0.6, label="RoCE")
    ax2.set_xticks(x); ax2.set_xticklabels(groups, fontsize=8.5)
    ax2.set_ylabel("CPU cost  (%busy / Gb/s)", fontweight='bold')
    ax2.set_title("Normalised CPU cost  —  ratio annotated",
                  color=NAVY, fontweight='bold', fontsize=9.5)
    ax2.set_ylim(0, 0.085)
    for b, v in zip(b1, tcp_cost):
        ax2.text(b.get_x()+b.get_width()/2, b.get_height()+0.0015,
                 f"{v:.4f}", ha='center', fontsize=7.5, fontweight='bold', color=NAVY)
    for b, v in zip(b2, roce_cost):
        ax2.text(b.get_x()+b.get_width()/2, b.get_height()+0.0015,
                 f"{v:.4f}", ha='center', fontsize=7.5, fontweight='bold', color=NAVY)
    # ratio overlay
    for i, r in enumerate(ratio):
        ax2.text(i, max(tcp_cost[i], roce_cost[i]) + 0.012,
                 f"TCP burns\n~{r}× more CPU",
                 ha='center', fontsize=8, fontweight='bold', color=RED)
    ax2.legend(loc='upper right', fontsize=8, frameon=False)

    fig.suptitle("CPU Efficiency: RoCE bypasses the kernel — TCP does not",
                 color=NAVY, fontweight='bold', fontsize=11, y=1.02)
    fig.tight_layout()
    fig.savefig(f"{OUT}/cpu_compare.png", dpi=200, bbox_inches='tight')
    plt.close(fig)
    print(f"  saved: {OUT}/cpu_compare.png")

def chart_per_core():
    """Show per-core busy% during each test — TCP spreads load, RoCE concentrates."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8.0, 2.9))

    # Top 5 cores during TCP (server)
    tcp_server = [("c41", 68.7), ("c43", 68.3), ("c47", 68.2),
                  ("c46", 66.7), ("c48", 66.6)]
    # Top 5 cores during RoCE (server)
    roce_server = [("c40", 86.0), ("c102", 1.6), ("c67", 1.3),
                   ("c109", 0.4), ("c33", 0.1)]

    cores_t, vals_t = zip(*tcp_server)
    ax1.bar(range(5), vals_t, color=RED, edgecolor=NAVY, linewidth=0.6)
    ax1.set_xticks(range(5)); ax1.set_xticklabels(cores_t)
    ax1.set_ylabel("Core busy (%)", fontweight='bold')
    ax1.set_title("TCP iperf3 — RX load spread across many cores",
                  color=RED, fontweight='bold', fontsize=9.5)
    ax1.set_ylim(0, 100)
    for i, v in enumerate(vals_t):
        ax1.text(i, v+1.5, f"{v}%", ha='center', fontsize=8, fontweight='bold', color=NAVY)

    cores_r, vals_r = zip(*roce_server)
    ax2.bar(range(5), vals_r, color=OK, edgecolor=NAVY, linewidth=0.6)
    ax2.set_xticks(range(5)); ax2.set_xticklabels(cores_r)
    ax2.set_ylabel("Core busy (%)", fontweight='bold')
    ax2.set_title("RoCE ib_write_bw — one core, rest idle",
                  color=OK, fontweight='bold', fontsize=9.5)
    ax2.set_ylim(0, 100)
    for i, v in enumerate(vals_r):
        ax2.text(i, v+1.5, f"{v}%", ha='center', fontsize=8, fontweight='bold', color=NAVY)

    fig.suptitle("Top 5 busiest cores on the SERVER (srv218) during each test",
                 color=NAVY, fontweight='bold', fontsize=10, y=1.04)
    fig.tight_layout()
    fig.savefig(f"{OUT}/cpu_per_core.png", dpi=200, bbox_inches='tight')
    plt.close(fig)
    print(f"  saved: {OUT}/cpu_per_core.png")

chart_cpu_compare()
chart_per_core()
print("OK")
