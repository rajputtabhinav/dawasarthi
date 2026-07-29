"""
Netweb 3-Hour Memory Validation Report — server 172.16.11.41 (MDI300)
Intel Xeon 6730P (Granite Rapids) / Tyrone MDI300
12 x Samsung 96 GB DDR5-6400 RDIMM (MDRRWM4QDBC2-3E000) = 1.15 TB

Campaign (09 Jun 2026):
  Phase 1: 2h stress-ng --vm 64 --vm-bytes 13G --vm-method all --verify  -> 0 errors
  Phase 2: 30m 64x memtester 17G (mlock'd) = 1088 GB locked (96% RAM)    -> 0 errors
  Result: PASS (12/12 DIMMs 0 CE / 0 UE; CPU at full 3.8 GHz turbo)
"""

import os
from io import BytesIO
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, PageBreak, Image, NextPageTemplate,
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

NAVY     = colors.HexColor("#0E2A47")
NAVY_DK  = colors.HexColor("#091B30")
RED      = colors.HexColor("#C8102E")
ORANGE   = colors.HexColor("#F2A900")
GREEN_OK = colors.HexColor("#2E8B57")
BLUE_B   = colors.HexColor("#1F5AA8")
GREY_BG  = colors.HexColor("#E8EEF5")
ROW_ALT  = colors.HexColor("#F4F7FB")
TEXT_DK  = colors.HexColor("#1A1A1A")

OUT_PDF  = r"C:\Users\asus\Desktop\Netweb_41_MDI300_3h_Memory_Validation_Report.pdf"

def mc(c):
    return "#%02x%02x%02x" % (int(c.red*255), int(c.green*255), int(c.blue*255))

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], textColor=RED,
                    fontName="Helvetica-Bold", fontSize=16, spaceAfter=6, spaceBefore=2)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=NAVY,
                    fontName="Helvetica-Bold", fontSize=11, spaceAfter=4, spaceBefore=6)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=9, leading=12, textColor=TEXT_DK, alignment=TA_JUSTIFY)
BODY_SM = ParagraphStyle("BodySm", parent=BODY, fontSize=8, leading=10.5)
TBL_CELL = ParagraphStyle("TblCell", parent=BODY, fontSize=8.4, leading=10,
                          alignment=TA_LEFT, spaceBefore=0, spaceAfter=0)
TBL_HDR = ParagraphStyle("TblHdr", parent=BODY, fontName="Helvetica-Bold",
                         fontSize=9, leading=10.5, alignment=TA_CENTER, textColor=colors.white)
COVER_TITLE = ParagraphStyle("CoverTitle", parent=styles["Title"], textColor=NAVY,
                             fontName="Helvetica-Bold", fontSize=27, leading=31,
                             alignment=TA_CENTER, spaceAfter=4)
COVER_SUB   = ParagraphStyle("CoverSub", parent=styles["Heading2"], textColor=RED,
                             fontName="Helvetica-Bold", fontSize=15, leading=18,
                             alignment=TA_CENTER, spaceAfter=18)
COVER_TEXT  = ParagraphStyle("CoverText", parent=styles["BodyText"], textColor=TEXT_DK,
                             fontName="Helvetica", fontSize=11, leading=15,
                             alignment=TA_CENTER, spaceAfter=4)

PAGE_W, PAGE_H = A4
MARGIN_L = MARGIN_R = 14 * mm
MARGIN_T = 26 * mm
MARGIN_B = 18 * mm

EM = "—"; ARROW = "→"; LDQUO = "“"; RDQUO = "”"
TIMES = "×"; GE = "≥"; APPROX = "≈"; BULLET = "•"; OK = "✓"


def draw_header(canv, doc):
    canv.saveState()
    canv.setFillColor(NAVY); canv.rect(0, PAGE_H-16*mm, PAGE_W, 16*mm, fill=1, stroke=0)
    canv.setFillColor(RED);  canv.rect(0, PAGE_H-17.4*mm, PAGE_W, 1.4*mm, fill=1, stroke=0)
    canv.setFillColor(colors.white); canv.setFont("Helvetica-Bold", 10.5)
    canv.drawString(MARGIN_L, PAGE_H-10*mm, "NETWEB TECHNOLOGIES INDIA LTD")
    canv.setFont("Helvetica-Oblique", 7.5); canv.setFillColor(colors.HexColor("#C9D6E6"))
    canv.drawString(MARGIN_L, PAGE_H-13.5*mm, "Empowering Compute, Network and Storage")
    canv.setFillColor(colors.white); canv.setFont("Helvetica", 8.5)
    canv.drawRightString(PAGE_W-MARGIN_R, PAGE_H-10*mm, "Server 172.16.11.41 (MDI300) — 3-Hour Memory Validation")
    canv.setFillColor(NAVY); canv.rect(0, 0, PAGE_W, 10*mm, fill=1, stroke=0)
    canv.setFillColor(colors.white); canv.setFont("Helvetica", 7.5)
    canv.drawString(MARGIN_L, 5*mm, f"Confidential {EM} Internal Engineering")
    canv.drawCentredString(PAGE_W/2, 5*mm, f"Page {doc.page}")
    canv.drawRightString(PAGE_W-MARGIN_R, 5*mm, "09 June 2026")
    canv.restoreState()


