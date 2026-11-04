"""Trusted developer helper: rebuild the four original example packages, offline only."""
import json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'skills'
def obj(props, required=None):
    return {'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':False}
def arr(s,n=1000): return {'type':'array','items':s,'maxItems':n}
def string(n=500): return {'type':'string','maxLength':n}
def integer(): return {'type':'integer','minimum':0}
def output(props): return obj({'mode':{'type':'string','enum':['offline-deterministic']},**props})
def build(name,description,tags,node_types,tool,permission,input_schema,output_schema,body,reference):
    p=ROOT/name
    (p/'references').mkdir(parents=True,exist_ok=True)
    skill='---\nname: '+json.dumps(name)+'\ndescription: '+json.dumps(description,ensure_ascii=False)+'\n---\n\n# '+name+'\n\n'+body+'\n\nLies bei Bedarf die [Semantik und Prüfgrenzen](references/semantics.md).\n'
    resource=reference+'\n'
    (p/'SKILL.md').write_text(skill)
    (p/'references/semantics.md').write_text(resource)
    def digest(s): return 'sha256:'+hashlib.sha256(s.encode()).hexdigest()
    m={'namespace':'cue.command-mesh.skill/v1','id':'cue.'+name,'version':'1.0.0','name':name,'description':description,
       'triggers':{'intents':[name],'anyTags':tags,'allTags':[],'excludeTags':['execute','delete','install','external-write'],'nodeTypes':node_types},
       'inputSchema':input_schema,'outputSchema':output_schema,
       'tools':[{'id':tool,'effect':'local-compute','authentication':'none','permissions':[permission]}],
       'handler':name,'files':[{'path':'SKILL.md','stage':'instruction','sha256':digest(skill)}, {'path':'references/semantics.md','stage':'resource','sha256':digest(resource)}]}
    m['versionHash']=digest(json.dumps(m,sort_keys=True,ensure_ascii=False,separators=(',',':')))
    (p/'cue-skill.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')

build('mission-check',
      'Mission prüfen: Prüfe ausschließlich eine bereitgestellte Mission mit ihren Schritten.',
      ['mission','audit'],['mission'],'core.mission.check','compute:mission',
      obj({'title':string(200),'steps':arr(obj({'title':string(200),'done':{'type':'boolean'}}))}),
      output({'title':string(200),'stepCount':integer(),'completedCount':integer(),'issues':arr(string(),1001)}),
      'Prüfe Titel und Schrittbezeichnungen. Zähle vorhandene und als erledigt markierte Schritte. Melde fehlende Angaben als Datenlücken. Ein als erledigt markierter Schritt ist eine Eingabeangabe, keine externe Bestätigung.',
      'stepCount enthält alle Schritte, completedCount ausschließlich Schritte mit done=true. Leere Missionen und Titel erzeugen Hinweise. Kein Tool-, Server- oder Projekt-Audit findet statt.')

edge=obj({'source':string(100),'target':string(100)})
node=obj({'id':string(100),'label':string(200)})
adjacency=obj({'id':string(100),'label':string(200),'outbound':arr(string(100)),'inbound':arr(string(100))})
build('graph-explain',
      'Graph erklären: Ermittle Verbindungen und ungültige Kanten eines explizit übergebenen kleinen Mesh-Graphen.',
      ['graph','explain'],['agent','mission','tool','source','graph'],'core.graph.explain','compute:graph',
      obj({'nodes':arr(node),'edges':arr(edge)}),
      output({'nodeCount':integer(),'edgeCount':integer(),'danglingEdges':arr(edge),'adjacency':arr(adjacency)}),
      'Beschreibe nur übergebene Knoten und Kanten. Sortiere Nachbarschaften nach IDs. Melde Kanten zu unbekannten IDs und lehne doppelte Knoten-IDs ab. Eine Kante beweist weder Berechtigung noch aktive Integration.',
      'source ist der Ausgangsknoten, target der Zielknoten. Parallele Kanten bleiben erhalten. Self-Loops werden als ein- und ausgehend gezählt. Keine semantische oder kausale Interpretation wird erfunden.')

build('backup-plan',
      'Backup-Prüfplan: Erstelle aus einer Backup-Beschreibung einen Prüfplan ohne Datenzugriff oder Wiederherstellung.',
      ['backup','plan'],['backup','mission'],'core.backup.plan','compute:backup-plan',
      obj({'name':string(200),'location':string(500),'hasChecksum':{'type':'boolean'},'hasRestoreEvidence':{'type':'boolean'}}),
      output({'backup':string(200),'verified':{'type':'boolean','enum':[False]},'steps':arr(string(1000)),'warnings':arr(string(1000))}),
      'Erstelle einen nachvollziehbaren Prüfplan. Unterscheide vorhandene Angaben von durchgeführten Prüfungen. verified bleibt immer false, weil dieser Skill nichts liest oder wiederherstellt.',
      'Eine echte Prüfung braucht getrennte Freigabe und konkrete Werkzeuge. Nachweise: Inventar, Prüfsummen, isolierter Restore, Stichprobenvergleich und datierter Prüfbericht. hasRestoreEvidence=true ist nur eine Eingabeangabe.')

source=obj({'id':string(100),'kind':{'type':'string','enum':['snapshot','live-claim','unknown']},'label':string(200),'toolCount':integer()},['id','kind','label'])
source_status=obj({'id':string(100),'status':{'type':'string','enum':['snapshot-only','unverified-live-claim','unknown']}})
build('source-status',
      'Quellenstatus: Klassifiziere Quellen als Snapshot, ungeprüfte Live-Angabe oder unbekannt; keine Verbindungsprüfung.',
      ['source','status'],['source','integration','tool'],'core.source.status','compute:source-status',
      obj({'sources':arr(source)}),
      output({'snapshotCount':integer(),'liveClaimCount':integer(),'unknownCount':integer(),'installedToolCount':{'type':'null'},'statuses':arr(source_status)}),
      'Kennzeichne Snapshotdaten. Übernimm keine installierten oder verfügbaren Tools aus Zählwerten. Eine Live-Angabe bleibt ungeprüft. Gib installedToolCount=null aus.',
      'Ein Katalog kann 1078 Tools beschreiben, ohne dass eines eingerichtet, authentifiziert, freigegeben oder geprüft ist. Nur der Host kann aktuelle Capability-Evidence liefern. Keine Connector-Prüfung findet statt.')
