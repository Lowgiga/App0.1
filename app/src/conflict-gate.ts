/** A full-page reload, not a re-fetch, is required to abandon stale form closures. */
export class ConflictGate {
  private blocked=false;
  trip(){this.blocked=true;}
  get requiresReload(){return this.blocked;}
  assertWritable(draftRevision:string|null,currentRevision:string|null):string|null {
    if(this.blocked)return 'Speichern nach Konflikt gesperrt. Entwürfe sichern und die App vollständig neu laden.';
    if(draftRevision!==currentRevision){this.trip();return 'Der Entwurf ist veraltet. Entwürfe sichern und die App vollständig neu laden.';}
    return null;
  }
}