def draw_cover(canv, doc):
    canv.saveState()
    canv.setFillColor(NAVY); canv.rect(0, PAGE_H-38*mm, PAGE_W, 38*mm, fill=1, stroke=0)
    canv.setFillColor(RED);  canv.rect(0, PAGE_H-40*mm, PAGE_W, 2*mm, fill=1, stroke=0)
    canv.setFillColor(colors.white); canv.setFont("Helvetica-Bold", 26)
    canv.drawCentredString(PAGE_W/2, PAGE_H-18*mm, "NETWEB TECHNOLOGIES")
    canv.setFont("Helvetica-Bold", 11); canv.drawCentredString(PAGE_W/2, PAGE_H-25*mm, "INDIA LIMITED")
    canv.setFont("Helvetica-Oblique", 10); canv.setFillColor(ORANGE)
    canv.drawCentredString(PAGE_W/2, PAGE_H-31*mm, "Empowering Compute, Network and Storage")
    canv.setFillColor(NAVY); canv.rect(0, 0, PAGE_W, 10*mm, fill=1, stroke=0)
    canv.setFillColor(colors.HexColor("#C9D6E6")); canv.setFont("Helvetica-Oblique", 7.5)
    canv.drawCentredString(PAGE_W/2, 5*mm, f"Confidential {EM} internal engineering review")
    canv.restoreState()


def chart_to_image(fig, width_mm=182, height_mm=60, dpi=170):
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig); buf.seek(0)
    return Image(buf, width=width_mm*mm, height=height_mm*mm)


def make_combo_chart():
    fig, axes = plt.subplots(1, 3, figsize=(11.5, 3.0),
                             gridspec_kw={"width_ratios":[1.0, 1.3, 1.5]})
    # Residency
    ax = axes[0]
    bars = ax.bar(["Phase 1\n2h verify", "Phase 2\n30m locked"], [22, 1088],
                  color=[mc(ORANGE), mc(RED)], edgecolor="#222", linewidth=0.6)
    ax.set_ylim(0, 1200); ax.set_ylabel("GB resident", fontsize=8.5)
    ax.set_title("Memory residency", fontsize=10, color=mc(NAVY))
    for b, r, p in zip(bars, [22, 1088], [1.9, 96.0]):
        ax.text(b.get_x()+b.get_width()/2, r+30, f"{p:.1f}%", ha="center",
                fontsize=9.5, fontweight="bold", color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=8); ax.grid(axis="y", ls=":", lw=0.4, alpha=0.5)
    # Bandwidth
    ax = axes[1]
    lbls = ["STREAM\nagg (64w)", "STREAM\nNUMA0", "MBW 1-thr\nlocal", "MBW 1-thr\nremote"]
    vals = [417.4, 74.2, 6.34, 2.46]
    bcol = [mc(GREEN_OK), mc(GREEN_OK), mc(ORANGE), mc(RED)]
    bars = ax.bar(lbls, vals, color=bcol, edgecolor="#222", linewidth=0.6)
    ax.set_ylabel("GB/s", fontsize=8.5); ax.set_title("Memory bandwidth", fontsize=10, color=mc(NAVY))
    ax.set_ylim(0, max(vals)*1.18)
    for b, v in zip(bars, vals):
        ax.text(b.get_x()+b.get_width()/2, v+max(vals)*0.02, f"{v:.1f}",
                ha="center", fontsize=8.8, fontweight="bold", color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=7.5); ax.grid(axis="y", ls=":", lw=0.4, alpha=0.5)
    # Per-DIMM EDAC (12 DIMMs)
    ax = axes[2]
    labels = [f"D{i}" for i in range(12)]
    ax.bar(labels, [1]*12, color=mc(GREEN_OK), edgecolor="#222", linewidth=0.4)
    ax.set_ylim(0, 1.3); ax.set_yticks([0, 1]); ax.set_yticklabels(["0", "PASS"], fontsize=8.5)
    ax.set_title("Per-DIMM EDAC (12 DIMMs) — all CE=0 UE=0", fontsize=10, color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=7)
    for i in range(12):
        ax.text(i, 1.06, "0/0", ha="center", fontsize=6.5, fontweight="bold", color="white")
    plt.tight_layout()
    return chart_to_image(fig, width_mm=182, height_mm=62)


