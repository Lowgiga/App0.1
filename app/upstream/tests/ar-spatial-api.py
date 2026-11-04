"""Own isolated Worker: additive personal level records, CAS transfer and legacy retention.
Records in notes are personal claims; this test does not certify rendering or camera hardware.
"""
import os, json, copy, uuid, datetime, urllib.request, urllib.error, urllib.parse
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
assert urllib.parse.urlparse(BASE).hostname in ['127.0.0.1','localhost']
USER='ar-levels-audit-'+str(uuid.uuid4());passed=[]
def request(body=None,user=USER,version='4',method=None):
 headers={'Content-Type':'application/json','X-Mesh-State-Version':version,'oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@example.invalid'}
 req=urllib.request.Request(BASE+'/api/state',data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method or ('PUT' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=5) as r:code,data=r.status,r.read()
 except urllib.error.HTTPError as e:code,data=e.code,e.read()
 try: parsed=json.loads(data)
 except (ValueError,TypeError): parsed=data.decode()
 return code,parsed
def check(name,ok):
 assert ok,(name,globals().get('code'),globals().get('response'))
 passed.append(name);print('PASS '+name,flush=True)
def put(state,version='4'):
 return request({**{k:v for k,v in state.items() if k!='updatedAt'},'expectedUpdatedAt':state['updatedAt']},version=version)
def uid():return str(uuid.uuid4())
def note(level,task_id=None,mission_id=None):
 stamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
 record={'version':1,'level':level,'provenance':'personal-practice','observedAt':stamp,'graphDigest':'0'*64,'path':'transfer' if task_id else '2d','nodeId':'agent:zimt','detail':'Own bounded personal exercise, not physical camera evidence.','taskId':task_id,'missionId':mission_id}
 return {'id':uid(),'createdAt':stamp,'text':'[Mesh Spatial Level · v1]\n'+json.dumps(record,ensure_ascii=False)}
code,state=request();check('existing state version 4 loads without a new migration',code==200 and state['stateVersion']==4)
state['learning']['handoff']=True;code,state=put(state);check('old quiz state is present before new levels',code==200 and state['learning']['handoff'])
profiles=copy.deepcopy(state['profiles']);before=copy.deepcopy(state)
for level in ['orientation','relationship','perspective']:state['notes'].insert(0,note(level))
code,state=put(state);check('three additive personal level notes persist while old quiz remains',code==200 and len([n for n in state['notes'] if n['text'].startswith('[Mesh Spatial Level')])==3 and state['learning']['handoff'])
events=state['command']['events'][len(before['command']['events']):]
check('level save emits one canonical notes event without fictional remote activity',len(events)==1 and events[0]['kind']=='workspace-updated' and events[0]['origin']=='app')
check('level save changes no agent rights approvals or interactions',state['profiles']==profiles and state['command']['approvals']==before['command']['approvals'] and state['command']['interactions']==before['command']['interactions'])
mission={'id':uid(),'title':'Own spatial transfer mission','goal':'Record a real scoped acceptance result','scope':'Private app','project':'cue','owner':'codex','reviewer':'junior','stage':'Created','priority':'P1','output':'Evidence and boundaries','taskIds':[],'roomId':None,'sourceIds':[],'evidence':'','reviewed':False,'checkpoint':'','archived':False,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')}
state['command']['missions'].append(mission);code,state=put(state);check('optional target mission can be prepared separately',code==200)
old=copy.deepcopy(state);task={'id':uid(),'title':'Mesh Praxis: 2D/3D und AR prüfen','category':'Lernen','priority':'P2','owner':'codex','status':'Offen','acceptance':'Check real frame, actual AR device, horizontal surface, precise errors and independent review.','evidence':'','reviewed':False,'dependencies':[],'archived':False};transfer=note('transfer',task['id'],mission['id'])
state['tasks'].append(task);state['notes'].insert(0,transfer);state['command']['missions'][-1]['taskIds'].append(task['id']);code,state=put(state)
check('transfer task note and mission reference commit atomically',code==200 and state['notes'][0]==transfer and state['tasks'][-1]==task and state['command']['missions'][-1]['taskIds']==[task['id']])
events=state['command']['events'][len(old['command']['events']):]
check('atomic transfer records three sequential canonical app events',len(events)==3 and all(e['origin']=='app' for e in events) and [e['sequence'] for e in events]==list(range(events[0]['sequence'],events[0]['sequence']+3)))
check('transfer creates no automatic worker activity approval or review',state['command']['approvals']==old['command']['approvals'] and state['command']['interactions']==old['command']['interactions'] and not state['tasks'][-1]['reviewed'])
code,reloaded=request();check('reload retains exact full state including personal records',code==200 and reloaded==state)
code,legacy=request(version='3');check('version 3 reader retains old quizzes and new ordinary notes',code==200 and legacy['learning']['handoff'] and legacy['notes']==state['notes'])
legacy['settings']['motion']='off';code,response=put(legacy,version='3');check('legacy write retains all spatial notes and version 4 command references',code==200 and response['notes']==state['notes'])
code,state=request();check('legacy update preserved the real transfer reference and event sequence',code==200 and state['command']['missions'][-1]['taskIds']==[task['id']] and state['command']['events'][-1]['sequence']>events[-1]['sequence'])
original=copy.deepcopy(state);bad=copy.deepcopy(state);bad['tasks'][-1]['status']='Erledigt';code,response=put(bad);check('transfer cannot be falsely closed without evidence and review',code==400)
bad=copy.deepcopy(state);bad['notes'].append(transfer);code,response=put(bad);check('duplicate personal record IDs are rejected',code==400)
bad=copy.deepcopy(state);bad['command']['missions'][-1]['taskIds'].append(uid());code,response=put(bad);check('missing mission task reference rejects the whole write',code==400)
code,response=request();check('invalid writes create no partial note task or event',code==200 and response==original)
code,response=put(old);check('stale revision cannot overwrite the transferred level',code==409)
code,other=request(user=USER+'-other');check('a different user has none of these personal records tasks or missions',code==200 and transfer['id'] not in json.dumps(other) and task['id'] not in json.dumps(other))
for method in ['POST','DELETE']:
 code,response=request({},method=method);check(method+' is explicitly unsupported and cannot mutate state',code==405)
print(json.dumps({'passed':len(passed),'scope':'own isolated compiled Worker; personal claim records, no production identity, remote worker or hardware AR'}))
