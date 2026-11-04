import {createContext,useContext,type ReactNode} from 'react';
import type {WorkTransport} from './local-adapter.ts';
const Context=createContext<WorkTransport|null>(null);
export function WorkTransportProvider({transport,children}:{transport:WorkTransport;children:ReactNode}) {return <Context.Provider value={transport}>{children}</Context.Provider>;}
export function useWorkTransport():WorkTransport {const transport=useContext(Context);if(!transport)throw new Error('Ein expliziter WorkTransport ist erforderlich.');return transport;}