def make_dimm_map():
    """Intel Xeon 6730P: 32 slots = 2 sockets x 8 channels x 2 slots/channel.
    Populated: ch A, B, C, E, F, G slot 1 each socket (12 DIMMs)."""
    fig, ax = plt.subplots(figsize=(11.0, 2.6))
    ax.set_xlim(0, 40); ax.set_ylim(0, 5.8); ax.axis("off")
    chans = ["A", "B", "C", "D", "E", "F", "G", "H"]
    populated_ch = ["A", "B", "C", "E", "F", "G"]
    bw, gap_slot, gap_chan = 1.7, 0.25, 0.7
    x0 = 5.0
    for label, y in [("Socket 0 (P0)", 3.5), ("Socket 1 (P1)", 1.3)]:
        ax.text(0.2, y+0.45, label, fontsize=8.8, fontweight="bold", color=mc(NAVY))
        x = x0
        for ch in chans:
            for slot in (1, 2):
                filled = (ch in populated_ch and slot == 1)
                color = mc(GREEN_OK) if filled else "#CCCCCC"
                ax.add_patch(plt.Rectangle((x, y), bw, 1.0, facecolor=color, edgecolor="#333", linewidth=0.5))
                ax.text(x+bw/2, y+0.5, f"{ch}{slot}", ha="center", va="center", fontsize=6.6,
                        fontweight="bold", color="white" if filled else "#777")
                x += bw + gap_slot
            x += gap_chan
    ax.text(20, 0.25,
            f"32 DIMM slots (2 sockets {TIMES} 8 channels {TIMES} 2 slots)  {BULLET}  "
            "12 populated = ch A, B, C, E, F, G slot 1 both sockets (1 DPC on 6-of-8 ch)  "
            f"{BULLET}  green = 96 GB Samsung DDR5-6400",
            ha="center", fontsize=6.8, color="#555", fontstyle="italic")
    plt.tight_layout()
    return chart_to_image(fig, width_mm=182, height_mm=50)


def std_table(data, col_widths, body_fontsize=8.4):
    wrapped = []
    for r, row in enumerate(data):
        nr = [Paragraph(c, TBL_HDR if r == 0 else TBL_CELL) if isinstance(c, str) else c for c in row]
        wrapped.append(nr)
    tbl = Table(wrapped, colWidths=col_widths, repeatRows=1)
    s = TableStyle([
        ("BACKGROUND", (0,0), (-1,0), NAVY),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#BBBBBB")),
        ("LEFTPADDING",(0,0),(-1,-1),4), ("RIGHTPADDING",(0,0),(-1,-1),4),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
    ])
    for i in range(1, len(data)):
        if i % 2 == 0:
            s.add("BACKGROUND", (0,i), (-1,i), ROW_ALT)
    tbl.setStyle(s)
    return tbl


