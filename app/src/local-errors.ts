export type LocalErrorCode = 'VALIDATION' | 'CONFLICT' | 'CORRUPT_STORAGE' | 'UNSUPPORTED_VERSION' | 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'UNSUPPORTED' | 'TOO_LARGE';
export class LocalStateError extends Error {
  readonly code: LocalErrorCode;
  readonly status: number;
  constructor(code:LocalErrorCode, message:string, status=503, options?:ErrorOptions) { super(message, options);this.name='LocalStateError';this.code=code;this.status=status; }
}
export function storageError(error:unknown):LocalStateError {
  if(error instanceof LocalStateError)return error;
  if(error instanceof DOMException && error.name==='QuotaExceededError')return new LocalStateError('QUOTA_EXCEEDED','Gerätespeicher voll. Keine Änderung gespeichert. Exportiere zuerst einen vorhandenen Snapshot.',507,{cause:error});
  return new LocalStateError('STORAGE_UNAVAILABLE','Lokaler Gerätespeicher nicht erreichbar. Der vorhandene Stand wird nicht zurückgesetzt.',503,{cause:error});
}
