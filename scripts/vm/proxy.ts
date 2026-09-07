// Lab-only HTTP/CONNECT proxy. Bind explicitly to the host-only adapter; never 0.0.0.0.
import http from 'node:http'
import net from 'node:net'
import { appendFileSync, mkdirSync } from 'node:fs'
const host = process.env.EASYAI_PROXY_BIND || '127.0.0.1'
const port = Number(process.env.EASYAI_PROXY_PORT || 8080)
if (host === '0.0.0.0' || host === '::') throw new Error('Bind to host-only IPv4, not all interfaces.')
const blocked = (process.env.EASYAI_PROXY_BLOCK || '').split(',').filter(Boolean)
mkdirSync('artifacts', { recursive: true })
const log = (method: string, target: string, status: string) => appendFileSync('artifacts/proxy.jsonl', JSON.stringify({ at: new Date().toISOString(), method, target, status }) + '\n')
const forbidden = (target: string) => blocked.some(b => target === b || target.endsWith('.' + b))
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url!); if (url.protocol !== 'http:' || url.username || url.password) throw new Error('Only HTTP proxy requests allowed')
    if (forbidden(url.hostname)) { log(req.method || 'GET', url.hostname, 'blocked'); res.writeHead(502).end(); return }
    const headers = { ...req.headers }; delete headers['proxy-authorization']; delete headers['proxy-connection']
    const upstream = http.request(url, { method: req.method, headers }, r => { log(req.method || 'GET', url.hostname, String(r.statusCode)); res.writeHead(r.statusCode || 502, r.headers); r.pipe(res) })
    upstream.setTimeout(20000, () => upstream.destroy()); upstream.on('error', () => { res.writeHead(502).end() }); req.pipe(upstream)
  } catch { res.writeHead(400).end() }
})
server.on('connect', (req, socket, head) => {
  const [target, p] = (req.url || '').split(':'); const targetPort = Number(p)
  if (!target || targetPort !== 443 || forbidden(target)) { log('CONNECT', target, 'blocked'); socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return }
  const upstream = net.connect(targetPort, target, () => { log('CONNECT', target, 'connected'); socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); socket.pipe(upstream); upstream.pipe(socket) })
  upstream.setTimeout(120000, () => upstream.destroy()); upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy()); socket.on('close', () => upstream.destroy())
})
server.listen(port, host, () => console.log(`Lab proxy listening at ${host}:${port}. No credentials or request bodies are logged.`))
