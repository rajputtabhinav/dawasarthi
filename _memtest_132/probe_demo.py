import os
import sys
import time

sys.path.insert(0, r"C:\Users\asus\Desktop\CoreBench MCP")
import mcp_server as M

res = M.start_validation_impl([], "acceptance", demo=True)
print("start:", res)
rid = res["run_id"]
rd = os.path.join(M.RUNS_DIR, rid)
status = "starting"
for _ in range(150):
    st = M.get_run_status_impl(rid)
    status = st["status"]
    if status in ("done", "failed"):
        break
    time.sleep(0.5)
print("final status:", status)
print("run dir contents:", os.listdir(rd) if os.path.isdir(rd) else "MISSING")
for name in ("run.log", "log.txt", "stderr.log"):
    p = os.path.join(rd, name)
    if os.path.isfile(p):
        with open(p, "r", encoding="utf-8", errors="replace") as fh:
            lines = fh.readlines()
        print(f"--- {name} (last 25 lines) ---")
        print("".join(lines[-25:]))
# leave run dir for inspection; print path
print("run dir:", rd)
