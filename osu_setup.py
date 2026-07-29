"""
1. Generate SSH keypair on .14.8 (if missing); copy pubkey to .218 authorized_keys
2. Also bi-directional from .218 -> .14.8 for safety
3. Download OSU MB on both hosts; build with mpicc (parallel)
"""
import paramiko, threading

USER, PASS = "user", "netweb"
HOSTS = {
    "172.16.11.218": "10.10.10.1",
    "172.16.14.8":   "10.10.10.2",
}
OSU_URL = "https://mvapich.cse.ohio-state.edu/download/mvapich/osu-micro-benchmarks-7.4.tar.gz"
OSU_DIR = "osu-micro-benchmarks-7.4"

def conn(h):
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(h, username=USER, password=PASS, timeout=10,
              allow_agent=False, look_for_keys=False); return c
def run(c, cmd, t=300):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors='replace'), e.read().decode(errors='replace')

print("=== step 1: gen SSH keys on both hosts ===")
pubkeys = {}
for h in HOSTS:
    c = conn(h)
    run(c, "[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519 -q", 30)
    o, _ = run(c, "cat ~/.ssh/id_ed25519.pub", 10)
    pubkeys[h] = o.strip()
    print(f"  {h}: {pubkeys[h][:60]}...")
    c.close()

print("\n=== step 2: cross-authorize ===")
for src, src_pub in pubkeys.items():
    for dst in HOSTS:
        if dst == src: continue
        c = conn(dst)
        # idempotent: add only if not already there
        cmd = (f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && "
               f"chmod 600 ~/.ssh/authorized_keys && "
               f"grep -qxF '{src_pub}' ~/.ssh/authorized_keys || "
               f"echo '{src_pub}' >> ~/.ssh/authorized_keys")
        run(c, cmd, 10)
        print(f"  authorized {src} -> {dst}")
        c.close()

print("\n=== step 3: passwordless SSH test ===")
for src, src_ip in HOSTS.items():
    c = conn(src)
    for dst, dst_ip in HOSTS.items():
        if dst == src: continue
        o, _ = run(c, f"ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5 "
                      f"user@{dst_ip} 'echo PASSLESS_OK from $(hostname) to {dst_ip}'", 15)
        print(f"  {src_ip} -> {dst_ip}: {o.strip()}")
    c.close()

print("\n=== step 4: download + build OSU (parallel) ===")
BUILD = f"""
set -e
cd ~
if [ ! -d {OSU_DIR} ]; then
  if [ ! -f {OSU_DIR}.tar.gz ]; then
    wget -q {OSU_URL}
  fi
  tar xf {OSU_DIR}.tar.gz
fi
cd {OSU_DIR}
if [ ! -f c/mpi/pt2pt/standard/osu_bw ]; then
  ./configure CC=mpicc CXX=mpicxx --prefix=$HOME/osu >/tmp/osu_configure.log 2>&1
  make -j$(nproc) > /tmp/osu_make.log 2>&1
  make install > /tmp/osu_install.log 2>&1
fi
echo "BUILD OK"
ls $HOME/osu/libexec/osu-micro-benchmarks/mpi/pt2pt/ 2>/dev/null | head -10
"""

def build_on(host):
    c = conn(host)
    o, e = run(c, BUILD, 600)
    print(f"\n--- build {host} ---")
    print(o)
    if e.strip(): print("STDERR:", e[:400])
    c.close()

ts = [threading.Thread(target=build_on, args=(h,)) for h in HOSTS]
for t in ts: t.start()
for t in ts: t.join()

print("\n=== done ===")
