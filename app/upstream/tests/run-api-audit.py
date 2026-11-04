"""Own local compiled worker only. No production calls or external side effects."""
import os, subprocess, time, urllib.request, urllib.error, pathlib, sys, uuid, re, json
root=pathlib.Path(__file__).resolve().parents[1]
logs=pathlib.Path(os.environ.get('MESH_AUDIT_OUTPUT','/workspace/scratch/b8715f176960/cue-audit'))
logs.mkdir(parents=True,exist_ok=True)
base='http://127.0.0.1:8787'
env={**os.environ,'MESH_TEST_BASE':base,'SITES_RUNTIME_ROOT':str(logs/'isolated-runtime'),'WRANGLER_REGISTRY_PATH':str(logs/'isolated-runtime'/'dev-registry'),'MINIFLARE_REGISTRY_PATH':str(logs/'isolated-runtime'/'registry')}
with (logs/'api-worker-controlled.log').open('w') as log:
 worker=subprocess.Popen(['node','tests/local-worker.mjs'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  ready=False
  for i in range(45):
   try:
    # Auth rejection can happen before the isolated D1 migration is ready.
    # Require our own child startup marker and a successful actual state read.
    if 'Own isolated API test worker ready' not in (logs/'api-worker-controlled.log').read_text():
     if worker.poll() is not None: raise RuntimeError('Own test worker exited before readiness')
     time.sleep(.4);continue
    readiness=urllib.request.Request(base+'/api/state',headers={'oai-authenticated-user-id':'api-ready-'+str(uuid.uuid4()),'oai-authenticated-user-email':'qa@example.invalid','X-Mesh-State-Version':'4'})
    with urllib.request.urlopen(readiness,timeout=1) as response: ready=response.status==200
   except urllib.error.HTTPError: pass
   except Exception: pass
   if ready: break
   if worker.poll() is not None: raise RuntimeError('Own test worker exited before readiness')
   time.sleep(.4)
  if not ready: raise RuntimeError('Own local worker unavailable; HTTP tests not run')
  # Direct compiled worker avoids the development hot-reload proxy. Never retry mutations.
  failed=[]
  for suite in os.environ.get('MESH_TEST_SUITES','local-api.py,tuning-api.py,foundation-api.py,intelligence-api.py,spatial-academy-api.py,collaboration-api.py,ar-spatial-api.py,bounded-load.py').split(','):
   if suite not in ['local-api.py','tuning-api.py','foundation-api.py','intelligence-api.py','spatial-academy-api.py','collaboration-api.py','ar-spatial-api.py','bounded-load.py']: raise ValueError('Unknown local suite')
   file=root/'tests'/suite
   if not file.exists(): raise RuntimeError('Required local suite is missing: '+suite)
   with (logs/(file.stem+'.log')).open('w') as output:
    result=subprocess.run([sys.executable,'-u',str(file)],cwd=root,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=50)
   # Exit 0 alone must never certify a truncated or empty check log.
   output_text=(logs/(file.stem+'.log')).read_text()
   passed_lines=sum(line.startswith('PASS ') for line in output_text.splitlines())
   completion=False
   for line in output_text.splitlines():
    try:
     summary=json.loads(line)
     if isinstance(summary,dict) and summary.get('passed')==passed_lines and passed_lines>0: completion=True
    except ValueError: pass
    match=re.fullmatch(r'(\d+) (?:tuning |foundation API )?checks passed;.*',line)
    if match and int(match.group(1))==passed_lines and passed_lines>0: completion=True
   if suite=='bounded-load.py':
    try:
     summary=json.loads(output_text)
     completion=(summary['readRequests']==128 and summary['readErrorCount']==0
       and summary['sameVersionWriteRace']['accepted']==1
       and summary['sameVersionWriteRace']['conflicts']==7
       and summary['sameVersionWriteRace']['eventSequenceAtomic'] is True)
    except (ValueError,KeyError,TypeError): completion=False
   success=result.returncode==0 and completion
   print(suite,'PASS' if success else 'FAIL (exit or incomplete evidence)',flush=True)
   if not success: failed.append(suite)
  if not failed:
   import json, uuid
   user='recovery-audit-'+str(uuid.uuid4())
   headers={'Content-Type':'application/json','Accept':'application/json','X-Mesh-State-Version':'4','oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@example.invalid'}
   def fetch_state(body=None):
    request=urllib.request.Request(base+'/api/state',data=json.dumps(body).encode() if body else None,headers=headers,method='PUT' if body else 'GET')
    with urllib.request.urlopen(request,timeout=4) as response: return json.load(response)
   initial=fetch_state()
   payload={**{k:v for k,v in initial.items() if k!='updatedAt'},'expectedUpdatedAt':initial['updatedAt']}
   payload['notes'].append({'id':str(uuid.uuid4()),'text':'Own local persisted restart checkpoint','createdAt':'2026-09-30T16:00:00.000Z'})
   saved=fetch_state(payload)
   import signal
   os.killpg(worker.pid,signal.SIGTERM);worker.wait(timeout=4)
   started=time.perf_counter()
   worker=subprocess.Popen(['node','tests/local-worker.mjs'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   restored=None
   for attempt in range(40):
    try:
     restored=fetch_state();break
    except Exception: time.sleep(.2)
   assert restored==saved,'Persistent local state must survive own worker restart exactly'
   result={'scope':'own compiled worker process restart and isolated local D1; no production backup restore','exactStateRetained':True,'eventSequenceRetained':True,'recoveryMs':round((time.perf_counter()-started)*1000,2)}
   (logs/'RESTART_RECOVERY.json').write_text(json.dumps(result,indent=2))
   print('persisted restart recovery PASS',flush=True)
  if failed: raise RuntimeError('Failed suites: '+', '.join(failed))
 finally:
  import signal
  if worker.poll() is None: os.killpg(worker.pid,signal.SIGTERM)
  try: worker.wait(timeout=4)
  except subprocess.TimeoutExpired: os.killpg(worker.pid,signal.SIGKILL)
