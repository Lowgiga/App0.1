import os
"""Local-only integration tests. Synthetic identities do not test Sites dispatch auth."""
import urllib.request, urllib.error, json, uuid, datetime
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
TEST_ID='cue-test-'+str(uuid.uuid4())
identity={'oai-authenticated-user-id':TEST_ID,'oai-authenticated-user-email':'local-test@example.invalid'}
passed=[]
def request(path,method='GET',body=None,auth=False,extra=None):
 h={'Accept':'application/json','Content-Type':'application/json'}
 if auth:h.update(identity)
 if extra:h.update(extra)
 raw=body.encode() if isinstance(body,str) else json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(BASE+path,data=raw,headers=h,method=method)
 try:
  with urllib.request.urlopen(req,timeout=15) as r: code,raw=r.status,r.read()
 except urllib.error.HTTPError as e:code,raw=e.code,e.read()
 try: payload=json.loads(raw)
 except: payload=raw.decode()
 return code,payload

def check(label,condition):
 assert condition,label
 passed.append(label)
 print('PASS '+label)

code,p=request('/api/state');check('state requires identity',code==401)
code,p=request('/api/state',auth=True);check('fresh identity has empty state',code==200 and p['checks']=={} and p['notes']==[] and p['updatedAt'] is None and len(p['profiles'])==4)
code,p=request('/api/state','PUT','{',True);check('invalid JSON is rejected',code==400)
code,p=request('/api/state','PUT',{'checks':{'payment':True},'notes':[],'expectedUpdatedAt':None},True);check('unknown markers rejected',code==400)
code,p=request('/api/state','PUT',{'checks':{},'notes':[],'expectedUpdatedAt':None},True,{'Origin':'https://foreign.example'});check('cross-origin state write rejected',code==403)
note={'id':str(uuid.uuid4()),'text':'Disposable local integration note','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')}
state={'checks':{'baseline':True},'notes':[note],'expectedUpdatedAt':None}
code,p=request('/api/state','PUT',state,True);check('initial state persists',code==200 and p['notes']==[note]); stamp=p['updatedAt']
code,p=request('/api/state',auth=True);check('reload reads persisted state',code==200 and p['notes']==[note] and p['checks']['baseline'] is True)
code,p=request('/api/state',auth=True,extra={'oai-authenticated-user-id':TEST_ID+'-other'});check('second identity is isolated',code==200 and p['notes']==[])
state['expectedUpdatedAt']=stamp;state['checks']['schema']=True
code,p=request('/api/state','PUT',state,True);check('matching version updates',code==200 and p['updatedAt']>stamp)
code,p=request('/api/state','PUT',state,True);check('stale version cannot overwrite',code==409)
code,p=request('/api/state',auth=True);check('conflict leaves current state intact',code==200 and p['checks'].get('schema') is True)
rpc=lambda method,params=None:{'jsonrpc':'2.0','id':1,'method':method,**({'params':params} if params is not None else {})}
code,p=request('/mcp','POST',rpc('initialize',{'protocolVersion':'2025-06-18'}));check('MCP initialize negotiates declared version',code==200 and p['result']['protocolVersion']=='2025-06-18')
code,p=request('/mcp','POST',rpc('tools/list'));listed=p['result']['tools'];check('four declared read-only MCP tools preserve existing operations',code==200 and {t['name'] for t in listed}=={'mesh_get_status','mesh_get_paz_plan','mesh_get_make_evidence','mesh_get_collaboration_brief'} and all(t['annotations']['readOnlyHint'] and not t['annotations']['destructiveHint'] for t in listed))
code,p=request('/mcp','POST',rpc('tools/call',{'name':'mesh_get_status','arguments':{}}));check('MCP data read requires identity',code==401)
code,p=request('/mcp','POST',rpc('tools/call',{'name':'mesh_get_status','arguments':{}}),True);check('MCP status reads dated snapshot',code==200 and not p['result']['isError'] and json.loads(p['result']['content'][0]['text'])['addonCounts']['tools']==1078)
code,p=request('/mcp','POST',rpc('tools/call',{'name':'mesh_get_paz_plan','arguments':{}}),True);check('MCP plan reads only own stored notes',code==200 and json.loads(p['result']['content'][0]['text'])['work']['notes']==[note])
code,p=request('/mcp','POST',rpc('tools/call',{'name':'mesh_get_make_evidence','arguments':{}}),True);check('MCP Make reports inactive snapshot',code==200 and json.loads(p['result']['content'][0]['text'])['status']=='inactive')
code,p=request('/mcp','POST',rpc('tools/call',{'name':'mesh_get_status','arguments':[]}),True);check('MCP rejects array arguments',code==200 and p['error']['code']==-32602)
code,p=request('/mcp','POST','null');check('MCP rejects null request',code==400 and p['error']['code']==-32600)
code,p=request('/mcp','POST',rpc('tools/list'),False,{'Origin':'https://foreign.example'});check('MCP rejects unknown origin',code==403)
code,p=request('/mcp','POST',rpc('tools/list'),False,{'MCP-Protocol-Version':'invalid'});check('MCP rejects unsupported protocol header',code==400)
code,p=request('/mcp');check('stateless MCP does not invent SSE',code==405)
print(f'{len(passed)} checks passed; local test-only identities retained. Production dispatch not tested.')
