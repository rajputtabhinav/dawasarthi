"""Charts for the through-switch section of the report v3."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

OUT = r"C:\Users\asus\Desktop\Davasarathi\charts"
os.makedirs(OUT, exist_ok=True)

NAVY  = "#0B2545"; RED = "#C8102E"; GRAY = "#3F4756"
LIGHT = "#EEF2F6"; OK = "#2E7D32"; AMBER = "#FFB400"

plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,
    'axes.edgecolor':GRAY,'axes.labelcolor':GRAY,
    'xtick.color':GRAY,'ytick.color':GRAY,
    'axes.spines.top':False,'axes.spines.right':False})

# 1) Through-switch topology
def topology_switched():
    fig, ax = plt.subplots(figsize=(7.5, 2.8))
    ax.set_xlim(0, 12); ax.set_ylim(0, 5); ax.axis('off')
    # Left server
    ax.add_patch(plt.Rectangle((0.2, 1.0), 3.0, 3.0, facecolor=LIGHT, edgecolor=NAVY, linewidth=1.4))
    ax.text(1.7, 3.7, "srv21", fontsize=11, fontweight='bold', ha='center', color=NAVY)
    ax.text(1.7, 3.3, "Tyrone-Camarero", fontsize=7, ha='center', color=GRAY)
    ax.text(1.7, 3.0, "Xeon Gold 6338", fontsize=7, ha='center', color=GRAY)
    ax.text(1.7, 2.55, "BCM57508", fontsize=8, ha='center', color=RED, fontweight='bold')
    ax.text(1.7, 2.25, "ens8f1np1", fontsize=7, ha='center', color=GRAY)
    ax.text(1.7, 2.0, "10.10.10.1", fontsize=7.5, ha='center', color=GRAY)
    ax.text(1.7, 1.7, "PCIe Gen4 × 16", fontsize=7, ha='center', color=GRAY)
    ax.text(1.7, 1.4, "NUMA 1", fontsize=7, ha='center', color=GRAY)
    # Switch
    ax.add_patch(plt.Rectangle((4.5, 1.5), 3.0, 2.0, facecolor="#FFF6D6", edgecolor=NAVY, linewidth=1.4))
    ax.text(6.0, 3.15, "SWITCH", fontsize=11, fontweight='bold', ha='center', color=NAVY)
    ax.text(6.0, 2.80, "Accton AS4630-54TE", fontsize=7.5, ha='center', color=GRAY)
    ax.text(6.0, 2.55, "SONiC 4.5.1-Enterprise", fontsize=7, ha='center', color=GRAY)
    ax.text(6.0, 2.30, "Eth1/54 ↔ Eth1/53", fontsize=7.5, ha='center', color=NAVY)
    ax.text(6.0, 1.95, "VLAN 1  ·  MFS 9100", fontsize=7, ha='center', color=GRAY)
    ax.text(6.0, 1.65, "PFC: not configured", fontsize=7, ha='center', color=RED, style='italic')
    # Right server
    ax.add_patch(plt.Rectangle((8.8, 1.0), 3.0, 3.0, facecolor=LIGHT, edgecolor=NAVY, linewidth=1.4))
    ax.text(10.3, 3.7, "srv132", fontsize=11, fontweight='bold', ha='center', color=NAVY)
    ax.text(10.3, 3.3, "Tyrone MDA200A2N", fontsize=7, ha='center', color=GRAY)
    ax.text(10.3, 3.0, "EPYC 9135", fontsize=7, ha='center', color=GRAY)
    ax.text(10.3, 2.55, "BCM57504", fontsize=8, ha='center', color=RED, fontweight='bold')
    ax.text(10.3, 2.25, "enp1s0np0", fontsize=7, ha='center', color=GRAY)
    ax.text(10.3, 2.0, "10.10.10.2", fontsize=7.5, ha='center', color=GRAY)
    ax.text(10.3, 1.7, "PCIe Gen4 × 16", fontsize=7, ha='center', color=GRAY)
    ax.text(10.3, 1.4, "NUMA 0", fontsize=7, ha='center', color=GRAY)
    # Cables
    ax.annotate("", xy=(4.5, 2.5), xytext=(3.2, 2.5),
                arrowprops=dict(arrowstyle="<->", color=NAVY, lw=2.0))
    ax.text(3.85, 2.7, "100G DAC", fontsize=8, fontweight='bold', ha='center', color=NAVY)
    ax.annotate("", xy=(8.8, 2.5), xytext=(7.5, 2.5),
                arrowprops=dict(arrowstyle="<->", color=NAVY, lw=2.0))
    ax.text(8.15, 2.7, "100G DAC", fontsize=8, fontweight='bold', ha='center', color=NAVY)
    ax.text(6.0, 4.55, "Through-switch topology — 100G ↔ AS4630-54TE/SONiC ↔ 100G",
            fontsize=10, fontweight='bold', ha='center', color=NAVY)
    fig.tight_layout()
    fig.savefig(f"{OUT}/topology_switched.png", dpi=200, bbox_inches='tight')
    plt.close(fig); print("  ok: topology_switched")

# 2) Back-to-back vs through-switch TCP and RoCE BW comparison
def bw_b2b_vs_switch():
    fig, ax = plt.subplots(figsize=(7.5, 3.4))
    labels = ["TCP iperf3\n(5-min)", "ib_send_bw", "ib_write_bw", "ib_read_bw", "Bidir\naggregate"]
    b2b  = [94.04, 98.18, 98.18, 98.17, 194.99]
    swt  = [68.62, 98.18, 98.18, 98.17, 194.88]
    x = np.arange(len(labels)); w = 0.36
    b1 = ax.bar(x - w/2, b2b, width=w, color=OK, edgecolor=NAVY, linewidth=0.7,
                label="Back-to-back (no switch)")
    b2 = ax.bar(x + w/2, swt, width=w, color=AMBER, edgecolor=NAVY, linewidth=0.7,
                label="Through Accton AS4630/SONiC switch")
    for b, v in zip(b1, b2b):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+2,
                f"{v}", ha='center', fontsize=8, fontweight='bold', color=NAVY)
    for b, v in zip(b2, swt):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+2,
                f"{v}", ha='center', fontsize=8, fontweight='bold', color=NAVY)
    # TCP drop annotation
    ax.annotate(f"−25.4 Gb/s\n(TCP collapse,\nno PFC)", xy=(0.18, 70), xytext=(0.6, 130),
                fontsize=8.5, color=RED, fontweight='bold', ha='center',
                arrowprops=dict(arrowstyle="->", color=RED, lw=1.2))
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Throughput (Gb/s)", fontweight='bold')
    ax.set_title("Back-to-back  vs  Through-switch  —  RoCE unaffected, TCP drops by 27 %",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 220)
    ax.legend(loc='upper left', fontsize=8.5, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/bw_b2b_vs_switch.png", dpi=200, bbox_inches='tight')
    plt.close(fig); print("  ok: bw_b2b_vs_switch")

# 3) Latency: back-to-back vs through switch
def lat_b2b_vs_switch():
    fig, ax = plt.subplots(figsize=(7.5, 2.8))
    labels = ["ib_send_lat", "ib_write_lat", "ib_read_lat"]
    b2b = [2.59, 2.41, 4.39]
    swt = [3.76, 3.58, 6.75]
    x = np.arange(len(labels)); w = 0.36
    b1 = ax.bar(x - w/2, b2b, width=w, color=OK, edgecolor=NAVY, linewidth=0.7,
                label="Back-to-back")
    b2 = ax.bar(x + w/2, swt, width=w, color=AMBER, edgecolor=NAVY, linewidth=0.7,
                label="Through switch")
    for b, v in zip(b1, b2b):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+0.1,
                f"{v} µs", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
    for b, v in zip(b2, swt):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+0.1,
                f"{v} µs", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
    # delta annotation
    deltas = [s-bb for s,bb in zip(swt,b2b)]
    for i, d in enumerate(deltas):
        ax.text(i, max(b2b[i], swt[i]) + 0.7, f"+{d:.2f} µs\n(switch hop)",
                ha='center', fontsize=7.5, color=RED, fontweight='bold')
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Min latency (µs) — 2-byte msg", fontweight='bold')
    ax.set_title("RoCE latency adds ~1.2 – 2.4 µs per switch hop", color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 9)
    ax.legend(loc='upper left', fontsize=8.5, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/lat_b2b_vs_switch.png", dpi=200, bbox_inches='tight')
    plt.close(fig); print("  ok: lat_b2b_vs_switch")

# 4) Power consumption (3 phases, two servers)
def power_chart():
    fig, ax = plt.subplots(figsize=(7.5, 3.6))
    labels = ["srv21 (Xeon 6338)", "srv132 (EPYC 9135)"]
    idle = [273.3, 270.1]
    tcp  = [328.0, 309.3]
    roce = [279.5, 282.1]
    x = np.arange(len(labels)); w = 0.25
    ax.bar(x - w, idle, width=w, color="#9CAEC5", edgecolor=NAVY, linewidth=0.6, label="Idle")
    ax.bar(x,     tcp,  width=w, color=RED, edgecolor=NAVY, linewidth=0.6, label="TCP @ line rate")
    ax.bar(x + w, roce, width=w, color=OK,  edgecolor=NAVY, linewidth=0.6, label="RoCE @ line rate")
    for i, (i_, t_, r_) in enumerate(zip(idle, tcp, roce)):
        ax.text(i - w, i_+3, f"{i_:.0f}W", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
        ax.text(i,     t_+3, f"{t_:.0f}W", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
        ax.text(i + w, r_+3, f"{r_:.0f}W", ha='center', fontsize=8.5, fontweight='bold', color=NAVY)
        ax.text(i, max(t_, r_) + 22, f"TCP −RoCE = +{t_-r_:.0f} W\nsaved with RoCE",
                ha='center', fontsize=8, fontweight='bold', color=RED)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9.5)
    ax.set_ylabel("Total system power (W) — IPMI DCMI reading", fontweight='bold')
    ax.set_title("Power consumption — TCP burns 27–49 W more than RoCE at line rate",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 400)
    ax.legend(loc='upper right', fontsize=8.5, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/power.png", dpi=200, bbox_inches='tight')
    plt.close(fig); print("  ok: power")

# 5) CPU through switch vs back-to-back
def cpu_b2b_vs_switch():
    fig, ax = plt.subplots(figsize=(7.5, 3.0))
    labels = ["TCP server", "RoCE server", "TCP client", "RoCE client"]
    b2b = [6.20, 0.71, 2.40, 1.36]
    swt = [3.87, 0.69, 1.52, 1.36]
    x = np.arange(len(labels)); w = 0.35
    ax.bar(x - w/2, b2b, width=w, color=OK, edgecolor=NAVY, linewidth=0.7, label="Back-to-back")
    ax.bar(x + w/2, swt, width=w, color=AMBER, edgecolor=NAVY, linewidth=0.7, label="Through switch")
    for i, (bb, sw) in enumerate(zip(b2b, swt)):
        ax.text(i - w/2, bb+0.15, f"{bb}%", ha='center', fontsize=8, fontweight='bold', color=NAVY)
        ax.text(i + w/2, sw+0.15, f"{sw}%", ha='center', fontsize=8, fontweight='bold', color=NAVY)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=8.5)
    ax.set_ylabel("System CPU busy (%)", fontweight='bold')
    ax.set_title("CPU efficiency — RoCE stays ≤ 1.4 % on both topologies",
                 color=NAVY, fontweight='bold', fontsize=10)
    ax.set_ylim(0, 8)
    ax.legend(loc='upper right', fontsize=8.5, frameon=False)
    fig.tight_layout()
    fig.savefig(f"{OUT}/cpu_b2b_vs_switch.png", dpi=200, bbox_inches='tight')
    plt.close(fig); print("  ok: cpu_b2b_vs_switch")

topology_switched()
bw_b2b_vs_switch()
lat_b2b_vs_switch()
power_chart()
cpu_b2b_vs_switch()
print("done")
