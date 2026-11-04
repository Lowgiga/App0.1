"""Disposable local HTTP checks. Does not test production identity dispatch."""
import os,json,copy,uuid,datetime,hashlib,urllib.request,urllib.error
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
assert urllib.parse.urlparse(BASE).hostname in ['127.0.0.1','localhost']
ID='intelligence-audit-'+str(uuid.uuid4());passed=[]
def request(path='/api/state',method='GET',body=None,identity=ID,extra=None,raw=None):
 h={'Accept':'application/json','Content-Type':'application/json','X-Mesh-State-Version':'4'}
 if identity:h.update({'oai-authenticated-user-id':identity,'oai-authenticated-user-email':'qa@example.invalid'})
 h.update(extra or {})
 req=urllib.request.Request(BASE+path,data=raw if raw is not None else json.dumps(body).encode() if body is not None else None,headers=h,method=method)
 try:
  with urllib.request.urlopen(req,timeout=10) as r: code,content=r.status,r.read()
 except urllib.error.HTTPError as e:code,content=e.code,e.read()
 try:return code,json.loads(content)
 except Exception:return code,content.decode()[:180]
def check(name,ok):
 assert ok,(name,globals().get('code'),globals().get('p'))
 passed.append(name);print('PASS '+name)
def put(s):return request(method='PUT',body={**{k:v for k,v in s.items() if k!='updatedAt'},'expectedUpdatedAt':s['updatedAt']})
def action(s,**fields):return request('/api/actions','POST',{**fields,'requestId':str(uuid.uuid4()),'expectedUpdatedAt':s['updatedAt']})
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
code,s=request();check('v4 state exposes strict matrix defaults and real empty interaction log',code==200 and s['stateVersion']==4 and s['command']['interactions']==[] and s['settings']['neuro']['autoPriority'] is False)
for method in ['POST','DELETE','PATCH']:
 code,p=request(method=method,body={});check('state rejects unsupported '+method,code==405)
code,p=request('/api/actions','GET');check('action endpoint rejects unsupported read method',code==405)
code,p=request('/api/actions','POST',{},identity=None);check('own actions require identity',code==401)
code,p=request('/api/actions','POST',{},extra={'Origin':'https://outside.invalid'});check('cross-origin actions rejected',code==403)
code,p=request('/api/actions','POST',{},extra={'Sec-Fetch-Site':'cross-site'});print('Cross-site response',code,p,flush=True);check('cross-site actions rejected',code==403)
code,p=request('/api/actions','POST',{},extra={'Content-Type':'application/jsonp'});check('misleading JSON media type rejected',code==415)
code,p=request('/api/actions','POST',raw=b'{');check('invalid action JSON rejected',code==400)
code,p=request('/api/actions','POST',raw=b' '*33000);check('action body has independent streaming size limit',code==413)

mission={'id':str(uuid.uuid4()),'title':'Own interactive mission','goal':'Check deterministic action feedback loop','scope':'Own compiled local state only','project':'cue','owner':'manus','reviewer':'junior','stage':'Created','priority':'P1','output':'Verified findings','taskIds':['tune-controls'],'roomId':None,'sourceIds':['cue-init'],'evidence':'','reviewed':False,'checkpoint':'','archived':False,'createdAt':stamp()}
s['command']['missions']=[mission];code,s=put(s);check('new mission derives weights and explicit absent deadline',code==200 and s['command']['missions'][0]['neuro_profile']['noradrenaline']==0 and s['command']['missions'][0]['deadlineAt'] is None)
for phase,target in [('Created','Planned'),('Planned','Assigned'),('Assigned','Working')]:
 before=copy.deepcopy(s);sid=mission['id']+':'+phase
 code,s=action(s,action='focus-follow',missionId=mission['id'],suggestionId=sid)
 check('focus action advances valid '+phase+' to '+target,code==200 and s['command']['missions'][0]['stage']==target and s['command']['events'][-1]['kind']=='focus-followed')
 check('focus action emits meaningful progress weight for '+target,s['command']['events'][-1]['neuro_profile']['dopamine']>=40)
 code,p=action(before,action='focus-follow',missionId=mission['id'],suggestionId=sid);check('replay of stale '+phase+' action is conflict',code==409)
