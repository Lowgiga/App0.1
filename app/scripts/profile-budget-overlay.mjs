/** Narrow generated-UI patch. Upstream contracts and defaults stay untouched. */
export function applyProfileBudgetFix(source){
 const replace=(before,after)=>{const count=source.split(before).length-1;if(count!==1)throw new Error(`Profile budget drift: expected one anchor, got ${count}: ${before.slice(0,90)}`);source=source.replace(before,after)};
 replace("'use client';","'use client';\nimport {useProfileBudgetDraft} from '../src/use-profile-budget-draft.ts';");
 replace("const [p,setP]=useState(profile);const [dirty,setDirty]=useState(false);", "const [p,setP]=useState(profile);const [dirty,setDirty]=useState(false);const budgets=useProfileBudgetDraft(profile,!dirty,()=>setDirty(true));");
 replace('<Input aria-label="Aufrufbudget" type="number" min={0} max={1000} value={p.callBudget} onChange={e=>change(\'callBudget\',Math.min(1000,Math.max(0,Math.floor(Number(e.target.value)))))}/>','<Input aria-label="Aufrufbudget" {...budgets.callInput}/><p id={`${p.id}-callBudget-help`} role={budgets.callError?"alert":undefined}>{budgets.callError||\'0 bis 1000 Aufrufe · nur eine Vorgabe im Hand-off\'}</p>');
 replace('<Input aria-label="Zeitbudget" type="number" min={1} max={480} value={p.timeBudget} onChange={e=>change(\'timeBudget\',Math.min(480,Math.max(1,Math.floor(Number(e.target.value)))))}/>','<Input aria-label="Zeitbudget" {...budgets.timeInput}/><p id={`${p.id}-timeBudget-help`} role={budgets.timeError?"alert":undefined}>{budgets.timeError||\'1 bis 480 Minuten\'}</p>');
 replace('disabled={disabled||p.role.trim().length<2||!p.output.trim()} onClick={()=>onSave(p)}','disabled={disabled||!budgets.valid||p.role.trim().length<2||!p.output.trim()} onClick={()=>{const values=budgets.validate();if(values)void onSave({...p,...values})}}');
 replace('<Button variant="outline" onClick={()=>download(\'agent-\'+p.id', '<Button variant="outline" disabled={!budgets.valid} onClick={()=>{const values=budgets.validate();if(!values)return;void download(\'agent-\'+p.id');
 replace('callBudget:p.callBudget,timeBudget:p.timeBudget','callBudget:values.callBudget,timeBudget:values.timeBudget');
 replace("'application/json')}><Download size={16}/>Profil exportieren", "'application/json')}}><Download size={16}/>Profil exportieren");
 replace("setP({...defaultProfiles.find(x=>x.id===p.id)!})", "setP({...defaultProfiles.find(x=>x.id===p.id)!});budgets.reset(defaultProfiles.find(x=>x.id===p.id)!)");
 return source;
}
