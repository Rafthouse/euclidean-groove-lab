const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://127.0.0.1:18800/devtools/page/EECA45483C48B38E7A310D6285EE7E62';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

function evalPage(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) { ws.removeListener('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
    setTimeout(() => reject(new Error('eval timeout')), 15000);
  });
}

function screenshot(ws, filename) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png', fromSurface: true } }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        if (msg.result && msg.result.data) {
          const filepath = path.join(SCREENSHOTS_DIR, filename);
          fs.writeFileSync(filepath, Buffer.from(msg.result.data, 'base64'));
          console.log('SAVED: ' + filepath);
        }
        resolve();
      }
    };
    ws.on('message', handler);
    setTimeout(() => reject(new Error('screenshot timeout')), 15000);
  });
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const ws = new WebSocket(WS_URL);

  ws.on('open', async () => {
    try {
      // Navigate to app
      console.log('Navigating to app...');
      let result = await evalPage(ws, 'new Promise((r) => { window.location.href = "http://localhost:5173/euclidean-groove-lab/"; setTimeout(r, 3000); })');
      console.log('Navigate done');

      // Wait for render
      await evalPage(ws, 'new Promise(r => setTimeout(r, 2000))');

      // Check if theme selector exists
      let themeCheck = await evalPage(ws, 'document.querySelector("[class*=theme] select, .theme-select select, select") !== null');
      console.log('Theme selector exists:', JSON.stringify(themeCheck));

      // Try to find and use theme selector
      await evalPage(ws, `(function() {
        var selects = document.querySelectorAll('select');
        for (var i = 0; i < selects.length; i++) {
          var s = selects[i];
          var label = s.closest('.theme-select') || s.closest('.kit-select');
          if (!label) {
            var prev = s.previousElementSibling;
            if (prev && prev.textContent && prev.textContent.toLowerCase().indexOf('theme') !== -1) {
              s.value = 'satisfaction';
              s.dispatchEvent(new Event('change', { bubbles: true }));
              return 'Theme select via prev label';
            }
          }
          if (label && label.textContent.toLowerCase().indexOf('theme') !== -1) {
            s.value = 'satisfaction';
            s.dispatchEvent(new Event('change', { bubbles: true }));
            return 'Theme select found via class';
          }
        }
        return 'No theme selector found, forcing data-theme';
      })()`);

      await new Promise(r => setTimeout(r, 500));

      // Force the theme as fallback
      await evalPage(ws, 'document.documentElement.setAttribute("data-theme", "satisfaction")');
      await new Promise(r => setTimeout(r, 300));

      // Read CSS vars
      let vars = await evalPage(ws, '({ bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(), accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), text: getComputedStyle(document.documentElement).getPropertyValue("--text").trim(), radius: getComputedStyle(document.documentElement).getPropertyValue("--radius").trim() })');
      console.log('Runtime CSS vars:', JSON.stringify(vars));

      // Scroll to top for full UI screenshot
      await evalPage(ws, 'window.scrollTo(0,0); new Promise(r => setTimeout(r, 300))');
      await screenshot(ws, '01-full-ui.png');

      // Scroll to transport
      await evalPage(ws, `(function() {
        var el = document.querySelector('.transport, [class*=transport], button.play');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return !!el;
      })()`);
      await new Promise(r => setTimeout(r, 300));
      await screenshot(ws, '02-transport.png');

      // Scroll to pattern bank
      await evalPage(ws, `(function() {
        var el = document.querySelector('.pattern-bank, [class*=pattern]');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return !!el;
      })()`);
      await new Promise(r => setTimeout(r, 300));
      await screenshot(ws, '03-pattern-bank.png');

      // Scroll to sequencer
      await evalPage(ws, `(function() {
        var el = document.querySelector('.sequencer-wrapper, svg.sequencer, [class*=sequencer]');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return !!el;
      })()`);
      await new Promise(r => setTimeout(r, 300));
      await screenshot(ws, '04-sequencer.png');

      // Scroll to mixer
      await evalPage(ws, `(function() {
        var el = document.querySelector('.master-scope, [class*=mixer], [class*=master]');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return !!el;
      })()`);
      await new Promise(r => setTimeout(r, 300));
      await screenshot(ws, '05-mixer.png');

      console.log('All screenshots captured');
      ws.close();
    } catch (err) {
      console.error('Error:', err.message);
      ws.close();
    }
  });

  ws.on('error', (err) => console.error('WS error:', err.message));
  ws.on('close', () => process.exit(0));
  setTimeout(() => { console.error('Global timeout'); process.exit(1); }, 60000);
}

main();
