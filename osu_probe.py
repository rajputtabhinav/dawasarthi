import paramiko
USER, PASS = "user", "netweb"
TARGETS = ["172.16.11.218", "172.16.14.8"]
PROBE = r"""
echo "## mpicc / ompi"
mpicc --version 2>&1 | head -1
ompi_info --param btl all --level 9 2>/dev/null | head -5 || true
echo "## ucx_info"
command -v ucx_info >/dev/null && ucx_info -v 2>&1 | head -3 || echo "  ucx_info missing"
echo "## existing OSU?"
ls ~/osu/libexec/osu-micro-benchmarks/mpi/pt2pt 2>/dev/null | head -5 || \
ls ~/osu-micro-benchmarks*/c/mpi/pt2pt 2>/dev/null | head -5 || \
find / -name 'osu_bw*' -type f 2>/dev/null | head -5 || \
echo "  not built yet"
echo "## passwordless ssh test (user@10.10.10.x)"
for ip in 10.10.10.1 10.10.10.2; do
  ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no user@$ip 'echo OK_$(hostname)' 2>&1 | head -1
done
echo "## build deps"
for b in gcc make wget tar; do command -v $b >/dev/null && echo "  $b OK" || echo "  $b MISSING"; done
"""
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
for h in TARGETS:
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    print(f"\n{'='*60}\n# {h}\n{'='*60}")
    _, o, _ = c.exec_command(PROBE, timeout=20)
    print(o.read().decode(errors='replace'))
    c.close()