code,s=action(s,action='focus-follow',missionId=mission['id'],suggestionId=mission['id']+':tune-controls:start');check('next eligible task starts without invented worker execution',code==200 and s['tasks'][0]['status']=='In Arbeit' and s['command']['events'][-1]['kind']=='focus-followed')
s['command']['missions'][0]['stage']='Blocked';code,s=put(s);check('real blocked phase creates high-priority scored event',code==200 and s['command']['events'][-1]['neuro_profile']['noradrenaline']==85)
riskid='mission:'+mission['id'];source={k:v for k,v in s['command']['missions'][0].items() if k!='neuro_profile'};source={k:source[k] for k in sorted(source)};fp='sha256:'+hashlib.sha256(json.dumps([riskid,'Als blockiert dokumentiert',85,source],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
code,p=action(s,action='risk-accept',sourceId=riskid,fingerprint='forged',reason='Forged revision must be rejected');check('forged risk revision cannot be accepted',code==400)
code,p=action(s,action='risk-accept',sourceId=riskid,fingerprint=fp,reason='tiny');check('risk decision needs meaningful reason',code==400)
code,s=action(s,action='risk-plan',sourceId=riskid,fingerprint=fp,reason='Inspect the specific blocker and record proof');check('risk console creates linked real task',code==200 and s['command']['interactions'][-1]['kind']=='risk-task-created' and s['command']['interactions'][-1]['taskId'] in s['command']['missions'][0]['taskIds'])
fp=s['command']['interactions'][-1]['fingerprint']
code,p=action(s,action='risk-plan',sourceId=riskid,fingerprint=fp,reason='Attempt to create a duplicate task');check('repeated planning is not duplicated',code==400)
code,s=action(s,action='risk-accept',sourceId=riskid,fingerprint=fp,reason='Accept this blocker for a documented limited period');check('risk acceptance records stability but keeps blocker intact',code==200 and s['command']['missions'][0]['stage']=='Blocked' and s['command']['events'][-1]['kind']=='risk-accepted' and s['command']['events'][-1]['neuro_profile']['serotonin']==80)
bad=copy.deepcopy(s);bad['command']['interactions'][0]['reason']='Rewrite prior action intent';code,p=put(bad);check('normal state PUT cannot alter validated interaction log',code==400)
bad=copy.deepcopy(s);bad['command']['events'][-1]['neuro_context']={'risk':'high'};code,p=put(bad);check('client cannot change canonical event context',code==400)
code,other=request(identity=ID+'-other');check('other identity cannot read mission or decisions',code==200 and other['command']['missions']==[] and other['command']['interactions']==[])
code,p=request(extra={'X-Mesh-State-Version':'3'});check('v3 response excludes all v4 command metadata',code==200 and 'interactions' not in p['command'] and 'neuro_profile' not in p['command']['missions'][0])
legacy={**{k:v for k,v in p.items() if k!='updatedAt'},'expectedUpdatedAt':p['updatedAt']};legacy['checks']['baseline']=True
code,p=request(method='PUT',body=legacy,extra={'X-Mesh-State-Version':'3'});check('legacy v3 save after new interactions succeeds',code==200)
code,s=request();check('legacy save preserves matrix interaction records and weights',code==200 and len(s['command']['interactions'])==6 and s['command']['missions'][0]['neuro_profile']['noradrenaline']==85)
code,again=request();check('HTTP reload returns exact persisted state and server events',code==200 and again==s)
code,p=request('/api/make/start','POST',{});check('no fake Make start endpoint exists',code==404)
print(json.dumps({'passed':len(passed),'scope':'own local compiled worker; synthetic test identity, no production auth or external integration'}))
