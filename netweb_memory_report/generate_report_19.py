"""
Netweb Memory Validation Report — server 172.16.13.19  (TWO campaigns)
Intel Xeon 6730P (Granite Rapids) / Tyrone MDI300

Campaign A: 8 x Samsung 256 GB DDR5-6400 RDIMM (M321RBJA0M22-CLPIL) = 2 TB  (08:25-09:50 UTC)
Campaign B: 8 x Samsung 128 GB DDR5-6400 RDIMM (M321RAJA0MB2-CCPWF) = 1 TB  (10:13-10:58 UTC)

Memory: PASS in both (0 ECC errors, all layers detect 8 DIMMs, full 6400 MT/s).
Platform: CPU locked at 500 MHz (firmware-level) in BOTH campaigns -> persists across the
          memory swap, confirming it is independent of the DIMMs. FLAGGED.
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

OUT_PDF  = r"C:\Users\asus\Desktop\Netweb_Server19_Memory_Validation_Report.pdf"

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
CODE = ParagraphStyle("Code", parent=BODY, fontName="Courier", fontSize=7.6,
                      leading=9.3, backColor=colors.HexColor("#F4F4F4"), borderPadding=4)
COVER_TITLE = ParagraphStyle("CoverTitle", parent=styles["Title"], textColor=NAVY,
                             fontName="Helvetica-Bold", fontSize=25, leading=29,
                             alignment=TA_CENTER, spaceAfter=4)
COVER_SUB   = ParagraphStyle("CoverSub", parent=styles["Heading2"], textColor=RED,
                             fontName="Helvetica-Bold", fontSize=14, leading=18,
                             alignment=TA_CENTER, spaceAfter=16)
COVER_TEXT  = ParagraphStyle("CoverText", parent=styles["BodyText"], textColor=TEXT_DK,
                             fontName="Helvetica", fontSize=11, leading=15,
                             alignment=TA_CENTER, spaceAfter=4)

PAGE_W, PAGE_H = A4
MARGIN_L = MARGIN_R = 14 * mm
MARGIN_T = 26 * mm
MARGIN_B = 18 * mm

EM = "—"; ARROW = "→"; LDQUO = "“"; RDQUO = "”"
TIMES = "×"; GE = "≥"; APPROX = "≈"; BULLET = "•"; OK = "✓"; WARN = "!"


def draw_header(canv, doc):
    canv.saveState()
    canv.setFillColor(NAVY); canv.rect(0, PAGE_H-16*mm, PAGE_W, 16*mm, fill=1, stroke=0)
    canv.setFillColor(RED);  canv.rect(0, PAGE_H-17.4*mm, PAGE_W, 1.4*mm, fill=1, stroke=0)
    canv.setFillColor(colors.white); canv.setFont("Helvetica-Bold", 10.5)
    canv.drawString(MARGIN_L, PAGE_H-10*mm, "NETWEB TECHNOLOGIES INDIA LTD")
    canv.setFont("Helvetica-Oblique", 7.5); canv.setFillColor(colors.HexColor("#C9D6E6"))
    canv.drawString(MARGIN_L, PAGE_H-13.5*mm, "Empowering Compute, Network and Storage")
    canv.setFillColor(colors.white); canv.setFont("Helvetica", 8.5)
    canv.drawRightString(PAGE_W-MARGIN_R, PAGE_H-10*mm, "Server 172.16.13.19 — Memory Validation")
    canv.setFillColor(NAVY); canv.rect(0, 0, PAGE_W, 10*mm, fill=1, stroke=0)
    canv.setFillColor(colors.white); canv.setFont("Helvetica", 7.5)
    canv.drawString(MARGIN_L, 5*mm, f"Confidential {EM} Internal Engineering")
    canv.drawCentredString(PAGE_W/2, 5*mm, f"Page {doc.page}")
    canv.drawRightString(PAGE_W-MARGIN_R, 5*mm, "28 May 2026")
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
                             gridspec_kw={"width_ratios":[1.2, 1.2, 1.5]})
    # 1) Phase-2 residency per campaign
    ax = axes[0]
    bars = ax.bar(["A\n2 TB\n(256GB)", "B\n1 TB\n(128GB)"], [1920, 960],
                  color=[mc(BLUE_B), mc(GREEN_OK)], edgecolor="#222", linewidth=0.6)
    ax.set_ylim(0, 2050); ax.set_ylabel("GB locked", fontsize=8.5)
    ax.set_title("Phase 2 residency", fontsize=10, color=mc(NAVY))
    for b, r, p in zip(bars, [1920, 960], [95.6, 95.9]):
        ax.text(b.get_x()+b.get_width()/2, r+30, f"{p:.1f}%", ha="center",
                fontsize=9, fontweight="bold", color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=8); ax.grid(axis="y", ls=":", lw=0.4, alpha=0.5)
    # 2) CPU freq lock (same both campaigns)
    ax = axes[1]
    bars = ax.bar(["Delivered\n(both)", "Base", "Max turbo"], [500, 2500, 3800],
                  color=[mc(RED), mc(BLUE_B), mc(BLUE_B)], edgecolor="#222", linewidth=0.6)
    ax.set_ylabel("MHz", fontsize=8.5); ax.set_ylim(0, 4200)
    ax.set_title("CPU freq LOCKED (both campaigns)", fontsize=9.5, color=mc(RED))
    for b, v in zip(bars, [500, 2500, 3800]):
        ax.text(b.get_x()+b.get_width()/2, v+80, f"{v}", ha="center",
                fontsize=9, fontweight="bold", color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=8); ax.grid(axis="y", ls=":", lw=0.4, alpha=0.5)
    # 3) EDAC 16 controllers
    ax = axes[2]
    ax.bar([f"mc{i}" for i in range(16)], [1]*16, color=mc(GREEN_OK), edgecolor="#222", linewidth=0.4)
    ax.set_ylim(0, 1.3); ax.set_yticks([0, 1]); ax.set_yticklabels(["0", "PASS"], fontsize=8.5)
    ax.set_title("Per-controller EDAC (16 mc) — both campaigns 0/0", fontsize=9.5, color=mc(NAVY))
    ax.tick_params(axis="x", labelsize=6, rotation=90)
    plt.tight_layout()
    return chart_to_image(fig, width_mm=182, height_mm=60)


def make_bw_chart():
    fig, ax = plt.subplots(figsize=(11.5, 2.9))
    metrics = ["MBW 1-thr\nlocal", "MBW 1-thr\nremote", "sysbench\n1M write", "STREAM\naggregate"]
    camp_a = [2.31, 1.40, 2.42, 23.4]
    camp_b = [2.30, 1.38, 3.49, 23.0]
    expected = [22, 14, 18, 320]
    x = np.arange(len(metrics)); w = 0.27
    ax.bar(x-w, camp_a, w, label="Campaign A 256GB @500MHz", color=mc(RED), edgecolor="#222", linewidth=0.4)
    ax.bar(x,   camp_b, w, label="Campaign B 128GB @500MHz", color=mc(ORANGE), edgecolor="#222", linewidth=0.4)
    ax.bar(x+w, expected, w, label="Expected @3.8GHz (healthy)", color=mc(GREEN_OK), edgecolor="#222", linewidth=0.4)
    ax.set_xticks(x); ax.set_xticklabels(metrics, fontsize=8.5)
    ax.set_ylabel("GB/s", fontsize=9); ax.set_yscale("log")
    ax.set_title("Bandwidth: both campaigns throttled identically @500MHz vs expected healthy (~10× gap)",
                 fontsize=9.5, color=mc(NAVY))
    ax.legend(fontsize=7, loc="upper left")
    ax.grid(axis="y", ls=":", lw=0.4, alpha=0.5)
    plt.tight_layout()
    return chart_to_image(fig, width_mm=182, height_mm=58)


def make_dimm_map():
    """Intel Xeon 6730P: 32 DIMM slots = 2 sockets x 8 channels (A-H) x 2 slots/channel.
    Populated: channels A, B, E, F slot 1 on each socket (8 DIMMs, 1 DPC on 4-of-8 ch)."""
    fig, ax = plt.subplots(figsize=(11.0, 2.6))
    ax.set_xlim(0, 40); ax.set_ylim(0, 5.8); ax.axis("off")
    chans = ["A", "B", "C", "D", "E", "F", "G", "H"]
    populated_ch = ["A", "B", "E", "F"]   # slot 1 only
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
            "8 populated = channels A,B,E,F slot 1, both sockets (1 DPC on 4-of-8 ch)  "
            f"{BULLET}  green = 256 GB (A) / 128 GB (B)",
            ha="center", fontsize=6.8, color="#555", fontstyle="italic")
    plt.tight_layout()
    return chart_to_image(fig, width_mm=182, height_mm=48)


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
                          title="Netweb Server 172.16.13.19 Memory Validation (256GB + 128GB)",
                          author="Netweb Technologies India Ltd")
    frame = Frame(MARGIN_L, MARGIN_B, PAGE_W-MARGIN_L-MARGIN_R, PAGE_H-MARGIN_T-MARGIN_B, id="m")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=draw_cover),
        PageTemplate(id="body", frames=[frame], onPage=draw_header),
    ])
    story = []

    # COVER
    story.append(Spacer(1, 46*mm))
    story.append(Paragraph("DDR5 Memory Validation", COVER_TITLE))
    story.append(Paragraph("Server 172.16.13.19  —  Two Campaigns (256 GB + 128 GB)", COVER_SUB))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(f"Campaign A: 8 {TIMES} Samsung 256 GB DDR5-6400 (2 TB)", COVER_TEXT))
    story.append(Paragraph(f"Campaign B: 8 {TIMES} Samsung 128 GB DDR5-6400 (1 TB)", COVER_TEXT))
    story.append(Paragraph("On Tyrone MDI300 (dual Intel Xeon 6730P)", COVER_TEXT))
    story.append(Spacer(1, 10*mm))
    cover = Table([
        ["Prepared for:",  f"Shailendra {EM} Netweb Technologies India Ltd"],
        ["Date issued:",   "28 May 2026"],
        ["Test platform:", f"172.16.13.19 {EM} same server, two memory configurations"],
        ["Test windows:",  f"Campaign A 08:25-09:50 UTC  {BULLET}  Campaign B 10:13-10:58 UTC"],
        ["Memory status:", f"PASS (both) {EM} 0 ECC errors, all 8 DIMMs detected, full 6400 MT/s"],
        ["Platform status:", f"ACTION NEEDED {EM} CPU locked at 500 MHz in BOTH campaigns (firmware)"],
    ], colWidths=[34*mm, 140*mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,-1), GREY_BG),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9.5),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#AAAAAA")),
        ("TEXTCOLOR", (1,4), (1,4), GREEN_OK), ("FONTNAME", (1,4), (1,4), "Helvetica-Bold"),
        ("TEXTCOLOR", (1,5), (1,5), RED), ("FONTNAME", (1,5), (1,5), "Helvetica-Bold"),
    ]))
    story.append(cover)
    story.append(NextPageTemplate("body")); story.append(PageBreak())

    # 1. EXEC SUMMARY
    story.append(Paragraph("1. Executive Summary", H1))
    story.append(Paragraph(
        f"Two memory configurations were validated back-to-back on the same server "
        f"172.16.13.19 (Tyrone MDI300, dual Intel Xeon 6730P "
        f"“Granite Rapids”). <b>Campaign A</b>: 8 {TIMES} Samsung 256 GB DDR5-6400 (2 TB). "
        f"<b>Campaign B</b>: 8 {TIMES} Samsung 128 GB DDR5-6400 (1 TB), after a physical swap. "
        f"<b>The memory passes in both campaigns</b> {EM} all 8 modules detected by BMC, "
        f"BIOS and kernel, full rated 6400 MT/s, zero ECC errors. The same "
        f"<b>platform fault persists in both</b>: every CPU core is locked at 500 MHz, "
        f"which survived the reboot and DIMM swap {EM} confirming it is independent of the "
        f"memory and must be fixed before this server is benchmarked or deployed.",
        BODY))
    story.append(Spacer(1, 2*mm))
    ex = [
        ["Metric", "Campaign A (256GB/2TB)", "Campaign B (128GB/1TB)", "Verdict"],
        ["Module P/N", "M321RBJA0M22-CLPIL", "M321RAJA0MB2-CCPWF", f"{OK} Samsung"],
        ["DIMM detect (BMC/BIOS/kernel)", "8 / 8 / 8", "8 / 8 / 8", f"{OK} PASS"],
        ["Configured speed", "6400 MT/s (full)", "6400 MT/s (full)", f"{OK} PASS"],
        ["30-min stress-ng verify", "0 errors", "0 errors", f"{OK} PASS"],
        ["15-min memtester locked", "1920 GB (95.6%)", "960 GB (95.9%)", f"{OK} PASS"],
        ["FAILURE/error in 64 logs", "0", "0", f"{OK} PASS"],
        ["EDAC CE/UE (16 mc)", "0 / 0", "0 / 0", f"{OK} PASS"],
        ["MCE events", "0", "0", f"{OK} PASS"],
        ["CPU core freq (under load)", "500 MHz", "500 MHz", f"{WARN} FAIL"],
        ["1-thread memcpy (consequence)", "2.31 GB/s", "2.30 GB/s", f"{WARN} blocked"],
    ]
    story.append(std_table(ex, col_widths=[46*mm, 46*mm, 46*mm, 26*mm], body_fontsize=8.0))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"<b>Bottom line:</b> both DIMM sets are healthy and fully validated. The CPU "
        f"frequency lock is reproduced identically in both campaigns {EM} strong evidence "
        f"it is a platform firmware issue, not a memory or workload effect. Bandwidth "
        f"figures are throttled {APPROX}10{TIMES} and are not representative until the lock is "
        f"cleared (see {BULLET} 4 and {BULLET} 5.2).",
        BODY))
    story.append(PageBreak())

    # 2. ENVIRONMENT + DETECTION
    story.append(Paragraph("2. Test Environment & Detection", H1))
    env = [
        ["Attribute", "Value (same server, both campaigns)"],
        ["Server model", "Tyrone MDI300 (dual-socket Xeon 6 server) at 172.16.13.19"],
        ["BIOS / BMC", f"AMI ES418INW.M06 (16 Apr 2026) {BULLET} BMC firmware 1.11"],
        ["CPU", f"2 {TIMES} Intel Xeon 6730P “Granite Rapids” (32C/64T each = 64C/128T)"],
        ["CPU freq (rated)", "Base 2500 MHz, max turbo 3800 MHz (AVX-512 + AMX, L3 576 MiB)"],
        ["OS / kernel", "Ubuntu 22.04.4 LTS / Linux 6.8.0-111-generic"],
        ["EDAC", "16 memory controllers (mc0-mc15), multi-bit ECC active"],
        ["Slot population", "8 of 32 slots: P0/P1 channels A, B, E, F (both campaigns)"],
    ]
    story.append(std_table(env, col_widths=[34*mm, 148*mm], body_fontsize=8.3))

    story.append(Paragraph("2.1 Module configurations", H2))
    mod = [
        ["Attribute", "Campaign A", "Campaign B"],
        ["Module P/N", "Samsung M321RBJA0M22-CLPIL", "Samsung M321RAJA0MB2-CCPWF"],
        ["Capacity / total", f"256 GB {TIMES} 8 = 2 TB (2015 GiB)", f"128 GB {TIMES} 8 = 1 TB (1007 GiB)"],
        ["Rated / configured", "6400 / 6400 MT/s", "6400 / 6400 MT/s"],
        ["Rank", "Dual-rank", "Dual-rank"],
        ["ECC", "Multi-bit ECC active", "Multi-bit ECC active"],
    ]
    story.append(std_table(mod, col_widths=[34*mm, 74*mm, 74*mm], body_fontsize=8.2))

    story.append(Paragraph("2.2 DIMM population map (8-channel Granite Rapids, both campaigns)", H2))
    story.append(make_dimm_map())

    story.append(Paragraph("2.3 Detection chain — BMC + BIOS + kernel agree on 8 DIMMs (both campaigns)", H2))
    story.append(Paragraph(
        "$ ipmitool sdr | grep -i DIM   (Campaign B snapshot; Campaign A identical slots)<br/>"
        "P0_DIM_A0 | 29 C | ok&nbsp;&nbsp;P0_DIM_B0 | 28 C | ok&nbsp;&nbsp;P0_DIM_E0 | 31 C | ok&nbsp;&nbsp;P0_DIM_F0 | 32 C | ok<br/>"
        "P1_DIM_A0 | 31 C | ok&nbsp;&nbsp;P1_DIM_B0 | 32 C | ok&nbsp;&nbsp;P1_DIM_E0 | 29 C | ok&nbsp;&nbsp;P1_DIM_F0 | 28 C | ok<br/>"
        "(remaining 24 slots: 'no reading | ns' = empty) — BMC sees exactly 8 populated DIMMs",
        CODE))
    story.append(Paragraph(
        f"BIOS DMI Type 17 lists 8 populated DIMM records in each campaign (correct P/N, "
        f"256/128 GB, 6400 MT/s). Kernel /proc/meminfo reports {APPROX}2 TiB (A) / "
        f"{APPROX}1 TiB (B); EDAC enumerates all 16 controllers. No detection discrepancy "
        f"at any layer in either campaign.", BODY_SM))
    story.append(PageBreak())

    # 3. STABILITY
    story.append(Paragraph("3. Memory Stability Results — Both Campaigns", H1))
    story.append(make_combo_chart())
    story.append(Spacer(1, 2*mm))
    stab = [
        ["Parameter", "Campaign A — 256 GB / 2 TB", "Campaign B — 128 GB / 1 TB"],
        ["Phase 1 (30-min stress-ng)", "08:25:18 → 08:55:24", "10:13:33 → 10:43:38"],
        ["Phase 1 working set", f"64 {TIMES} 24 GB = 1536 GB", f"64 {TIMES} 12 GB = 768 GB"],
        ["Phase 1 result", "0 errors; EDAC 0/0", "0 errors; EDAC 0/0"],
        ["Phase 2 (15-min memtester)", "09:30:14 → 09:45:14", "10:43:51 → 10:58:51"],
        ["Phase 2 locked", f"64 {TIMES} 30 GB = 1920 GB (95.6%)", f"64 {TIMES} 15 GB = 960 GB (95.9%)"],
        ["Phase 2 mlock()", "succeeded on all 64", "succeeded on all 64"],
        ["Phase 2 FAILURE/error", "0 across 64 logs", "0 across 64 logs"],
        ["EDAC delta (16 mc)", "0 CE / 0 UE", "0 CE / 0 UE"],
        ["MCE events", "0", "0"],
    ]
    story.append(std_table(stab, col_widths=[40*mm, 71*mm, 71*mm], body_fontsize=8.0))
    story.append(Paragraph(
        f"<b>Memory verdict: PASS in both campaigns.</b> Zero ECC errors on all 16 "
        f"controllers, zero memtester failures across 64 logs, mlock pinning {GE} 95 % of "
        f"RAM for the full 15-minute window each time. Both the 256 GB and 128 GB Samsung "
        f"DDR5-6400 module sets are electrically sound and correctly trained at full rated "
        f"speed. (Per-pass throughput is low only because of the CPU lock in {BULLET} 4.)",
        BODY))
    story.append(PageBreak())

    # 4. CPU THROTTLE
    story.append(Paragraph("4. Platform Finding — CPU Locked at 500 MHz (both campaigns)", H1))
    story.append(Paragraph(
        f"In both campaigns, every CPU core is pinned at <b>500 MHz</b> {EM} one-fifth of "
        f"the 2500 MHz base and one-seventh of 3800 MHz max turbo. The lock <b>persisted "
        f"across the reboot and physical memory swap</b> between campaigns, proving it is "
        f"a platform condition independent of the DIMMs. It is a firmware-level fault, not "
        f"an OS or thermal condition.",
        BODY))
    ev = [
        ["Check", "Observation (identical both campaigns)", "Implication"],
        ["turbostat Bzy_MHz (all-core load)", "500 MHz on all 64 cores", "Real delivered freq is 500 MHz"],
        ["Governor / EPP / turbo", "performance / performance / no_turbo=0 / max=100%", "No OS-side restriction"],
        ["HWP_REQUEST (0x774) & PERF_CTL (0x199)", "ratio 0x26 (3800 MHz); wrmsr force ignored", "OS requests 3.8 GHz; ignored"],
        ["HWP_CAPABILITIES (0x771)", "highest = 38 (3800 MHz)", "Silicon claims 3.8 GHz capable"],
        ["CoreTmp / PkgTmp / CoreThr", "29-35 °C / 38 °C / 0", "Not thermal throttling"],
        ["RAPL pkg power vs limit", "88-139 W vs 250 W cap", "Not power-capped"],
        ["CORE_PERF_LIMIT_REASONS (0x64F)", "0", "Core reports no perf-limit reason"],
        ["dmesg", "intel_uncore_frequency_tpmi: Unsupported minor version", "Kernel 6.8 PM support incomplete for this silicon"],
    ]
    story.append(std_table(ev, col_widths=[54*mm, 70*mm, 58*mm], body_fontsize=7.9))
    story.append(Paragraph(
        f"<b>Conclusion.</b> The OS requests 3.8 GHz through every mechanism and the silicon "
        f"reports it is capable, with no thermal or power limit active {EM} yet cores deliver "
        f"500 MHz, identically in both campaigns. This is a <b>BIOS power-profile / config-TDP "
        f"setting or early-Granite-Rapids pcode/microcode immaturity</b>, not resolvable "
        f"from the OS and unrelated to the (healthy) memory.",
        BODY))
    story.append(PageBreak())

    # 5. BANDWIDTH + RECOMMENDATIONS
    story.append(Paragraph("5. Bandwidth Impact & Recommendations", H1))
    story.append(Paragraph("5.1 Bandwidth under throttle — both campaigns (NOT representative)", H2))
    story.append(make_bw_chart())
    bw = [
        ["Test", "Campaign A @500MHz", "Campaign B @500MHz", "Expected @3.8GHz"],
        ["MBW memcpy 1-thr local", "2.31 GB/s", "2.30 GB/s", "20 - 24 GB/s"],
        ["MBW memcpy 1-thr remote", "1.40 GB/s", "1.38 GB/s", "12 - 15 GB/s"],
        ["sysbench 1M rnd write 64thr", "2.42 GB/s", "3.49 GB/s", "15 - 20 GB/s"],
        ["STREAM aggregate", f"{APPROX} 23 GB/s", f"{APPROX} 23 GB/s", "300 - 340 GB/s"],
    ]
    story.append(std_table(bw, col_widths=[52*mm, 44*mm, 44*mm, 42*mm], body_fontsize=8.1))
    story.append(Paragraph(
        f"<i>Both campaigns produce nearly identical throttled bandwidth {EM} further proof "
        f"the bottleneck is the 500 MHz CPU lock, not the DIMMs. Recorded for completeness "
        f"only; re-measure after the lock is cleared.</i>", BODY_SM))

    story.append(Paragraph("5.2 Recommendations", H2))
    story.append(Paragraph(
        f"{BULLET} <b>Memory: cleared for use.</b> Both the 256 GB and 128 GB Samsung "
        f"DDR5-6400 sets pass all correctness and detection checks. No DIMM action required.<br/>"
        f"{BULLET} <b>Resolve the 500 MHz CPU lock before benchmarking / deployment</b> "
        f"(in order of likelihood):<br/>"
        f"&nbsp;&nbsp;(a) <b>BIOS power profile</b> {EM} check Setup {ARROW} Advanced {ARROW} "
        f"Power/Performance for a Max-Efficiency / fixed-low-ratio / config-TDP-low setting; "
        f"set to Performance / max TDP.<br/>"
        f"&nbsp;&nbsp;(b) <b>Update BIOS + CPU microcode</b> {EM} Granite Rapids is new silicon; "
        f"the Apr-2026 BIOS may predate a pcode fix. Apply the latest Tyrone MDI300 BIOS + Intel "
        f"microcode.<br/>"
        f"&nbsp;&nbsp;(c) <b>Check VR / power-delivery telemetry</b> {EM} a VR fault can make the "
        f"PUNIT self-limit to minimum frequency.<br/>"
        f"&nbsp;&nbsp;(d) <b>Newer kernel</b> (6.11+/HWE) {EM} the “Unsupported minor version” "
        f"uncore message indicates 6.8 lacks full PM support for this platform.<br/>"
        f"{BULLET} <b>Re-run the bandwidth suite</b> once cores reach rated frequency {EM} "
        f"expect {APPROX} 300+ GB/s aggregate STREAM for this 4-of-8-channel DDR5-6400 layout.",
        BODY))
    story.append(Paragraph("5.3 Customer-facing wording", H2))
    qs = ParagraphStyle("Q", parent=BODY, fontName="Helvetica-Oblique", leftIndent=8,
                        rightIndent=8, borderPadding=6, backColor=GREY_BG, textColor=NAVY_DK, leading=12)
    story.append(Paragraph(
        f"{LDQUO}On server 172.16.13.19 (Tyrone MDI300, dual Intel Xeon 6730P), Netweb "
        f"engineering validated two memory configurations back-to-back {EM} 8 {TIMES} 256 GB "
        f"DDR5-6400 (2 TB) and 8 {TIMES} 128 GB DDR5-6400 (1 TB). Both passed full memory "
        f"validation: detected by BMC, BIOS and kernel, trained at full 6400 MT/s, with zero "
        f"ECC errors across a 30-minute pattern-verify pass and a 15-minute "
        f"{GE}95 %-RAM-resident burn each. Testing also identified a platform firmware issue "
        f"locking all CPU cores at 500 MHz in both campaigns (vs 3.8 GHz rated); this is "
        f"unrelated to the memory but must be resolved before performance benchmarking.{RDQUO}",
        qs))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        f"<i>Generated for Netweb Technologies India Ltd {EM} internal engineering. "
        f"Measurements on 172.16.13.19, 28 May 2026 (Campaign A 08:25-09:50, Campaign B "
        f"10:13-10:58 UTC); raw outputs and MSR dumps on file with engineering.</i>", BODY_SM))

    doc.build(story)
    print(f"OK -> {OUT_PDF}")
    print(f"size = {os.path.getsize(OUT_PDF):,} bytes")


if __name__ == "__main__":
    build()
