import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let source=fs.readFileSync(path.join(root,'upstream/components/ui/sidebar.tsx'),'utf8');
function replace(before,after){if(source.split(before).length!==2)throw new Error('Sidebar overlay drift: '+before);source=source.replace(before,after)}
replace('function SidebarProvider({\n  defaultOpen = true,','function SidebarProvider({\n  active = true,\n  defaultOpen = true,');
replace('  defaultOpen?: boolean','  active?: boolean\n  defaultOpen?: boolean');
replace('const toggleSidebar = React.useCallback(() => {\n    return','const toggleSidebar = React.useCallback(() => {\n    if (!active) return\n    return');
replace('}, [isMobile, setOpen, setOpenMobile])','}, [active, isMobile, setOpen, setOpenMobile])');
replace('React.useEffect(() => {\n    const handleKeyDown','React.useEffect(() => {\n    if (!active) return\n    const handleKeyDown');
replace('}, [toggleSidebar])','}, [active, toggleSidebar])');
replace('      openMobile,\n      setOpenMobile,','      openMobile: active && openMobile,\n      setOpenMobile,');
replace('[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]','[active, state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]');
fs.writeFileSync(path.join(root,'overlay/sidebar.tsx'),source);
console.log('Generated active-aware SidebarProvider; original UI component preserved.');
