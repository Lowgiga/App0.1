import {mobileAction,type MobileActionId} from './mobile-contract.ts';
import './mobile.css';

export function MobileContextHint({selectedAction}:{selectedAction:MobileActionId|null}) {
  const action=mobileAction(selectedAction);if(!action)return null;
  // A changed key resets native details to its compact, closed state.
  return <details key={action.id} className="lq-mobile-context"><summary>{action.label} · Kurzinfo</summary><p>{action.description}</p></details>;
}
