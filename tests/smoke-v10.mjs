import { launch, exe } from './pw-v10.mjs';
const b = await launch();
const p = await b.newPage();
await p.goto('about:blank');
console.log('chromium version:', b.version(), '| exe:', exe);
await b.close();
