import {z} from 'zod';
import {viewIds} from '../../upstream/lib/work-contract.ts';

export type MobileTarget = {kind:'view'; view:typeof viewIds[number]} | {kind:'studio'; tab:'surface'|'graph'|'skills'|'backup'|'memory'|'assistant'};
export type MobileActionId = `view:${typeof viewIds[number]}` | `studio:${Extract<MobileTarget,{kind:'studio'}>['tab']}`;
export type MobileAction = {id:MobileActionId; label:string; description:string; target:MobileTarget};

const views: Record<typeof viewIds[number], [string,string]> = {
  overview:['Übersicht','Dein gemeinsamer Arbeitsstand und die nächsten Schritte.'],
  agents:['Agenten','Arbeitsprofile, Vorgaben und Zuständigkeiten ansehen.'],
  missions:['Missionen','Ziele, Aufgaben und Fortsetzungspunkte prüfen.'],
  approvals:['Freigaben','Anfragen im Freigabebereich prüfen. Das Öffnen trifft keine Entscheidung.'],
  activity:['Aktivität','Akzeptierte Änderungen am lokalen Arbeitsstand nachvollziehen.'],
  intelligence:['Fokus','Fokus, Fortschritt und konkrete Entscheidungen überblicken.'],
  help:['Hilfe','Bedienung, Daten und überprüfbare Grenzen nachschlagen.'],
  connections:['Verbindungen','Werkzeuge und vorhandene Zugriffsnachweise prüfen.'],
  pilot:['PAZ-Pilot','Den Implementierungsplan und seine Kriterien vorbereiten.'],
  make:['Automationen','Abläufe und einen möglichen Startwunsch prüfen. Es wird nichts gestartet.'],
  lab:['Funktionslabor','Abläufe durchspielen und Übergaben vorbereiten.'],
  addons:['Add-ons','Den vorhandenen Werkzeug- und Skill-Katalog ansehen.'],
  evidence:['Evidenz','Quellen, Dateien und Screenshots mit Herkunft prüfen.'],
  chats:['Missionräume','Missionen, ausgewählte Quellen und Rückmeldungen öffnen.'],
  matrix:['Aufgaben','Prioritäten, Abhängigkeiten und Belege bearbeiten.'],
  space:['3D & Lernen','Beziehungen erkunden und Lernaufgaben öffnen. Kamera-AR wird hierdurch nicht gestartet.'],
  settings:['Einstellungen','Theme, Dichte, Schrift, Startseite, Widgets und Arbeitsprofile einstellen.'],
};
const studio: [Extract<MobileTarget,{kind:'studio'}>['tab'],string,string][] = [
  ['surface','Kombinierte Fläche','Graph, Quellen und Prüfergebnisse untereinander, nebeneinander oder im Fokus ansehen.'],
  ['graph','Graph','Die gespeicherte 2D- oder 3D-Ansicht des gemeinsamen Arbeitsstands öffnen.'],
  ['skills','Prüfprozesse','Lokale Prüfschritte und historische Ergebnisse ansehen. Es wird kein Lauf gestartet.'],
  ['backup','Backup','Export und Backup-Vorschau öffnen. Es wird nichts wiederhergestellt.'],
  ['memory','Projektgedächtnis','Gespeicherten Projektkontext und Fortsetzungspunkte ansehen.'],
  ['assistant','AI-Assistent','Projektbezogene Hilfe und lokale Vorschläge prüfen. Änderungen brauchen weiterhin ihre jeweilige Vorschau und Bestätigung.'],
];

// Every entry is a destination. Policy actions and execution commands are
// deliberately absent from this allowlist and cannot be persisted as a slot.
export const mobileActions: readonly MobileAction[] = [
  ...viewIds.map(view => ({id:`view:${view}` as MobileActionId,label:views[view][0],description:views[view][1],target:{kind:'view' as const,view}})),
  ...studio.map(([tab,label,description]) => ({id:`studio:${tab}` as MobileActionId,label,description,target:{kind:'studio' as const,tab}})),
];
const ids = mobileActions.map(action => action.id) as [MobileActionId,...MobileActionId[]];
const slotSchema = z.enum(ids).nullable();
export const mobilePreferencesSchema = z.object({slots:z.tuple([slotSchema,slotSchema,slotSchema,slotSchema])}).strict().refine(value => {
  const assigned=value.slots.filter(slot=>slot!==null);return new Set(assigned).size===assigned.length;
}, 'Jedes Ziel darf nur einer Schnelltaste zugewiesen sein.');
export type MobilePreferences = z.infer<typeof mobilePreferencesSchema>;
export const defaultMobilePreferences = (): MobilePreferences => ({slots:['view:overview','view:missions','studio:assistant','view:settings']});
export const parseMobilePreferences = (value:unknown): MobilePreferences => mobilePreferencesSchema.parse(value);
export function readMobilePreferences(state:{mobile?:unknown}):MobilePreferences {
  return Object.prototype.hasOwnProperty.call(state,'mobile') ? parseMobilePreferences(state.mobile) : defaultMobilePreferences();
}
export function assignMobileSlot(value:MobilePreferences,index:number,action:MobileActionId|null):MobilePreferences {
  if(!Number.isInteger(index)||index<0||index>3)throw new Error('Ungültige Schnelltaste.');
  const next=parseMobilePreferences(value);next.slots[index]=action;return parseMobilePreferences(next);
}
export const mobileAction = (id:MobileActionId|null): MobileAction|undefined => mobileActions.find(action=>action.id===id);
