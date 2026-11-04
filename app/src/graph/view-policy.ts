import {parseConfig,type ViewConfig} from '../../vendor/mesh-extensions/src/view.ts';
export type GraphHostPolicy={reduceMotion:boolean;powerSaver:boolean};
/** Render-time host constraints; preferences remain separately editable and serializable. */
export function applyGraphPolicy(preferred:ViewConfig,policy?:GraphHostPolicy):ViewConfig {
 const forcedMotion=Boolean(policy?.reduceMotion||policy?.powerSaver);
 return parseConfig({...preferred,reducedMotion:preferred.reducedMotion||forcedMotion,quality:policy?.powerSaver?'low':preferred.quality,transitions:forcedMotion?'off':preferred.transitions});
}
