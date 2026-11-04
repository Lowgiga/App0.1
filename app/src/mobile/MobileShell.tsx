import {useSystemPreferences} from '../system-preferences.tsx';
import {navigateOriginal} from '../system-navigation.ts';
import {MobileActionBar} from './MobileActionBar.tsx';
import {MobilePreferencesUI} from './MobilePreferencesUI.tsx';
import {readMobilePreferences,type MobileTarget} from './mobile-contract.ts';
import {navigateStudioTab,useMobileRoute,STUDIO_ASSISTANT_AVAILABLE} from './mobile-navigation.ts';

// Enable the assistant destination only after its real Studio panel has been
// integrated. The navigation component never substitutes a simulated panel.
export function MobileShell({assistantAvailable=STUDIO_ASSISTANT_AVAILABLE}:{assistantAvailable?:boolean}) {
  const preferences=useSystemPreferences(),route=useMobileRoute(assistantAvailable);
  if(!preferences.ready)return preferences.error?<section className="lq-mobile-preferences" aria-label="Mobile App-Bedienung"><p role="alert">App-Schnelltasten sind nicht verfügbar. {preferences.error}</p></section>:null;
  const value=readMobilePreferences(preferences.value);
  function navigate(target:MobileTarget){
    if(target.kind==='view')navigateOriginal({view:target.view});
    else if(target.tab!=='assistant'||assistantAvailable)navigateStudioTab(target.tab);
  }
  return <>
    <MobilePreferencesUI active={route.selectedAction==='view:settings'} value={value} disabled={!!preferences.error} onSave={mobile=>preferences.save(current=>({...current,mobile}))}/>
    <MobileActionBar value={value} selectedAction={route.selectedAction} onNavigate={navigate} unavailable={assistantAvailable?[]:['studio:assistant']}/>
  </>;
}
