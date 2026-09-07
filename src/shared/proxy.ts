import type { ProxyInfo } from './types'
export function proxyFor(url: string, info: ProxyInfo): string | undefined {
  const u = new URL(url)
  if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return undefined
  if (!info.enabled || !info.server) return undefined
  const bypass = info.bypass.split(';').map(s => s.trim()).filter(Boolean)
  if (bypass.some(p => p === '<local>' ? !u.hostname.includes('.') : new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`, 'i').test(u.hostname))) return undefined
  const entries = info.server.split(';')
  const specific = entries.find(p => p.startsWith(`${u.protocol.slice(0, -1)}=`))?.split('=').slice(1).join('=')
  const server = specific || (!info.server.includes('=') ? info.server : undefined)
  return server ? (/^https?:\/\//.test(server) ? server : `http://${server}`) : undefined
}
export function proxyEnv(info: ProxyInfo): Record<string, string> {
  const http = proxyFor('http://registry.npmjs.org', { ...info, bypass: '' }) || ''
  const https = proxyFor('https://registry.npmjs.org', { ...info, bypass: '' }) || ''
  const bypass = info.bypass.split(';').filter(x => x && x !== '<local>').map(x => x.replace(/^\*\./, '.')).join(',')
  return { HTTP_PROXY: http, HTTPS_PROXY: https, http_proxy: http, https_proxy: https, ALL_PROXY: '', all_proxy: '',
    NO_PROXY: `localhost,127.0.0.1,::1${bypass ? ',' + bypass : ''}`, no_proxy: `localhost,127.0.0.1,::1${bypass ? ',' + bypass : ''}`,
    npm_config_proxy: http, npm_config_https_proxy: https, npm_config_noproxy: bypass }
}
