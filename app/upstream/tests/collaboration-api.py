"""Own isolated compiled worker: read-only MCP brief and ordinary unverified note storage."""
import os, json, uuid, urllib.request, urllib.error, copy, hashlib
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
USER='mesh-collaboration-'+str(uuid.uuid4())
passed=[]
def call(path, body=None, method='POST', user=USER, extra=None):
    headers={'Content-Type':'application/json','X-Mesh-State-Version':'4'}
    if user: headers.update({'oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@example.invalid'})
    headers.update(extra or {})
    request=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=10) as response: return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        raw=error.read().decode()
        try: value=json.loads(raw)
        except ValueError: value=raw
        return error.code,value
def check(name, ok):
    assert ok,name
    passed.append(name);print('PASS '+name,flush=True)
def rpc(name='mesh_get_collaboration_brief', arguments=None, user=USER, extra=None):
    return call('/mcp',{'jsonrpc':'2.0','id':'coordination-check','method':'tools/call','params':{'name':name,'arguments':arguments if arguments is not None else {}}},user=user,extra=extra)
def brief(user=USER):
    status,body=rpc(user=user)
    assert status==200 and not body['result']['isError'],body
    return json.loads(body['result']['content'][0]['text'])
def write(state):
    body={k:v for k,v in state.items() if k!='updatedAt'};body['expectedUpdatedAt']=state['updatedAt']
    return call('/api/state',body,'PUT')
code,b=rpc(user=None);check('private collaboration data requires authenticated identity',code==401 and b['error']['code']==-32001)
code,tools=call('/mcp',{'jsonrpc':'2.0','id':1,'method':'tools/list'},user=None)
listing=tools['result']['tools'];check('catalog exposes four read-only operations without private mission context',code==200 and len(listing)==4 and all(t['annotations']['readOnlyHint'] for t in listing) and USER not in json.dumps(listing))
code,state=call('/api/state',method='GET');check('isolated own state is readable',code==200)
secret='PRIVATE-NOTE-'+str(uuid.uuid4());own=copy.deepcopy(state);own['notes'].append({'id':str(uuid.uuid4()),'text':secret,'createdAt':'2026-10-01T00:00:00.000Z'})
mission={'id':str(uuid.uuid4()),'title':'Private integration audit fixture','goal':'Bounded own read-only coordination check','scope':'Own app and local fixtures','project':'cue','owner':'codex','reviewer':'junior','stage':'Created','priority':'P1','output':'Evidence and blockers','taskIds':[],'roomId':None,'sourceIds':[],'evidence':'','reviewed':False,'checkpoint':'','archived':False,'createdAt':'2026-10-01T00:00:00.000Z'}
own['command']['missions'].append(mission);code,saved=write(own);check('fixture has a genuine own stored context',code==200)
b=brief();check('brief returns only bounded own mission context',b['context']['missions']==[{'id':mission['id'],'title':mission['title'],'project':'cue','phase':'Created'}])
check('private notes goals account identifiers and permissions are not copied into context',secret not in json.dumps(b) and 'oai-authenticated-user' not in json.dumps(b) and 'goal' not in b['context']['missions'][0])
check('brief keeps direct connection delivery identity and acknowledgement unknown',b['state']=='prepared-not-delivered' and b['identity']['directChannel']=='not-verified' and b['identity']['acknowledgement']=='not-received')
check('external writing installation and scheduling are disallowed in brief',not b['limits']['externalWrite'] and not b['limits']['install'] and not b['limits']['scheduler'])
check('MCP and private state carry the same observed storage version',b['context']['updatedAt']==saved['updatedAt'])
second=brief();check('same private content has stable brief fingerprint',b['briefHash']==second['briefHash'])
content={k:v for k,v in b.items() if k not in ['briefHash','generatedAt']};expected=hashlib.sha256(json.dumps(content,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
check('fingerprint matches independent Python SHA-256',b['briefHash']==expected)
code,after=call('/api/state',method='GET');check('repeated brief reads create no notes events approvals or missions',after==saved)
other=brief(USER+'-other');check('other authenticated user sees none of first users missions',other['context']['missions']==[] and mission['id'] not in json.dumps(other))
check('different own context produces different fingerprint',other['briefHash']!=b['briefHash'])
code,bad=rpc(arguments={'execute':True});check('nonempty arguments never start actions',code==200 and bad['error']['code']==-32602)
code,bad=rpc(arguments=[]);check('array arguments are rejected',code==200 and bad['error']['code']==-32602)
code,bad=rpc(name='mesh_start_low');check('no remote worker start operation is available',code==200 and bad['error']['code']==-32602)
code,bad=rpc(extra={'Origin':'https://foreign.example'});check('foreign browser origin is rejected',code==403)
code,bad=rpc(extra={'MCP-Protocol-Version':'invalid'});check('unsupported protocol is rejected',code==400)
code,bad=call('/mcp',method='GET');check('MCP GET does not create a session or event stream',code==405)
report={'schemaVersion':1,'revision':b['revision'],'missionId':b['missionId'],'briefHash':b['briefHash'],'from':'low','acknowledged':True,'referenceCommit':b['referenceCommit'],'baseCommit':b['referenceCommit'],'status':'blocked','summary':'Manually received report with a concrete access blocker.','changedFiles':[],'tests':[],'blockers':['Device connection is unavailable.']}
next_state=copy.deepcopy(after);next_state['notes'].insert(0,{'id':str(uuid.uuid4()),'text':'LOW · manuell übernommene Rückmeldung · NICHT unabhängig verifiziert\n'+json.dumps(report),'createdAt':'2026-10-01T00:01:00.000Z'})
code,stored=write(next_state);check('ordinary CAS write preserves a manually supplied claim note',code==200 and 'NICHT unabhängig verifiziert' in stored['notes'][0]['text'])
check('claim storage does not mark a mission agent or approval completed',stored['command']['missions']==saved['command']['missions'] and stored['command']['approvals']==saved['command']['approvals'] and stored['profiles']==saved['profiles'])
check('claim storage records one canonical own note event',len(stored['command']['events'])==len(saved['command']['events'])+1 and stored['command']['events'][-1]['kind']=='workspace-updated' and stored['command']['events'][-1]['title']=='Arbeitsnotizen aktualisiert')
updated=brief();check('changed own context makes old brief fingerprint stale',updated['briefHash']!=report['briefHash'])
code,conflict=write(next_state);check('old storage revision returns conflict instead of overwriting',code==409)
print(json.dumps({'passed':len(passed),'scope':'own compiled worker and isolated D1; no production login or Low communication'}))
