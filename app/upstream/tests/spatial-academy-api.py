"""Learning transfer against the own compiled local worker and isolated D1 only."""
import os, json, copy, uuid, datetime, urllib.request, urllib.error, urllib.parse
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
assert urllib.parse.urlparse(BASE).hostname in ['127.0.0.1','localhost']
USER='academy-audit-'+str(uuid.uuid4());passed=[]
def request(body=None,user=USER,version='4'):
 headers={'Content-Type':'application/json','Accept':'application/json','X-Mesh-State-Version':version,'oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@example.invalid'}
 req=urllib.request.Request(BASE+'/api/state',data=json.dumps(body).encode() if body is not None else None,headers=headers,method='PUT' if body is not None else 'GET')
 try:
  with urllib.request.urlopen(req,timeout=5) as r:code,data=r.status,r.read()
 except urllib.error.HTTPError as e:code,data=e.code,e.read()
 return code,json.loads(data)
def check(name,ok):
 assert ok,(name,globals().get('code'),globals().get('response'))
 passed.append(name);print('PASS '+name)
def put(state,user=USER,version='4'):
 return request({**{k:v for k,v in state.items() if k!='updatedAt'},'expectedUpdatedAt':state['updatedAt']},user,version)
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

code,state=request();check('existing v4 state loads with learning object',code==200 and state['stateVersion']==4 and state['learning']=={})
state['learning']['handoff']=True;code,state=put(state);check('pre-existing quiz completion can be persisted',code==200 and state['learning']['handoff'] is True)
code,legacy=request(version='3');check('v3 reader still sees its original quiz completion',code==200 and legacy['learning']['handoff'] is True and legacy['stateVersion']==3)
before=copy.deepcopy(state)
note={'id':str(uuid.uuid4()),'text':'[Mesh Academy · evidence]\nPersonal practice: login alone is not proof of a own read call. No external execution.','createdAt':stamp()}
state['learning']['evidence']=True;state['notes'].insert(0,note)
code,state=put(state);check('reasoning note and quiz flag commit in one accepted update',code==200 and state['notes'][0]==note and state['learning']['evidence'] is True)
check('saving deep practice preserves older completion',state['learning']['handoff'] is True)
events=state['command']['events'][len(before['command']['events']):]
check('learning and notes create exactly their two server events',len(events)==2 and {e['title'] for e in events}=={'Lernfortschritt aktualisiert','Arbeitsnotizen aktualisiert'})
check('practice events remain sequential',events[1]['sequence']==events[0]['sequence']+1)
check('practice events do not pretend to be remote worker calls',all(e['origin']=='app' and e['kind']=='workspace-updated' for e in events))
code,reloaded=request();check('reload returns the same persisted reasoning and flags',code==200 and reloaded==state)

task={'id':str(uuid.uuid4()),'title':'Lerntransfer: Connector-Zugriff belegen','category':'Lernen','priority':'P2','owner':'codex','status':'Offen','acceptance':'Tool, authentication, profile binding and independent read result must have separate sources and observed times.','evidence':'','reviewed':False,'dependencies':[],'archived':False}
state['tasks'].append(task);code,state=put(state);check('real learning transfer task is created open and unreviewed',code==200 and state['tasks'][-1]==task)
check('transfer event points at the real task ID',state['command']['events'][-1]['kind']=='task-updated' and state['command']['events'][-1]['entityId']==task['id'])
check('practice cannot create an approval or execute an external action',state['command']['approvals']==[] and state['command']['interactions']==[])
original=copy.deepcopy(state)
bad=copy.deepcopy(state);bad['tasks'][-1]['status']='Erledigt';code,response=put(bad);check('learning task cannot be completed without evidence and review',code==400)
bad=copy.deepcopy(state);bad['tasks'].append(task);code,response=put(bad);check('colliding transfer task IDs are rejected',code==400)
bad=copy.deepcopy(state);bad['notes'].append(note);code,response=put(bad);check('colliding result note IDs are rejected',code==400)
bad=copy.deepcopy(state);bad['tasks'][-1]['dependencies']=['nonexistent-learning-prerequisite'];code,response=put(bad);check('invalid transfer dependency is rejected',code==400)
bad=copy.deepcopy(state);bad['learning']['externalCertified']=True;code,response=put(bad);check('invented certification field is rejected',code==400)
code,reloaded=request();check('all rejected practice writes leave existing state intact',code==200 and reloaded==original)
stale=copy.deepcopy(state);state['notes'].append({'id':str(uuid.uuid4()),'text':'A subsequent independent local note.','createdAt':stamp()});code,state=put(state);check('independent update advances the revision',code==200 and state['updatedAt']!=stale['updatedAt'])
stale['learning']['review']=True;code,response=put(stale);check('stale quiz save reports 409 instead of overwriting another update',code==409)
code,reloaded=request();check('conflict recovery read retains both reasoning and independent note',code==200 and len(reloaded['notes'])==2 and reloaded['learning'].get('review') is not True)
code,other=request(user='academy-other-'+str(uuid.uuid4()));check('another user sees none of the saved practice records',code==200 and other['notes']==[] and other['learning']=={} and not any(t['id']==task['id'] for t in other['tasks']))
code,legacy=request(version='3');legacy['checks']['baseline']=True;code,response=put(legacy,version='3');check('older v3 client can still save after deep practice',code==200)
code,final=request();check('legacy roundtrip retains learning notes, tasks and sequential server history',code==200 and final['notes']==reloaded['notes'] and final['learning']==reloaded['learning'] and any(t['id']==task['id'] for t in final['tasks']) and final['command']['events'][-1]['sequence']>reloaded['command']['events'][-1]['sequence'])
mission={'id':str(uuid.uuid4()),'title':'Own learning context','goal':'Inspect a bounded evidence gap','scope':'Personal local app only','project':'cue','owner':'manus','reviewer':'junior','stage':'Created','priority':'P1','output':'An evidence-bound finding','taskIds':[],'roomId':None,'sourceIds':[],'evidence':'','reviewed':False,'checkpoint':'','archived':False,'createdAt':stamp()}
final['command']['missions'].append(mission);code,state=put(final);check('optional own mission context can be created normally',code==200 and state['command']['missions'][-1]['stage']=='Created')
before=copy.deepcopy(state);linked={**task,'id':str(uuid.uuid4()),'title':'Lerntransfer: Fortsetzbaren Hand-off erstellen','owner':'manus'}
state['tasks'].append(linked);state['command']['missions'][-1]['taskIds'].append(linked['id']);code,state=put(state)
check('mission prerequisite and new learning task commit together',code==200 and state['command']['missions'][-1]['taskIds']==[linked['id']] and state['tasks'][-1]==linked)
events=state['command']['events'][len(before['command']['events']):];check('linked transfer emits exactly the mission and task changes',len(events)==2 and {e['kind'] for e in events}=={'mission-updated','task-updated'} and events[1]['sequence']==events[0]['sequence']+1)
code,again=request();check('reloaded mission has a real existing task reference',code==200 and all(any(t['id']==tid for t in again['tasks']) for tid in again['command']['missions'][-1]['taskIds']))
bad=copy.deepcopy(again);bad['command']['missions'][-1]['taskIds'].append('missing-transfer');code,response=put(bad);check('invalid mission learning reference is rejected without modifying the link',code==400 and request()[1]==again)
print(json.dumps({'passed':len(passed),'scope':'own compiled local worker and isolated D1; synthetic identities, no production authentication or external integrations'}))
