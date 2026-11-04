import os
"""Disposable local identities test persistence/contracts, not production dispatch authentication."""
import copy, datetime, json, urllib.request, urllib.error, uuid, time as clock
BASE = os.environ.get('MESH_TEST_BASE','http://127.0.0.1:8787')
IDENTITY = 'cue-foundation-' + str(uuid.uuid4())
passed = []

def request(method='GET', body=None, modern=True, other=False):
    headers = {'Content-Type': 'application/json', 'oai-authenticated-user-id': IDENTITY + ('-other' if other else ''), 'oai-authenticated-user-email': 'local-test@example.invalid'}
    if modern: headers['X-Mesh-State-Version'] = '3'
    req = urllib.request.Request(BASE + '/api/state', data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, json.load(e)

def check(label, condition):
    assert condition, label
    passed.append(label)
    print('PASS ' + label)

def put(state):
    body = {k: v for k, v in state.items() if k != 'updatedAt'}
    body['expectedUpdatedAt'] = state['updatedAt']
    return request('PUT', body)

def time(delta=0):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=delta)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

code, state = request()
check('modern GET returns state version and empty command defaults', code == 200 and state['stateVersion'] == 3 and state['command'] == {'missions': [], 'approvals': [], 'events': []})
code, legacy = request(modern=False)
check('already open 1.1 clients receive only legacy response fields', code == 200 and 'command' not in legacy and 'stateVersion' not in legacy)
mission = {'id': str(uuid.uuid4()), 'title': 'Disposable own mission', 'goal': 'Check own local persisted state', 'scope': 'Local validation only', 'project': 'cue', 'owner': 'manus', 'reviewer': 'junior', 'stage': 'Created', 'priority': 'P1', 'output': 'Findings and checkpoint', 'taskIds': ['tune-controls'], 'roomId': None, 'sourceIds': ['cue-init'], 'evidence': '', 'reviewed': False, 'checkpoint': 'First own local checkpoint', 'archived': False, 'createdAt': time()}
state['command']['missions'] = [mission]
code, state = put(state)
check('new mission persists with one canonical app event', code == 200 and state['command']['missions'][0] == mission and len(state['command']['events']) == 1 and state['command']['events'][0]['kind'] == 'mission-created')
bad = copy.deepcopy(state); bad['command']['events'] = []
code, payload = put(bad); check('client cannot erase canonical event log', code == 400)
bad = copy.deepcopy(state); bad['command']['missions'][0]['taskIds'] = ['missing-task']
code, payload = put(bad); check('missing mission task rejected without event', code == 400)
code, reloaded = request(); check('rejected changes leave state and event log unchanged', code == 200 and reloaded == state)
stale = copy.deepcopy(state)
state['command']['missions'][0]['stage'] = 'Planned'; code, state = put(state)
check('allowed phase change has increasing event sequence', code == 200 and state['command']['events'][-1]['sequence'] == 2 and state['command']['events'][-1]['kind'] == 'mission-stage')
code, payload = put(stale); check('stale tab cannot overwrite mission or generate event', code == 409)
code, payload = request(); check('409 leaves exactly the accepted events', code == 200 and len(payload['command']['events']) == 2)
approval = {'id': str(uuid.uuid4()), 'missionId': mission['id'], 'action': 'Document a private app decision', 'target': 'Own private app', 'dataSummary': 'Own source and local test report', 'reason': 'Only record a concrete own decision', 'expectedResult': 'Persisted decision without execution', 'risk': 'medium', 'reversibility': 'yes', 'impact': 'Own workspace only', 'testEvidence': 'Disposable local integration test executed', 'rollback': 'Restore prior own app version', 'createdAt': time(), 'expiresAt': time(86400), 'status': 'pending', 'scope': 'once', 'decidedAt': None, 'decisionNote': '', 'executed': False}
state['command']['approvals'] = [approval]; code, state = put(state)
check('approval request persists as pending and not executed', code == 200 and state['command']['approvals'][0]['executed'] is False)
bad = copy.deepcopy(state); bad['command']['approvals'][0].update(status='approved', decidedAt=time(), target='Different target')
code, payload = put(bad); check('decision cannot silently change request target', code == 400)
state['command']['approvals'][0].update(status='approved', decidedAt=approval['createdAt'], decisionNote='Disposable local approval record')
code, state = put(state)
check('decision time is canonical server time and execution remains false', code == 200 and state['command']['approvals'][0]['decidedAt'] != approval['createdAt'] and state['command']['approvals'][0]['executed'] is False)
bad = copy.deepcopy(state); bad['command']['approvals'][0]['action'] = 'Changed action after decision'
code, payload = put(bad); check('decided approval content cannot change', code == 400)
bad = copy.deepcopy(state); bad['command']['approvals'][0]['executed'] = True
code, payload = put(bad); check('app cannot claim execution through state write', code == 400)
bad = copy.deepcopy(state); bad['command']['missions'][0].update(stage='Done', reviewed=True, evidence='Disposable independent test evidence')
code, payload = put(bad); check('phase jump and unfinished task cannot produce completed mission', code == 400)
code, payload = request(other=True); check('second identity cannot read missions approvals or event log', code == 200 and payload['command'] == {'missions': [], 'approvals': [], 'events': []})
legacy_body = {'checks': {'baseline': True}, 'notes': [], 'expectedUpdatedAt': state['updatedAt']}
code, payload = request('PUT', legacy_body, modern=False)
check('legacy save response remains parseable for 1.1 client', code == 200 and 'command' not in payload and 'stateVersion' not in payload)
code, state = request(); check('legacy PUT preserves command entities and canonical history', code == 200 and len(state['command']['missions']) == 1 and len(state['command']['approvals']) == 1 and state['command']['events'][-1]['sequence'] == 5)
state['settings']['startView'] = 'missions'; code, state = put(state)
code, payload = request(modern=False)
check('legacy read maps modern start view to compatible overview', code == 200 and payload['settings']['startView'] == 'overview')
code, modern = request(); check('modern read retains configured modern start view', code == 200 and modern['settings']['startView'] == 'missions')
code, old_tab = request(modern=False)
old_body = {k: v for k, v in old_tab.items() if k != 'updatedAt'}; old_body['expectedUpdatedAt'] = old_tab['updatedAt']; old_body['checks']['schema'] = True
code, old_reply = request('PUT', old_body, modern=False)
check('legacy full-state round trip succeeds without modern fields', code == 200 and 'command' not in old_reply)
code, state = request(); check('legacy ordinary save does not overwrite modern start view', code == 200 and state['settings']['startView'] == 'missions')
bad = copy.deepcopy(state); bad['stateVersion'] = 5
code, payload = put(bad); check('future state version rejected', code == 400)
expired = copy.deepcopy(approval); expired.update(id=str(uuid.uuid4()), createdAt=time(-86400), expiresAt=time(-10))
bad = copy.deepcopy(state); bad['command']['approvals'].append(expired)
code, payload = put(bad); check('new expired approval is rejected', code == 400)
for stage in ['Assigned', 'Working', 'Review']:
    state['command']['missions'][0]['stage'] = stage
    code, state = put(state); check('mission lifecycle persists ' + stage, code == 200)
