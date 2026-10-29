#!/usr/bin/env python3
"""Owned test-only ClamAV engine, then the guarded R4 fixture. No host installation."""
import argparse,json,os,secrets,socket,subprocess,time,signal,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--run',action='store_true');args=p.parse_args()
if not args.run:p.error('--run required')
repo=Path(__file__).resolve().parent.parent;os.chdir(repo)
root=repo/'.runtime-artifacts/release-r4'/('scanner-'+secrets.token_hex(6));root.mkdir(mode=0o700)
name='ot-r4-scanner-'+secrets.token_hex(6);label='r4-private-scanner';started=False
# A declared fixture database: actual engine/streaming, not production signature qualification.
eicar=bytes.fromhex('58354f2150254041505b345c505a58353428505e2937434329377d2445494341522d5354414e444152442d414e544956495255532d544553542d46494c452124482b482a')
assert len(eicar)==68
md5=hashlib.md5(eicar).hexdigest()
command="apk add --no-cache clamav-daemon > /tmp/packages.log 2>&1 && mkdir -p /var/lib/clamav && printf '%s\\n' '"+md5+":68:R4-Test-Only-Eicar' > /var/lib/clamav/r4.hdb && printf '%s\\n' 'Foreground yes' 'TCPSocket 3310' 'TCPAddr 0.0.0.0' 'DatabaseDirectory /var/lib/clamav' 'User root' 'SelfCheck 0' 'Bytecode no' > /tmp/r4-clamd.conf && exec clamd --config-file=/tmp/r4-clamd.conf"
def capture(command):
 r=subprocess.run(command,capture_output=True,text=True,timeout=30)
 if r.returncode:raise RuntimeError('private scanner command failed')
 return r.stdout.strip()
try:
 capture(['docker','run','--pull=never','-d','--name',name,'--label','ot.private-fixture='+label,'-p','127.0.0.1::3310','alpine:latest','sh','-c',command]);started=True
 port=int(capture(['docker','port',name,'3310/tcp']).rsplit(':',1)[1])
 deadline=time.monotonic()+180
 while time.monotonic()<deadline:
  try:
   with socket.create_connection(('127.0.0.1',port),timeout=1)as s:
    s.sendall(b'zPING\0');assert s.recv(128)==b'PONG\0'
   break
  except (OSError,AssertionError):
   if capture(['docker','inspect','--format','{{.State.Running}}',name])!='true':raise RuntimeError('private scanner startup failed')
   time.sleep(.5)
 else:raise RuntimeError('private scanner readiness timeout')
 # Actual positive engine control before relying on its clean response.
 with socket.create_connection(('127.0.0.1',port),timeout=3)as s:
  s.sendall(b'zINSTREAM\0'+len(eicar).to_bytes(4,'big')+eicar+b'\0\0\0\0');reply=s.recv(256)
  assert b'FOUND' in reply
 proof={'engine':capture(['docker','exec',name,'clamd','--version']),'testSignatureCount':1,'eicarPositiveControl':True,'productionSignatureQualification':False}
 (root/'scanner.json').write_text(json.dumps(proof,indent=2)+'\n')
 print('scanner ready; test-signature database only',flush=True)
 env=dict(os.environ,R4_CLAMAV_HOST='127.0.0.1',R4_CLAMAV_PORT=str(port))
 with (root/'journeys.log').open('w')as out:
  child=subprocess.Popen(['python3','tools/account-deletion-private-fixture.py','--run','--skip-build','--journeys'],env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=child.wait(timeout=780)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGTERM);child.wait(timeout=10);raise RuntimeError('private R4 fixture deadline')from None
 if code:raise RuntimeError('private R4 journeys failed; inspect '+str(root/'journeys.log'))
 print('R4 fixture passed; scanner evidence='+str(root),flush=True)
finally:
 if started:
  (root/'engine.log').write_text(capture(['docker','logs',name]))
  assert capture(['docker','inspect','--format','{{index .Config.Labels "ot.private-fixture"}}',name])==label
  capture(['docker','rm','-f','-v',name]);(root/'teardown.json').write_text(json.dumps({'ownedScannerRemoved':True})+'\n')
