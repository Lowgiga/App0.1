import {useEffect,useState,type ChangeEvent} from 'react';
import type {AgentProfile} from '../upstream/lib/work-contract.ts';
type Budgets=Pick<AgentProfile,'callBudget'|'timeBudget'>;
type Field=keyof Budgets;
const limits={callBudget:[0,1000],timeBudget:[1,480]} as const;
/** Editing is text. Only a valid, explicit save/export can consume numbers. */
export function useProfileBudgetDraft(profile:AgentProfile,clean:boolean,onDirty:()=>void){
 const [raw,setRaw]=useState(()=>({callBudget:String(profile.callBudget),timeBudget:String(profile.timeBudget)}));
 const [touched,setTouched]=useState({callBudget:false,timeBudget:false});
 function reset(value:Budgets){setRaw({callBudget:String(value.callBudget),timeBudget:String(value.timeBudget)});setTouched({callBudget:false,timeBudget:false})}
 useEffect(()=>{if(clean)reset(profile)},[profile.id,profile.callBudget,profile.timeBudget,clean]);
 function parse(field:Field){const text=raw[field],value=Number(text);return /^\d+$/.test(text)&&Number.isSafeInteger(value)&&value>=limits[field][0]&&value<=limits[field][1]?value:null}
 const callBudget=parse('callBudget'),timeBudget=parse('timeBudget');
 const values=callBudget!==null&&timeBudget!==null?{callBudget,timeBudget}:null;
 function error(field:Field){return touched[field]&&parse(field)===null?`Bitte eine ganze Zahl von ${limits[field][0]} bis ${limits[field][1]} eingeben.`:''}
 function input(field:Field){return {type:'text',inputMode:'numeric' as const,value:raw[field],maxLength:16,'aria-invalid':!!error(field),'aria-describedby':`${profile.id}-${field}-help`,onChange:(event:ChangeEvent<HTMLInputElement>)=>{onDirty();setRaw(current=>({...current,[field]:event.target.value}))},onBlur:()=>setTouched(current=>({...current,[field]:true}))}}
 return {values,valid:values!==null,callInput:input('callBudget'),timeInput:input('timeBudget'),callError:error('callBudget'),timeError:error('timeBudget'),reset,validate(){setTouched({callBudget:true,timeBudget:true});return values}};
}
