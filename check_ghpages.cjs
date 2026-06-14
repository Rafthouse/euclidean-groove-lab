const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

http.get('http://127.0.0.1:18800/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const page = targets.find(t => t.url && t.url.includes('rafthouse.github.io'));
    if (!page) { console.log('NO_GHPAGE'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1, pending = {};
    ws.on('message', (data) => {
      try { const m = JSON.parse(data.toString()); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } } catch(e) {}
    });
    function send(m, p) { const id = msgId++; ws.send(JSON.stringify({id, method:m, params:p})); return id; }
    function w(id, t) { return new Promise((r,x) => { pending[id]=r; setTimeout(()=>{if(pending[id]){delete pending[id];x('timeout')}},t||10000); }); }
    async function ev(e) { const id = send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true}); const res = await w(id, 15000); return res.result && res.result.result ? res.result.result.value : null; }

    ws.on('open', async () => {
      await w(send('Runtime.enable'));
      await new Promise(r => setTimeout(r, 1000));

      // Set theme
      await ev('document.documentElement.setAttribute("data-theme","neon-void")');
      await new Promise(r => setTimeout(r, 2000));

      // Capture
      const ssId = send('Page.captureScreenshot', {format:'png', fromSurface:true});
      const res = await w(ssId, 15000);
      if (res.result && res.result.data) {
        fs.writeFileSync('screenshots/ghpages.png', Buffer.from(res.result.data, 'base64'));
        const size = fs.statSync('screenshots/ghpages.png').size;
        console.log('GitHub Pages screenshot: ' + size + ' bytes');

        // Copy to workspace
        require('child_process').execSync('copy screenshots\\ghpages.png C:\\Users\\User\\.openclaw\\workspace\\ghpages.png', {shell: 'powershell.exe'});
      }
      ws.close();
    });
    ws.on('close', () => process.exit(0));
  });
}).on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 20000);
