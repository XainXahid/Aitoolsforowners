// Local preview with the scan API: node scripts/dev.mjs  ->  http://localhost:8788
// (Cloudflare's own `npx wrangler pages dev public` works too.)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as scan from '../functions/api/scan.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json' };

createServer(async (req, res) => {
  if (req.url === '/api/scan' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    const r = await scan.onRequestPost({ request: new Request('http://localhost/api/scan', { method: 'POST', body }), env: process.env });
    res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text()); return;
  }
  let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  try { const f = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(f); }
  catch { res.writeHead(404); res.end(await readFile(join(root, '404.html'))); }
}).listen(8788, () => console.log('http://localhost:8788'));
