import {createContext,useContext,type ReactNode} from 'react';
import {useWorkState as useLocalWorkState} from '../overlay/use-work-state.ts';
export type SharedWorkState=ReturnType<typeof useLocalWorkState>;
const Context=createContext<SharedWorkState|null>(null);
export function SharedWorkStateProvider({children}:{children:ReactNode}){const state=useLocalWorkState();return <Context.Provider value={state}>{children}</Context.Provider>}
export function useWorkState():SharedWorkState{const state=useContext(Context);if(!state)throw new Error('SharedWorkStateProvider required');return state}
