const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.ktx2':'image/ktx2', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(process.env.PORT || 8080, '127.0.0.1', () => console.log('Volta SKAI: http://127.0.0.1:' + (process.env.PORT || 8080)));
