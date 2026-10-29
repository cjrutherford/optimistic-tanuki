#!/usr/bin/env python3
"""Owned disposable PostgreSQL for R2 session schema and exact idle-boundary proof."""
import argparse,json,os,secrets,subprocess,time,signal
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--generate',action='store_true');p.add_argument('--run',action='store_true');p.add_argument('--logs',action='store_true');a=p.parse_args()
if not (a.generate or a.run or a.logs):p.error('--generate or --run required')
repo=Path(__file__).resolve().parent.parent;os.chdir(repo)
root=repo/'.runtime-artifacts/retention/r2'/('pg-'+secrets.token_hex(5));root.mkdir(mode=0o700)
name='ot-r2-'+secrets.token_hex(5);label='r2-session-private';password=secrets.token_hex(32)
env=dict(os.environ,PATH='/home/cjrutherford/.nvm/versions/node/v24.21.0/bin:/home/cjrutherford/.local/share/pnpm:'+os.environ.get('PATH',''),NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true')
started=False
result={'passed':False}
def capture(args):
 try:return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=20).strip()
 except (subprocess.TimeoutExpired,subprocess.CalledProcessError):raise RuntimeError('private infrastructure command failed or exceeded deadline') from None
def run(tag,args,deadline=120):
 print('phase='+tag,flush=True)
 with (root/(tag+'.log')).open('w') as log:
  child=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=child.wait(timeout=deadline)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGTERM);child.wait(timeout=5);raise RuntimeError(tag+' deadline')
 if code:raise RuntimeError(tag+' failed; inspect private artifact')
try:
 capture(['docker','run','--pull=never','-d','--name',name,'--label','ot.private-fixture='+label,'-e','POSTGRES_USER=d00','-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_DB=r2_authentication','-p','127.0.0.1::5432','postgres:16-alpine']);started=True
 port=json.loads(capture(['docker','inspect','--format','{{json .NetworkSettings.Ports}}',name]))['5432/tcp'][0]['HostPort']
 deadline=time.monotonic()+30
 while time.monotonic()<deadline:
  if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','d00','-d','r2_authentication'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.1)
 else:raise RuntimeError('private PostgreSQL not ready')
 env.update(POSTGRES_HOST='127.0.0.1',POSTGRES_PORT=port,POSTGRES_USER='d00',POSTGRES_PASSWORD=password,POSTGRES_DB='r2_authentication',R2_PRIVATE_FIXTURE='r2-session-private',R2_RESULT_PATH=str(root/'result.json'))
 run('migrate-up',['pnpm','nx','run','authentication:typeorm:migration:run'])
 if a.generate:
  before=set((repo/'apps/authentication/migrations').glob('*.ts'))
  run('generate',['pnpm','nx','run','authentication:typeorm:migration:generate','--name=RollingSessionActivity'])
  files=set((repo/'apps/authentication/migrations').glob('*.ts'))-before
  assert len(files)==1;generated=next(iter(files));result['generated']=str(generated.relative_to(repo))
  text=generated.read_text();assert text.count('await queryRunner.query')==2 and 'ADD "lastActivityAt" TIMESTAMP WITH TIME ZONE' in text and 'DROP COLUMN "lastActivityAt"' in text
  result['review']='one nullable column, no backfill/default; old sessions are not revived'
 if a.run:
  run('migration-down',['pnpm','nx','run','authentication:typeorm:migration:revert'])
  run('migration-reapply',['pnpm','nx','run','authentication:typeorm:migration:run'])
  run('session-postgres',['pnpm','nx','test','authentication','--runInBand','--testFile=session-activity.postgres.spec.ts'])
 if a.logs:
  for owner in ['profile','assets','social','forum']:
   database='r2_'+owner;capture(['docker','exec',name,'createdb','-U','d00',database]);env['POSTGRES_DB']=database
   run('migrate-'+owner,['pnpm','nx','run',owner+':typeorm:migration:run'])
  env['POSTGRES_DB']='r2_authentication'
  run('activity-log-postgres',['pnpm','nx','test','authentication','--runInBand','--testFile=activity-log-retention.postgres.spec.ts'])
 result['passed']=True
finally:
 if started:
  assert capture(['docker','inspect','--format','{{index .Config.Labels "ot.private-fixture"}}',name])==label
  capture(['docker','rm','-f','-v',name]);result['ownContainerRemoved']=True
 (root/'harness.json').write_text(json.dumps(result,indent=2)+'\n');print('artifacts='+str(root.relative_to(repo)),flush=True)
