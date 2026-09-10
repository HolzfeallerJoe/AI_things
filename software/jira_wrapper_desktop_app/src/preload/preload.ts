import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('setup', {
  current: (): Promise<string | null> => ipcRenderer.invoke('setup:current'),
  save: (domain: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('setup:save', domain),
});
