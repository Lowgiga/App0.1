import type {AssistantResult} from './contracts.ts';
/** Display only a producer that already passed the host result contract. */
export function producerLabel(producer:AssistantResult['producer']){
 return `${producer.mode==='simulated'?'Simulation':producer.mode==='deterministic'?'Lokale Regeln':'Modellberatung'} · ${producer.bindingId}`;
}
