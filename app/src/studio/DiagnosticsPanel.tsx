import {diagnosticsFromLoadedState,projectCatalogConnections,type DiagnosticsView,type LocalState} from '../diagnostics.ts';

const states:Record<LocalState,string>={ready:'Geladener lokaler Stand',loading:'Wird geladen',blocked:'Gesperrt',unknown:'Unbekannt'};
const causes:Record<DiagnosticsView['errorClass'],string>={
 none:'Keine Fehlermeldung übergeben. Das ist keine vollständige Systemprüfung.',
 UNKNOWN:'Ein Fehler ist gemeldet; eine verlässliche Fehlerklasse ist nicht verfügbar.',
 VALIDATION:'Die lokale Datenprüfung hat eine Eingabe abgelehnt.',
 CONFLICT:'Ein lokaler Speicherkonflikt wurde gemeldet.',
 CORRUPT_STORAGE:'Der lokale Speicher meldet beschädigte Daten.',
 UNSUPPORTED_VERSION:'Eine gespeicherte Datenversion wird nicht unterstützt.',
 STORAGE_UNAVAILABLE:'Der lokale Speicher ist nicht verfügbar.',
 QUOTA_EXCEEDED:'Der lokale Speicher meldet eine überschrittene Speichergrenze.',
 UNSUPPORTED:'Eine angeforderte lokale Funktion wird nicht unterstützt.',
 TOO_LARGE:'Ein lokales Datenlimit wurde überschritten.'
};
function nextStep(view:DiagnosticsView):string {
 if(view.errorClass==='QUOTA_EXCEEDED')return 'Speicherplatz außerhalb dieser App prüfen. Vorhandene Daten und Entwürfe nicht löschen.';
 if(view.errorClass==='UNSUPPORTED_VERSION'||view.errorClass==='CORRUPT_STORAGE')return 'Vorhandene Dateien unverändert aufbewahren und mit einer passenden App-Version prüfen. Kein Zurücksetzen ausführen.';
 if(view.workState==='blocked'||view.preferencesState==='blocked'||view.errorClass!=='none')return 'Sichtbare ungespeicherte Entwürfe vor einem Neuladen separat sichern. Anschließend den lokalen Status erneut prüfen.';
 if(view.workState==='loading'||view.preferencesState==='loading')return 'Den laufenden lokalen Lesevorgang abwarten. Diese Ansicht startet keine weitere Prüfung.';
 return 'Bei Bedarf die lokale Diagnosevorschau ansehen. Für externe Aktionen wären ein gezielter aktueller Nachweis und eine passende Freigabe nötig.';
}
const numberLabel=(value:number|null)=>value===null?'Unbekannt':String(value);

