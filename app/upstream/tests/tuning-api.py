import os
"""Own local API with disposable synthetic identity; not production dispatch auth."""
import urllib.request,urllib.error,json,uuid,copy,datetime
BASE=os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787');ID='cue-tuning-test-'+str(uuid.uuid4());passed=[]
def req(method='GET',body=None,other=False):
 h={'Accept':'application/json','Content-Type':'application/json','oai-authenticated-user-id':ID+('-other' if other else ''),'oai-authenticated-user-email':'local-test@example.invalid'}
 r=urllib.request.Request(BASE+'/api/state',data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
 try:
  with urllib.request.urlopen(r,timeout=15) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def check(label,condition):
 assert condition,label
 passed.append(label);print('PASS '+label)
def put(state):
 p={k:v for k,v in state.items() if k!='updatedAt'};p['expectedUpdatedAt']=state['updatedAt'];return req('PUT',p)
c,s=req();check('old shape gains workspace defaults',c==200 and len(s['tasks'])==11 and s['rooms']==[] and s['settings']['fontScale']==100)
s['settings'].update(theme='dark',density='compact',fontScale=115,widgets=['team','mission'],startView='matrix');s['profiles'][0]['role']='QA orchestrator';s['learning']['evidence']=True
c,s=put(s);check('settings profiles and learning persist together',c==200 and s['settings']['theme']=='dark' and s['profiles'][0]['role']=='QA orchestrator')
c,p=req('PUT',{'checks':{'baseline':True},'notes':[],'expectedUpdatedAt':s['updatedAt']});check('legacy PUT preserves all new fields',c==200 and p['settings']==s['settings'] and p['profiles']==s['profiles'] and p['learning']==s['learning']);s=p
bad=copy.deepcopy(s);bad['settings']['walletAutonomy']=True;c,p=put(bad);check('unknown setting rejected',c==400)
bad=copy.deepcopy(s);bad['profiles'][0]['externalWrite']='auto';c,p=put(bad);check('profile cannot widen external rights',c==400)
bad=copy.deepcopy(s);bad['profiles'][3]=copy.deepcopy(bad['profiles'][0]);c,p=put(bad);check('duplicate agent profile rejected',c==400)
bad=copy.deepcopy(s);bad['tasks'][0]['status']='Erledigt';c,p=put(bad);check('done without proof and review rejected',c==400)
bad['tasks'][0]['evidence']='Local acceptance test passed';c,p=put(bad);check('proof without review rejected',c==400)
bad['tasks'][0]['reviewed']=True;bad['tasks'][0]['dependencies']=['tune-dashboard'];c,p=put(bad);check('unfinished dependency blocks completion',c==400)
bad=copy.deepcopy(s);bad['tasks'][0]['dependencies']=['missing'];c,p=put(bad);check('missing dependency rejected',c==400)
bad=copy.deepcopy(s);bad['tasks'][0]['dependencies']=['tune-dashboard'];bad['tasks'][1]['dependencies']=['tune-controls'];c,p=put(bad);check('cyclic dependencies rejected',c==400)
bad=copy.deepcopy(s);bad['tasks'][0]['dependencies']=['tune-controls'];c,p=put(bad);check('self dependency rejected',c==400)
s['tasks'][0].update(status='Erledigt',evidence='Disposable local acceptance test: status guard verified.',reviewed=True);s['tasks'][1].update(status='Erledigt',evidence='Disposable local acceptance test: dependencies verified.',reviewed=True,dependencies=['tune-controls']);c,s=put(s);check('proven reviewed completion with completed dependency accepted',c==200 and s['tasks'][1]['status']=='Erledigt')
bad=copy.deepcopy(s);bad['tasks'][0]['status']='Offen';c,p=put(bad);check('reopening prerequisite invalidates dependent completion',c==400)
now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z');message={'id':str(uuid.uuid4()),'kind':'Auftrag','text':'Disposable room contribution','createdAt':now};room={'id':str(uuid.uuid4()),'title':'Disposable QA mission','agent':'junior','project':'paz','mode':'DEEP','goal':'Check only own local data','output':'Findings','sources':['cue-init'],'status':'Aktiv','messages':[message],'createdAt':now};s['rooms']=[room];c,s=put(s);check('mission room contribution persists',c==200 and s['rooms']==[room]);c,p=req();check('reload retains settings and room context',c==200 and p['rooms']==[room] and p['settings']['fontScale']==115)
c,p=req(other=True);check('second user cannot read rooms or settings',c==200 and p['rooms']==[] and p['settings']['theme']=='system')
bad=copy.deepcopy(s);bad['rooms'][0]['messages'].append(copy.deepcopy(message));c,p=put(bad);check('duplicate room messages rejected',c==400)
s['rooms'][0]['status']='Archiviert';c,s=put(s);check('archive is reversible persisted status',c==200 and s['rooms'][0]['status']=='Archiviert');s['rooms'][0]['status']='Aktiv';c,s=put(s);check('restore retains contributions',c==200 and s['rooms'][0]['messages']==[message])
stale=copy.deepcopy(s);s['settings']['powerSaver']=True;c,s=put(s);c,p=put(stale);check('stale tab cannot overwrite new workspace',c==409);c,p=req();check('conflict preserves saved state',c==200 and p['settings']['powerSaver'] is True)
print(str(len(passed))+' tuning checks passed; local only.')