def build():
    doc = BaseDocTemplate(OUT_PDF, pagesize=A4, leftMargin=MARGIN_L, rightMargin=MARGIN_R,
                          topMargin=MARGIN_T, bottomMargin=MARGIN_B,
                          title="Netweb 3-Hour Memory Validation Report — 172.16.11.41 (MDI300)",
                          author="Netweb Technologies India Ltd")
    frame = Frame(MARGIN_L, MARGIN_B, PAGE_W-MARGIN_L-MARGIN_R, PAGE_H-MARGIN_T-MARGIN_B, id="m")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=draw_cover),
        PageTemplate(id="body", frames=[frame], onPage=draw_header),
    ])
    story = []

    # COVER
    story.append(Spacer(1, 50*mm))
    story.append(Paragraph("3-Hour DDR5 Memory Validation", COVER_TITLE))
    story.append(Paragraph("Server 172.16.11.41  —  Tyrone MDI300 / Intel Xeon 6730P / 1.15 TB DDR5", COVER_SUB))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(f"12 {TIMES} Samsung 96 GB DDR5-6400 RDIMM", COVER_TEXT))
    story.append(Paragraph("On Tyrone MDI300 (dual Intel Xeon 6730P, Granite Rapids)", COVER_TEXT))
    story.append(Spacer(1, 12*mm))
    cover = Table([
        ["Prepared for:",  f"Shailendra {EM} Netweb Technologies India Ltd"],
        ["Date issued:",   "09 June 2026"],
        ["Test platform:", f"172.16.11.41 {EM} Tyrone MDI300, 2 {TIMES} Xeon 6730P, 1.15 TB DDR5-6400"],
        ["Campaign window:", f"05:17-08:04 UTC  {BULLET}  2 h stress-ng verify + 30 min @ 96 % RAM locked"],
        ["Status:",        f"PASS {EM} 0 correctable / 0 uncorrectable ECC across all 12 DIMMs"],
    ], colWidths=[34*mm, 140*mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,-1), GREY_BG),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#AAAAAA")),
        ("TEXTCOLOR", (1,4), (1,4), GREEN_OK), ("FONTNAME", (1,4), (1,4), "Helvetica-Bold"),
    ]))
    story.append(cover)
    story.append(NextPageTemplate("body")); story.append(PageBreak())

    # 1. EXEC SUMMARY
    story.append(Paragraph("1. Executive Summary", H1))
    story.append(Paragraph(
        f"3-hour memory validation of <b>12 {TIMES} Samsung 96 GB DDR5-6400 Registered ECC DIMMs "
        f"(1.15 TB total)</b> in server 172.16.11.41 (Tyrone MDI300, dual Intel Xeon 6730P "
        f"“Granite Rapids”). The campaign comprised two back-to-back phases on 09 June 2026: "
        f"a 2-hour stress-ng <i>--vm-method all --verify</i> pattern sweep across an 832 GB "
        f"rolling working set, and a 30-minute memtester burn that locked <b>1088 GB (96.0 % "
        f"of total RAM) into physical memory</b>. All 12 DIMMs were detected by BMC, BIOS and "
        f"kernel; modules ran at <b>full rated 6400 MT/s</b> (no platform downclock); EDAC "
        f"remained clean throughout; zero memtester failures.",
        BODY))
    story.append(Spacer(1, 2*mm))
    ex = [
        ["Metric", "Result", "Industry typical", "Verdict"],
        ["DIMM detection (BMC / BIOS / kernel)",
         "12 / 12 / 12 (all populated slots)", "12 / 12 / 12", f"{OK} PASS"],
        ["DIMM speed (rated / configured)",
         "6400 MT/s rated, 6400 MT/s configured (full speed)",
         "6400 MT/s on Intel 1DPC", f"{OK} PASS"],
        ["Phase 1 — 2h stress-ng verify (64 wkrs, 832 GB working set)",
         "successful run completed in 7206.02 s; 0 errors",
         "0 errors expected", f"{OK} PASS"],
        ["Phase 2 — 30m memtester locked (64 × 17 GB = 1088 GB)",
         "0 FAILURE/error strings across 64 logs",
         "0 errors expected", f"{OK} PASS"],
        ["Peak memory residency (Phase 2)",
         "1088 GB locked = 96.0 % of 1.15 TB",
         f"{GE} 90 % target", f"{OK} met"],
        ["EDAC CE / UE (16 controllers, delta)",
         "0 / 0 across all 16 mc",
         "0 (healthy modules)", f"{OK} clean"],
        ["Per-DIMM EDAC (12 DIMMs, dimm_ce/ue_count)",
         "12 / 12 DIMMs: CE = 0, UE = 0",
         "12 / 12 clean", f"{OK} clean"],
        ["MCE / machine-check events (kernel dmesg)",
         "0 new events in 2h 47m window",
         "0", f"{OK} clean"],
        ["BMC SEL memory events during campaign",
         "0 new entries (last SEL add pre-test)",
         "0", f"{OK} clean"],
        ["CPU frequency under load (turbostat Bzy_MHz)",
         "3792 MHz (full max-turbo, no throttle)",
         "3800 MHz max for 6730P", f"{OK} healthy"],
        ["STREAM aggregate (64 wkrs, both sockets)",
         "417.4 GB/s",
         "380 – 460 GB/s @ 12-of-16 ch.", f"{OK} in range"],
        ["NUMA-local bandwidth (single thread, MBW)",
         "6.34 GB/s NUMA-local; 2.46 GB/s NUMA-remote",
         "5 – 8 GB/s 1-thr on Xeon 6", f"{OK} expected"],
        ["sysbench 1 M random write (128 thr, 30 s)",
         "15.5 GB/s, 8.24 ms avg",
         "12 – 20 GB/s", f"{OK} in range"],
    ]
    story.append(std_table(ex, col_widths=[58*mm, 52*mm, 40*mm, 26*mm], body_fontsize=8.0))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"<b>Bottom line:</b> all 12 Samsung 96 GB DDR5-6400 modules pass a 2.5-hour "
        f"validation campaign comprising 2 hours of write-and-verify pattern rotation plus "
        f"30 minutes of <b>96 % RAM-resident burn (1.09 TB pinned)</b>, with <b>zero ECC "
        f"errors and zero machine-check events</b>. Modules run at their <b>full rated "
        f"6400 MT/s</b> (Intel Granite Rapids natively supports 1DPC DDR5-6400; no clamp). "
        f"CPU reaches full 3.8 GHz max turbo under load. The modules are healthy and the "
        f"server is fit for production memory-bound workloads.",
        BODY))
    story.append(PageBreak())

    # 2. ENVIRONMENT
    story.append(Paragraph("2. Test Environment & Methodology", H1))
    env_tbl = [
        ["Attribute", "Value"],
        ["Server model",  "Tyrone MDI300 (dual-socket Xeon 6 server) at 172.16.11.41"],
        ["CPU",           f"2 {TIMES} Intel Xeon 6730P “Granite Rapids” (32C / 64T each = 64C / 128T)"],
        ["CPU freq",      "Base 2500 MHz, max turbo 3800 MHz (verified 3792 MHz under load)"],
        ["L3 cache / ISA", f"576 MiB (288 per socket) {BULLET} AVX-512, AMX (amx_tile / amx_int8 / bf16)"],
        ["NUMA",          "4 nodes (SNC2 enabled — each socket split into 2 NUMA domains)"],
        ["OS / kernel",   "Ubuntu / Linux 6.8.0-124-generic"],
        ["EDAC",          "16 memory controllers (mc0-mc15), multi-bit ECC active"],
        ["Total RAM",     f"12 {TIMES} 96 GB = 1152 GB advertised (1133 GiB kernel-visible)"],
        ["Module P/N",    f"Samsung MDRRWM4QDBC2-3E000 {BULLET} DDR5 RDIMM 96 GB, dual-rank"],
        ["Speed",         "Rated 6400 MT/s; configured 6400 MT/s (full speed, no downclock)"],
        ["Slot population", "12 of 32 slots: P0 + P1 channels A, B, C, E, F, G slot 1 (1 DPC on 6-of-8 ch.)"],
    ]
    story.append(std_table(env_tbl, col_widths=[36*mm, 146*mm], body_fontsize=8.3))

    story.append(Paragraph("2.1 DIMM population map (12-of-32 slots, 1 DPC on 6-of-8 channels)", H2))
    story.append(make_dimm_map())

    story.append(Paragraph("2.2 Methodology", H2))
    mtbl = [
        ["Phase", "Tool & command", "Purpose"],
        ["Baseline", "EDAC sysfs + dmesg snapshot; BMC ipmitool sdr/sel; cpufreq performance",
         "Capture CE/UE=0; ensure CPU runs at rated freq"],
        ["Bandwidth", "stress-ng --stream 64; mbw -n 5 -t 0 4096 (local & SNC2-remote); sysbench memory",
         "Characterise STREAM, single-thread memcpy, NUMA penalty, sustained write"],
        ["Phase 1 (2 h)",
         "stress-ng --vm 64 --vm-bytes 13G --vm-method all --verify --timeout 7200s",
         "Touch 832 GB through 52 verify patterns over 2 hours; every write read back"],
        ["Phase 2 (30 min)",
         f"64 {TIMES} memtester 17G (timeout 1800s)",
         "Lock 1088 GB into RAM (mlock) + run memtester 18-algorithm suite at 96 % residency"],
        ["Post-test",
         "Re-read EDAC sysfs + per-DIMM counters; dmesg | grep mce/edac; ipmitool sel",
         "Delta-check vs baseline; per-DIMM PASS/FAIL; verify zero MCE/SEL entries"],
    ]
    story.append(std_table(mtbl, col_widths=[28*mm, 86*mm, 68*mm], body_fontsize=8.0))
    story.append(PageBreak())

    # 3. STABILITY
    story.append(Paragraph("3. Stability Results", H1))
    story.append(make_combo_chart())
    story.append(Spacer(1, 2*mm))

    story.append(Paragraph("3.1 Phase 1 — 2-hour stress-ng --verify", H2))
    s1 = [
        ["Parameter", "Value"],
        ["Start / end (UTC)", "2026-06-09 05:33:52 → 07:33:58"],
        ["Wall-clock duration", "2 h 6 sec (stress-ng reported 7206.02 s real time)"],
        ["Worker processes", "64 (1 per logical core)"],
        ["Working set / worker", "13 GB"],
        ["Aggregate working set", "64 × 13 GB = 832 GB rolling (~73 % of 1.15 TB)"],
        ["VM patterns rotated", "52 (--vm-method all)"],
        ["Verify mode", "ENABLED (--verify) — every write read back"],
        ["Load average (sustained)", "65.30 / 64.75 / 63.70 (perfect 64-core saturation)"],
        ["EDAC delta during phase", "0 CE / 0 UE on all 16 controllers"],
        ["stress-ng exit", "successful run completed in 7206.02s (2 h, 6.02 s)"],
    ]
    story.append(std_table(s1, col_widths=[60*mm, 122*mm], body_fontsize=8.4))

    story.append(Paragraph("3.2 Phase 2 — 30-minute 96 % memory load (peak residency)", H2))
    s2 = [
        ["Parameter", "Value"],
        ["Start / end (UTC)", "2026-06-09 07:34:05 → 08:04:43"],
        ["Wall-clock duration", "30 min 38 sec (30-min timeout + cleanup)"],
        ["Worker processes", "64 parallel memtester instances"],
        ["Buffer / worker", "17 GB anonymous, mlock'd"],
        ["Aggregate locked", f"1088 GB resident = <b>96.0 % of 1.15 TB total</b>"],
        ["Memory lock", "mlock() succeeded on all 64 workers"],
        ["Patterns (per worker)",
         "memtester 18-algorithm suite: Stuck Address, Random Value, Compare XOR/SUB/MUL/DIV/OR/AND, "
         "Seq Inc, Solid Bits, Block Seq, Checkerboard, Bit Spread, Bit Flip, Walking Ones/Zeros, "
         "8-/16-bit Writes"],
        ["FAILURE/ERROR strings (64 logs grepped)", "0 matches across all 64 memtester logs"],
        ["EDAC delta during phase", "0 CE / 0 UE on all 16 mc; 12 / 12 DIMMs at 0 / 0"],
    ]
    story.append(std_table(s2, col_widths=[60*mm, 122*mm], body_fontsize=8.3))
    story.append(PageBreak())

    # 4. BANDWIDTH + COMPARISON
    story.append(Paragraph("4. Bandwidth, NUMA & Comparison", H1))
    story.append(Paragraph("4.1 Bandwidth measurements (CPU at full 3.8 GHz turbo)", H2))
    bw = [
        ["Test", "Tool / config", "Result", "Verdict"],
        ["STREAM aggregate (64 wkrs, both sockets)",
         "stress-ng --stream 64, 30 s",
         "417.4 GB/s (6521 MB/s × 64)", f"{OK} in range"],
        ["STREAM single NUMA-node (16 wkrs, node0)",
         "numactl bind 0, --stream 16",
         "74.2 GB/s (4637 MB/s × 16)", f"{OK} in range"],
        ["MBW memcpy (4 GiB, 1 thr) NUMA-local (node0)",
         "numactl --cpunodebind=0 --membind=0",
         "6.34 GB/s", "expected per-thread"],
        ["MBW memcpy (4 GiB, 1 thr) NUMA-remote (node0 → node3)",
         "numactl --cpunodebind=0 --membind=3",
         f"2.46 GB/s (2.57 {TIMES} slower, SNC2 penalty)", "expected"],
        ["sysbench 1 M random write (128 thr, 30 s)",
         "memory --memory-block-size=1M",
         "15.5 GB/s, 8.24 ms avg", f"{OK} in range"],
    ]
    story.append(std_table(bw, col_widths=[58*mm, 50*mm, 50*mm, 24*mm], body_fontsize=8.2))

    story.append(Paragraph("4.2 Comparison vs the .217 EPYC reference", H2))
    cmp_tbl = [
        ["Metric", f"This server (.41 / Xeon 6730P)",
         "Reference (.217 / EPYC 9135)", "Comment"],
        ["DIMM speed configured", "6400 MT/s (full)",  "6000 MT/s (clamped from 6400)",
         "Intel runs rated; AMD 1DPC clamps to 6000"],
        ["Aggregate STREAM",      "417.4 GB/s",  "443.3 GB/s",
         "EPYC slightly higher per-channel"],
        ["1-thread memcpy local", "6.34 GB/s",   "20.77 GB/s",
         "EPYC has stronger per-thread BW"],
        ["NUMA-remote ratio",     f"2.57 {TIMES} (SNC2)", f"1.67 {TIMES}",
         "SNC2 increases remote penalty"],
        ["CPU max freq under load", "3792 MHz",  "boost ~4.3 GHz",
         "Both at rated max"],
        ["CE / UE in 3h test",    "0 / 0",       "0 / 0",
         "Both PASS"],
    ]
    story.append(std_table(cmp_tbl, col_widths=[34*mm, 44*mm, 44*mm, 60*mm], body_fontsize=8.0))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"<b>Reading the comparison.</b> This MDI300 (Xeon 6730P) and the earlier "
        f"172.16.13.217 (EPYC 9135) both run a 1.15 TB DDR5-6400 memory subsystem and both "
        f"pass full validation. Intel runs the modules at their <b>full rated 6400 MT/s</b> "
        f"(no platform downclock), while AMD's EPYC Turin 1DPC default clamps to 6000 MT/s. "
        f"Aggregate STREAM is essentially comparable ({APPROX}417 vs {APPROX}443 GB/s). EPYC "
        f"is stronger on single-thread memcpy (Zen 5's per-core BW advantage); Intel SNC2 "
        f"shows a larger NUMA-remote penalty by design (4 NUMA nodes vs 2). Note: a "
        f"<b>sibling MDI300 at 172.16.13.19</b> tested earlier had its CPU firmware-locked at "
        f"500 MHz; <b>this MDI300 at .41 is healthy</b> {EM} cores reach the full 3.8 GHz "
        f"max turbo under load, so bandwidth here is representative.",
        BODY))
    story.append(PageBreak())

    # 5. FINDINGS & RECOMMENDATIONS
    story.append(Paragraph("5. Findings & Recommendations", H1))

    story.append(Paragraph("5.1 What the 3-hour campaign proves", H2))
    story.append(Paragraph(
        f"{BULLET} All 12 Samsung 96 GB DDR5-6400 modules are <b>electrically and structurally "
        f"healthy</b>: 2 hours of write-and-verify across 52 stress-ng patterns <i>plus</i> "
        f"30 minutes at 96.0 % RAM residency (1.09 TB pinned) produced <b>zero ECC errors</b> "
        f"at controller and DIMM level.<br/>"
        f"{BULLET} BIOS identifies every module's SPD correctly (96 GB / DDR5-6400 / Samsung "
        f"/ MDRRWM4QDBC2-3E000) and trains them at their <b>full rated 6400 MT/s</b> — no "
        f"platform downclock on this Granite Rapids board.<br/>"
        f"{BULLET} ECC is active; the kernel's Intel-EDAC driver enumerates 16 memory "
        f"controllers; per-DIMM counters (CPU_SrcID#0/1 MC#0,1,2,4,5,6 Chan#0 DIMM#0) all "
        f"report cleanly.<br/>"
        f"{BULLET} Kernel logged <b>0 machine-check events</b> during the 2 h 47 m window. "
        f"BMC SEL added 0 new entries during the test (last entry pre-dates the campaign).<br/>"
        f"{BULLET} mlock() succeeded on all 64 memtester workers at 17 GB each {EM} the system "
        f"pins <b>96 % of RAM</b> without page reclaim, OOM, or swap activity.<br/>"
        f"{BULLET} CPU runs at full <b>3792 MHz under load</b> (matches the 3800 MHz max "
        f"turbo) {EM} no thermal or firmware throttle on this MDI300, unlike the sibling unit "
        f"at 172.16.13.19 which was locked at 500 MHz.", BODY))

    story.append(Paragraph("5.2 Recommended next steps", H2))
    story.append(Paragraph(
        f"{BULLET} <b>Modules cleared for production.</b> No DIMM action required; the 1.15 TB "
        f"configuration is qualified for memory-bound workloads (in-memory DBs, AI inference, "
        f"large caches, virtualisation).<br/>"
        f"{BULLET} Optional <b>8-hour soak</b> with the same Phase 2 config to convert from "
        f"<i>infant-mortality clean</i> to <i>burn-in qualified</i> before shipping.<br/>"
        f"{BULLET} <b>Populate the remaining 4 channels per socket</b> (full 16-of-16) to "
        f"push aggregate STREAM beyond {APPROX} 500 GB/s and unlock the full Granite Rapids "
        f"memory subsystem.<br/>"
        f"{BULLET} Enable BIOS <b>patrol scrub</b> (Setup {ARROW} Advanced {ARROW} RAS) to "
        f"catch single-bit errors during idle.<br/>"
        f"{BULLET} Install <b>rasdaemon</b> on the deployed system for continuous per-DIMM "
        f"error history (<i>apt install rasdaemon</i>).<br/>"
        f"{BULLET} <b>Consider this MDI300 as the reference</b> for diagnosing the .19 unit's "
        f"500 MHz freq lock {EM} both are the same SKU, so a BIOS/microcode diff between the "
        f"two will likely identify the .19 fix.", BODY))

    story.append(Paragraph("5.3 HPL (High-Performance Linpack) — peak FP64 throughput", H2))
    story.append(Paragraph(
        f"HPL solves a large dense linear system (LU + back-substitution) and reports "
        f"sustained FP64 GFLOPS. It is the same benchmark used for the TOP500 list and is "
        f"the standard way to measure how well a server actually delivers its theoretical "
        f"compute peak. The binary used here was built from netlib HPL 2.3 source linked "
        f"against <b>Intel oneAPI MKL 2024.0</b> (AVX-512 + AMX-aware BLAS) and run under "
        f"OpenMPI with 64 MPI ranks (one per logical core) in an 8 {TIMES} 8 grid.",
        BODY))
    hpl = [
        ["Run", "BIOS state", "N", "Config (grid, layout)", "TFLOPS", "Eff."],
        ["Baseline",  "default profile, SNC2 on", "100 000", "8×8, 64 MPI × 1 OMP", "3.97", "54 %"],
        ["Hybrid A",  "default, SNC2 on", "100 000", "4 MPI × 16 OMP NUMA-bound", "3.64", "49 %"],
        ["Hybrid B",  "default, SNC2 on", "100 000", "2 MPI × 32 OMP per-socket", "2.80", "38 %"],
        ["Bigger N",  "default, SNC2 on", "200 000", "8×8, 64 × 1", "4.92", "67 %"],
        ["Post-BIOS", "Perf profile + Turbo, SNC2 on", "340 000", "8×8, 64 × 1",
         f"<b>5.11</b>", f"<b>69 %</b>"],
        ["SNC test",  "Perf profile, SNC OFF", "350 000", "8×8, 64 × 1", "4.69", "64 %"],
        ["SNC test",  "Perf profile, SNC OFF", "340 000", "4×16, 64 × 1, core-bound", "4.62", "63 %"],
        ["Max-N",     "Perf profile, SNC OFF", "370 000", "8×8, 64 × 1 (93 % of RAM, 2 h 04 m)", "4.55", "62 %"],
    ]
    story.append(std_table(hpl, col_widths=[18*mm, 44*mm, 20*mm, 52*mm, 24*mm, 22*mm], body_fontsize=7.8))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"<b>Peak measured: 5.11 TFLOPS</b> sustained (N=340 000 {EM} a 925 GB matrix using "
        f"{APPROX}80 % of RAM {EM} NB=384, 8×8 grid, 64 MPI ranks, 85 min). Under the BIOS "
        f"Performance profile the CPUs sustain 3.6 GHz all-core AVX-512 ({APPROX}410-440 W "
        f"package), giving a theoretical FP64 peak of {APPROX}7.4 TFLOPS {EM} the measured "
        f"5.11 TFLOPS is <b>{APPROX}69 % efficiency</b>, the practical ceiling for the "
        f"netlib HPL 2.3 + MKL BLAS combination used here.<br/><br/>"
        f"<b>BIOS tuning impact (measured).</b> The Performance profile + Turbo raised the "
        f"large-N result from 4.92 {ARROW} 5.11 TFLOPS (+4 %). <b>Sub-NUMA Clustering was "
        f"tested both ways as requested</b>: SNC2 <i>enabled</i> is {APPROX}10 % faster for "
        f"this rank-per-core HPL layout (5.11 vs 4.55-4.69) {EM} 64 independent "
        f"single-threaded ranks each benefit from the smaller, closer SNC memory domain. "
        f"Hybrid MPI×OpenMP layouts and grid/broadcast variations were all slower; the "
        f"64-rank, NB=384, 8×8 configuration is optimal for this binary.<br/><br/>"
        f"<b>Maximum-memory run.</b> The largest problem this 1.15 TB configuration can "
        f"hold {EM} <b>N=370 000, a 1.10 TiB matrix occupying 93 % of RAM</b> {EM} completed "
        f"in 2 h 04 m at 4.55 TFLOPS with a PASSED residual and no OOM or swap activity, "
        f"demonstrating TOP500-style near-full-memory stability. Note that 93 % residency "
        f"scores {APPROX}3 % below the 80 %-RAM run: memory-reclaim pressure at the ceiling "
        f"costs more than the larger N gains, so {APPROX}80 % RAM is this platform's HPL "
        f"sweet spot. Running N {GE} 400 000 (a 1.28 TB matrix) physically requires "
        f"{GE} 1.35 TB of RAM {EM} i.e. the 8 {TIMES} 256 GB (2 TB) DIMM configuration, "
        f"which would support up to N {APPROX} 460 000.<br/><br/>"
        f"<b>Recommendation {EM} re-enable SNC2</b> for production and benchmarking on this "
        f"server. To go beyond {APPROX}5.1 TFLOPS (e.g. the 6.5 TFLOPS aspiration = 88 % "
        f"efficiency), the netlib binary is the limiter: Intel's pre-tuned "
        f"<i>Distribution for LINPACK</i> binary (oneMKL Benchmarks suite) typically "
        f"delivers 80 - 90 % on Granite Rapids. Its download is blocked from the lab "
        f"network (Intel CDN 403); fetch <i>l_onemklbench</i> offline and re-run with "
        f"SNC2 on for an expected 5.9 - 6.6 TFLOPS.",
        BODY))

    story.append(Paragraph("5.4 Customer-facing wording", H2))
    qs = ParagraphStyle("Q", parent=BODY, fontName="Helvetica-Oblique", leftIndent=8,
                        rightIndent=8, borderPadding=6, backColor=GREY_BG, textColor=NAVY_DK, leading=12)
    story.append(Paragraph(
        f"{LDQUO}On the Tyrone MDI300 dual-Xeon 6730P server at 172.16.11.41 populated with "
        f"12 Samsung 96 GB DDR5-6400 RDIMMs (1.15 TB total), a 3-hour validation campaign "
        f"comprising a 2-hour stress-ng pattern-verify pass and a 30-minute <b>96 %-RAM-"
        f"resident memtester burn (1.09 TB locked)</b> recorded <b>zero ECC errors and zero "
        f"machine-check events</b>. Modules run at their full rated 6400 MT/s and the CPU "
        f"reaches the rated 3.8 GHz max turbo under load. Sustained STREAM bandwidth was "
        f"417 GB/s aggregate. All 12 DIMMs across the 16 memory controllers reported clean. "
        f"The modules are validated for production service.{RDQUO}", qs))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"<i>Generated for Netweb Technologies India Ltd {EM} internal engineering. "
        f"Measurements on 172.16.11.41 (Tyrone MDI300), 09 June 2026 (05:17 - 08:04 UTC); "
        f"raw command outputs and tool versions on file with engineering.</i>", BODY_SM))

    doc.build(story)
    print(f"OK -> {OUT_PDF}")
    print(f"size = {os.path.getsize(OUT_PDF):,} bytes")


if __name__ == "__main__":
    build()
