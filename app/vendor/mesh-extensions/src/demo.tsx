import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphExplorer, adaptWorkState, parseConfig, type ViewConfig, type SourceRecord } from './index.ts';
import { savedWorkContract, type WorkState } from '../../../upstream/lib/work-contract.ts';
function Demo() {
    const [work, setWork] = useState<WorkState | null>(null), [sources, setSources] = useState<SourceRecord[] | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [config, setConfig] = useState<ViewConfig | undefined>(), [mount, setMount] = useState(0);
    const graph = useMemo(() => adaptWorkState(work, sources), [work, sources]);
    async function load(file: File | undefined, type: 'state' | 'view') { if (!file)
        return; setError(''); try {
        if (file.size > 2000000)
            throw Error('Datei ist größer als 2 MB.');
        const raw: unknown = JSON.parse(await file.text());
        if (type === 'view') {
            setConfig(parseConfig(raw));
            setMount(n => n + 1);
            return;
        }
        const record = raw as Record<string, unknown>;
        const state = savedWorkContract.parse(record.work ?? raw);
        const list = (Array.isArray(record.sources) ? record.sources : null) as SourceRecord[] | null;
        adaptWorkState(state, list);
        setWork(state);
        setSources(list);
        setNotice('Lokale Datei geladen. Keine Netzwerkübertragung und kein Speichern.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Datei konnte nicht geladen werden.');
    } }
    return <><div style={{ padding: '20px 24px', maxWidth: 1800, margin: 'auto', fontFamily: 'system-ui', color: '#dceefa', background: '#142639' }}><h2 style={{ margin: '0 0 8px' }}>Graph Explorer · isolierter Prüfkandidat</h2><p>Startet ohne Daten. WorkState-JSON oder ein Objekt mit work und optional sources auswählen. Keine Beispieldaten und keine Live-Verbindung.</p><div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}><label>App-Datenstand <input type="file" accept="application/json,.json" onChange={e => void load(e.target.files?.[0], 'state')}/></label><label>Ansicht wiederherstellen <input type="file" accept="application/json,.json" onChange={e => void load(e.target.files?.[0], 'view')}/></label></div>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div><GraphExplorer key={mount} graph={graph} initialConfig={config} onNavigate={target => setNotice('Navigation angefordert: ' + target.view + ' / ' + target.entityId + ' (Prüfkandidat ohne App-Router)')} onPrepare={intent => setNotice('Vorbereitung angefordert: ' + intent.kind + ' / ' + intent.entityId + ' (kein Schreibzugriff)')}/></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Demo /></React.StrictMode>);