/** Read-only UI: no effects, probes, persistence, timers or export controls. */
export function DiagnosticsPanel({input,integrations}:{input:unknown;integrations:unknown}) {
 const diagnostics=diagnosticsFromLoadedState(input),connections=projectCatalogConnections(integrations);
 return <section className="panel" aria-label="Diagnose und Verbindungen">
  <details><summary>Diagnose und Verbindungen</summary>
   <h2>Lokale Diagnose</h2>
   <p>Diese Ansicht liest nur bereits übergebene Metadaten. Sie misst keine Leistung, prüft keine Server und sendet keine Telemetrie.</p>
   <p role="status" aria-live="polite" aria-atomic="true">Arbeitsstand: {states[diagnostics.workState]}. Studio-Einstellungen: {states[diagnostics.preferencesState]}.</p>
   <dl>
    <dt>Buildbasis</dt><dd>{diagnostics.buildVersion}</dd>
    <dt>Diagnoseschema</dt><dd>{diagnostics.schema}</dd>
    <dt>Arbeitsdatenschema</dt><dd>{diagnostics.workSchema===4?'Version 4':'Unbekannt'}</dd>
    <dt>Studio-Datenschema</dt><dd>{diagnostics.systemSchema==='unknown'?'Unbekannt':diagnostics.systemSchema}</dd>
    <dt>Betriebsart</dt><dd>Lokal auf diesem Gerät</dd>
    <dt>Letzte bestätigte Prüfung</dt><dd>Unbekannt. Änderungszeiten und Verlaufsdaten sind keine Prüfzeitpunkte.</dd>
    <dt>Fehlerklasse</dt><dd>{diagnostics.errorClass==='none'?'Keine übergeben':diagnostics.errorClass==='UNKNOWN'?'Unbekannt':diagnostics.errorClass}</dd>
   </dl>
   <p><strong>Ursache: </strong>{causes[diagnostics.errorClass]}</p>
   <p><strong>Nächster sicherer Schritt: </strong>{nextStep(diagnostics)}</p>
   <h3>Begrenzte Bestandszahlen</h3>
   <p>Nur Anzahlen des geladenen Stands, keine Inhalte. Bei gesperrtem Speicher können sie veraltet sein. Werte außerhalb der Darstellungsgrenze von 100.000 bleiben unbekannt.</p>
   <dl><dt>Aufgaben</dt><dd>{numberLabel(diagnostics.counts.tasks)}</dd><dt>Notizen</dt><dd>{numberLabel(diagnostics.counts.notes)}</dd><dt>Räume</dt><dd>{numberLabel(diagnostics.counts.rooms)}</dd><dt>Snapshot-Quellen</dt><dd>{numberLabel(diagnostics.counts.sources)}</dd></dl>
   <p>Aktueller Lauf: unbekannt. Gespeicherte Ergebnisverläufe: {numberLabel(diagnostics.workflow.historyCount)} (höchstens 20). Historische Ergebnisse sind keine Live-Nachweise. Der aktuelle Laufstatus wird nur im Bereich „Skills &amp; Prüfprozesse“ geprüft.</p>
   <h2>Verbindungen</h2>
   <p>Der enthaltene Katalog ist ein historischer Snapshot. Er bestätigt weder eine gespeicherte Konfiguration auf diesem Gerät noch einen aktuellen Zugriff. Anmeldung oder gespeicherte Konfiguration erteilen keine Aktionsfreigabe.</p>
   <p>Es gibt hier keinen Live-Prüfer und keine automatische Aktualisierung. Ohne ausdrücklich festgelegte Gültigkeitsdauer wird kein Nachweis als aktuell eingestuft.</p>
   <ul>{connections.map(row=><li key={row.provider}>
    <h3>{row.label}</h3><p>{row.provenance==='historical-snapshot'?'Historischer Katalogeintrag vorhanden.':'Kein Katalogeintrag im übergebenen Ausschnitt.'}</p>
    <dl><dt>Gespeicherte Konfiguration</dt><dd>Unbekannt</dd><dt>Erreichbarkeit</dt><dd>Unbekannt</dd><dt>Anmeldung</dt><dd>Unbekannt</dd><dt>Aktion geprüft</dt><dd>Unbekannt</dd><dt>Aktionsfreigabe</dt><dd>Nicht bewertet</dd><dt>Letzte bestätigte Prüfung</dt><dd>Unbekannt</dd></dl>
    <p>Nächster sicherer Schritt: Für eine konkrete Verbindung zunächst einen gezielten Prüfauftrag festlegen. Diese Ansicht führt ihn nicht aus.</p>
   </li>)}</ul>
   <details><summary>Lokale Diagnosevorschau</summary><p>Nur die hier sichtbaren, fest erlaubten Metadaten werden dargestellt. Keine Notiztexte, Prompts, Quelladressen, Nutzerkennungen, Zugangsdaten oder Fehlerstacks.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({diagnostics,connections},null,2)}</pre></details>
   <p>Diagnoseexport ist nicht implementiert. Vollständiges Wiederherstellen, Cloud-Synchronisation und Hintergrundprüfungen sind in dieser Ansicht nicht verfügbar.</p>
  </details>
 </section>;
}
