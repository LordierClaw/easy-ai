import { contextBridge, ipcRenderer } from 'electron'
import type { EasyAPI, RunEvent } from '../shared/types'
const call = (name: string, ...args: unknown[]) => ipcRenderer.invoke(`easy:${name}`, ...args)
const api: EasyAPI = {
  info: () => call('info'), list: () => call('list'), start: (a, t) => call('start', a, t),
  approve: id => call('approve', id), cancel: id => call('cancel', id), retry: id => call('retry', id),
  send: (id, text) => call('send', id, text), open: (id, target) => call('open', id, target),
  attach: () => call('attach'), export: id => call('export', id), copy: text => call('copy', text),
  connections: () => call('connections'), confirmChatGPT: id => call('confirm-chatgpt', id),
  onEvent: callback => { const listener = (_event: unknown, value: RunEvent) => callback(value); ipcRenderer.on('easy:event', listener); return () => ipcRenderer.removeListener('easy:event', listener) }
}
contextBridge.exposeInMainWorld('easy', api)
