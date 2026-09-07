import { WindowsPlatform } from '../src/main/windows'
const platform = new WindowsPlatform('.local/native-probe', fetch)
const result = await platform.inspect()
console.log(JSON.stringify({ windows: result.windows, supported: result.supported, admin: result.admin, elevated: result.elevated,
  components: result.components.map(({ id, installed, compatible, version }) => ({ id, installed, compatible, version })),
  network: result.network.map(({ name, reachable, status }) => ({ name, reachable, status })) }, null, 2))
