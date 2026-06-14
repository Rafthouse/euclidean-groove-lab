const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

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
      try {
        const m = JSON.parse(data.toString());
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      } catch(e) {}
    });

    function send(method, params) { const id = msgId++; ws.send(JSON.stringify({id, method, params})); return id; }
    function waitId(id, to) { return new Promise((r, x) => { pending[id]=r; setTimeout(()=>{if(pending[id]){delete pending[id]; x('timeout')}},to||10000); }); }

    ws.on('open', async () => {
      try {
        let id = send('Runtime.enable');
        await waitId(id);
        await new Promise(r => setTimeout(r, 300));

        // Set theme
        id = send('Runtime.evaluate', {expression: 'document.documentElement.setAttribute("data-theme","satisfaction")'});
        await waitId(id);
        console.log('Theme set to satisfaction');

        await new Promise(r => setTimeout(r, 1500));

        // Read ALL CSS vars
        id = send('Runtime.evaluate', {expression: 'JSON.stringify({bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(), accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), text: getComputedStyle(document.documentElement).getPropertyValue("--text").trim(), textDim: getComputedStyle(document.documentElement).getPropertyValue("--text-dim").trim(), radius: getComputedStyle(document.documentElement).getPropertyValue("--radius").trim(), panel: getComputedStyle(document.documentElement).getPropertyValue("--panel").trim(), current: getComputedStyle(document.documentElement).getPropertyValue("--current").trim(), rest: getComputedStyle(document.documentElement).getPropertyValue("--rest").trim(), kick: getComputedStyle(document.documentElement).getPropertyValue("--color-kick").trim(), accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() })', returnByValue: true});
        let res = await waitId(id);
        const varsStr = res.result && res.result.result ? res.result.result.value : 'null';
        const vars = JSON.parse(varsStr);
        console.log('CSS VARS:');
        Object.keys(vars).forEach(k => console.log('  ' + k + ': ' + vars[k]));
        console.log('IS CORRECT THEME: bg=' + vars.bg + ' accent=' + vars.accent + ' radius=' + vars.radius);

        // Verify against expected values
        const expectedBg = '#0b0b0b';
        const expectedAccent = '#ff7a00';
        const expectedRadius = '4px';
        console.log('EXPECTED: bg=' + expectedBg + ' accent=' + expectedAccent + ' radius=' + expectedRadius);
        console.log('MATCH bg: ' + (vars.bg === expectedBg || vars.bg === 'rgb(11, 11, 11)'));
        console.log('MATCH accent: ' + (vars.accent === expectedAccent || vars.accent === 'rgb(255, 122, 0)'));
        console.log('MATCH radius: ' + (vars.radius === expectedRadius));

        // Screenshot - full page
        id = send('Page.captureScreenshot', {format:'png', fromSurface:true});
        res = await waitId(id, 15000);
        if (res.result && res.result.data) {
          fs.writeFileSync('screenshots/01-full-ui.png', Buffer.from(res.result.data, 'base64'));
        }

        // Also get the base64 to report
        if (res.result && res.result.data) {
          console.log('SCREENSHOT_READY: ' + res.result.data.length + ' bytes');
        }

        ws.close();
      } catch(e) { console.error('Error:', e.message); ws.close(); }
    });

    ws.on('error', (e) => console.error('WS err:', e.message));
    ws.on('close', () => process.exit(0));
  });
}).on('error', (e) => { process.exit(1); });
setTimeout(() => process.exit(1), 20000);
