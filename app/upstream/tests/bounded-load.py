"""Bounded own local worker measurements, never a capacity claim or production stress test."""
import os,json,uuid,urllib.request,urllib.error,time,statistics,concurrent.futures,copy
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
assert urllib.parse.urlparse(BASE).hostname in ['localhost','127.0.0.1']
ID='bounded-load-'+str(uuid.uuid4())
def req(method='GET',body=None):
 r=urllib.request.Request(BASE+'/api/state',headers={'Accept':'application/json','Content-Type':'application/json','X-Mesh-State-Version':'4','oai-authenticated-user-id':ID,'oai-authenticated-user-email':'qa@example.invalid'},data=json.dumps(body).encode() if body is not None else None,method=method)
 start=time.perf_counter()
 try:
  with urllib.request.urlopen(r,timeout=8) as x:code,p=x.status,json.load(x)
 except urllib.error.HTTPError as e:code,p=e.code,json.load(e)
 return code,p,(time.perf_counter()-start)*1000
code,state,_=req();assert code==200
start=time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:req(),range(128)))
duration=time.perf_counter()-start;latencies=sorted(r[2] for r in results);errors=sum(r[0]!=200 for r in results)
assert errors==0
payload={**{k:v for k,v in state.items() if k!='updatedAt'},'expectedUpdatedAt':None}
payloads=[]
for i in range(8):
 b=copy.deepcopy(payload);b['checks']['baseline']=bool(i%2);b['notes']=[{'id':str(uuid.uuid4()),'text':'Bounded CAS race '+str(i),'createdAt':'2026-09-30T13:00:00Z'}];payloads.append(b)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:writes=list(pool.map(lambda body:req('PUT',body),payloads))
assert sum(r[0]==200 for r in writes)==1
assert sum(r[0]==409 for r in writes)==7
code,persisted,_=req();assert code==200 and len(persisted['notes'])==1
assert [e['sequence'] for e in persisted['command']['events']]==list(range(1,len(persisted['command']['events'])+1))
report={'scope':'own local compiled worker with 8 request threads; finite sample, no capacity extrapolation','readRequests':128,'readConcurrency':8,'readDurationSeconds':round(duration,4),'observedRequestsPerMinute':round(128/duration*60,2),'readMedianMs':round(statistics.median(latencies),3),'readP95Ms':round(latencies[int(len(latencies)*.95)-1],3),'readMaxMs':round(max(latencies),3),'readErrorCount':errors,'sameVersionWriteRace':{'requests':8,'accepted':1,'conflicts':7,'storedNotes':1,'eventSequenceAtomic':True}}
out=os.environ.get('MESH_AUDIT_OUTPUT','/workspace/scratch/b8715f176960/cue-audit')
from pathlib import Path
Path(out).mkdir(parents=True,exist_ok=True);Path(out,'BOUNDED_LOAD.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
