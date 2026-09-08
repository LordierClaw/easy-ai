import { NativeExecutor } from '../src/main/executor'
const executor = new NativeExecutor('.local/native-probe', fetch)
console.log(JSON.stringify(await executor.query({ operation: 'system_info' }, new AbortController().signal), null, 2))
