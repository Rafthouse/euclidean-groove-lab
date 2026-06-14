const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const themeMap = [
  // Requested theme name -> actual CSS data-theme value
  ['dark-neon', 'neon-void'],
  ['vintage-paper', 'old-school'],  // closest to vintage/paper
  ['elements', 'elements'],          // default theme, handled as base CSS
  ['nautilus', 'trip'],             // no nautilus in CSS, trip is the closest
  ['cherry', 'cherry'],
  ['big-boss', 'big-boss'],
  ['revelation', 'revelation'],
];

http.get('http://127.0.0.1:18800/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const target = targets.filter(t => t.type === 'page')[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = {};

    ws.on('message', (data) => {
      try { const m = JSON.parse(data.toString()); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } } catch(e) {}
    });

    function send(method, params) { const id = msgId++; ws.send(JSON.stringify({id, method, params})); return id; }
    function waitId(id, to) { return new Promise((r, x) => { pending[id]=r; setTimeout(()=>{if(pending[id]){delete pending[id]; x('timeout')}},to||10000); }); }
    async function ev(expr) { const id = send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); const res = await waitId(id, 15000); return res.result && res.result.result ? res.result.result.value : null; }
    async function ss(name, themeId) { 
      await ev('document.documentElement.setAttribute("data-theme","' + themeId + '")');
      await new Promise(r => setTimeout(r, 1500));
      const bg = await ev('getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()');
      const id = send('Page.captureScreenshot', {format:'png', fromSurface:true});
      const res = await waitId(id, 15000);
      if (res.result && res.result.data) {
        const p = 'screenshots/' + name;
        fs.writeFileSync(p, Buffer.from(res.result.data, 'base64'));
        console.log(name + ' (data-theme=' + themeId + ', --bg=' + bg + ', size=' + fs.statSync(p).size + ' bytes)');
      }
    }

    ws.on('open', async () => {
      try {
        await waitId(send('Runtime.enable'));
        await new Promise(r => setTimeout(r, 300));

        for (const [requested, actual] of themeMap) {
          await ss(requested + '.png', actual);
        }

        console.log('---ALL DONE---');
        ws.close();
      } catch(e) { console.error('Error:', e.message); ws.close(); }
    });
    ws.on('error', (e) => console.error('WS err:', e.message));
    ws.on('close', () => process.exit(0));
  });
}).on('error', (e) => { process.exit(1); });
setTimeout(() => process.exit(1), 120000);