bad = copy.deepcopy(state); bad['command']['missions'][0]['stage'] = 'Approved'
code, payload = put(bad); check('mission approval without documented review rejected', code == 400)
state['tasks'][0].update(status='Erledigt', reviewed=True, evidence='Disposable local acceptance check executed')
for i in [2, 1]:
    state['tasks'][i].update(status='Erledigt', reviewed=True, evidence='Disposable prerequisite acceptance check', dependencies=[state['tasks'][i + 1]['id']] if i == 1 else [])
state['tasks'][0]['dependencies'] = [state['tasks'][1]['id']]
state['command']['missions'][0].update(stage='Approved', reviewed=True, evidence='Disposable independent local findings documented')
code, state = put(state); check('mission with completed task proof and distinct reviewer can be accepted', code == 200)
new_request = copy.deepcopy(approval); new_request.update(id=str(uuid.uuid4()), createdAt=time(), expiresAt=time(86400))
state['command']['approvals'].append(new_request); code, state = put(state)
bad = copy.deepcopy(state); bad['command']['missions'][0]['stage'] = 'Done'
code, payload = put(bad); check('pending decision prevents mission completion', code == 400)
state['command']['approvals'][-1].update(status='denied', decidedAt=time(), decisionNote='Disposable request declined')
code, state = put(state); check('declined request is recorded without execution', code == 200 and state['command']['approvals'][-1]['executed'] is False)
state['command']['missions'][0]['stage'] = 'Done'; code, state = put(state)
check('completed mission persists after prerequisites and review', code == 200 and state['command']['missions'][0]['stage'] == 'Done')
bad = copy.deepcopy(state); bad['tasks'][0]['status'] = 'Offen'
code, payload = put(bad); check('reopening task cannot invalidate completed mission silently', code == 400)
bad = copy.deepcopy(state); bad['command']['missions'][0]['goal'] = 'Different goal after acceptance'
code, payload = put(bad); check('completed mission content requires reopening review', code == 400)
bad = copy.deepcopy(state); bad['tasks'][0]['acceptance'] = 'Entirely different acceptance criteria after completed review'
code, payload = put(bad); check('accepted mission cannot retain review after task criteria change', code == 400)
bad = copy.deepcopy(state); bad['tasks'][2]['evidence'] = 'Replacement prerequisite proof after mission completion'
code, payload = put(bad); check('completed mission protects transitive prerequisite proof in API', code == 400)
state['command']['missions'][0]['archived'] = True; code, state = put(state)
check('mission archive retains completed content and event history', code == 200 and state['command']['missions'][0]['archived'] is True)
brief = copy.deepcopy(approval); brief.update(id=str(uuid.uuid4()), missionId=None, createdAt=time(), expiresAt=time(1))
state['command']['approvals'].append(brief); code, state = put(state)
check('short validity request initially persists', code == 200)
clock.sleep(1.1)
bad = copy.deepcopy(state); bad['command']['approvals'][-1].update(status='approved', decidedAt=brief['createdAt'])
code, payload = put(bad); check('expired request cannot be approved with forged old timestamp', code == 400)
state['command']['approvals'][-1].update(status='denied', decidedAt=time())
code, state = put(state); check('expired request can be declined without validity extension', code == 200 and state['command']['approvals'][-1]['status'] == 'denied')
print(str(len(passed)) + ' foundation API checks passed; local only.')
