import {Capacitor,registerPlugin} from '@capacitor/core';
import {createNativeARService,type NativeSnapshot} from './native-ar';
interface NativeARBridge{getAvailability():Promise<unknown>;open(input:{snapshot:NativeSnapshot}):Promise<unknown>}
const bridge=registerPlugin<NativeARBridge>('CueNativeAR');
// Registration is inert; no compatibility query or native window until explicit UI action.
export const nativeARService=createNativeARService({native:Capacitor.getPlatform()==='android',getAvailability:()=>bridge.getAvailability(),open:input=>bridge.open(input)});
