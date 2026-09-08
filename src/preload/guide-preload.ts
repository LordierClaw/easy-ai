import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, GuideAPI } from '../shared/guide'
const call = (name: string, ...args: unknown[]) => ipcRenderer.invoke(`guide:${name}`, ...args)
const api: GuideAPI = {
  info: () => call('info'), catalog: () => call('catalog'), list: () => call('list'), start: (...args) => call('start', ...args),
  approve: id => call('approve', id), send: (id, text) => call('send', id, text), cancel: id => call('cancel', id), retry: id => call('retry', id), confirm: (id, check) => call('confirm', id, check),
  trace: id => call('trace', id), export: id => call('export', id), saveSupport: (id, draft) => call('save-support', id, draft), exportSupport: id => call('export-support', id),
  copy: text => call('copy', text), attach: () => call('attach'), connections: () => call('connections'),
  onEvent: callback => { const listener = (_event: unknown, event: AgentEvent) => callback(event); ipcRenderer.on('guide:event', listener); return () => ipcRenderer.removeListener('guide:event', listener) }
}
contextBridge.exposeInMainWorld('guide', api)
