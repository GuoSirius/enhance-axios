/**
 * enhance-axios Mock Server
 * 用于测试防重复提交、取消请求、重试功能
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const mockApi = require('./mock-api');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  // 添加 json 方法
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');

  // 静态文件服务 - 支持 ../dist/ 和 ../node_modules/ 目录
  if (pathname.startsWith('dist/') || pathname.startsWith('node_modules/')) {
    const staticPath = path.join(__dirname, '..', pathname);
    const ext = path.extname(staticPath);
    const contentType = MIME_TYPES[ext] || 'application/javascript';

    fs.readFile(staticPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + pathname);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
    return;
  }

  // 根路径重定向到 index.html
  if (pathname === '' || pathname === 'index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Failed to load index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // 处理 API 请求
  const apiPath = pathname.replace(/^api\//, '');
  const handler = mockApi[apiPath];

  if (handler) {
    // 解析请求体（用于 POST/PUT）
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          req.body = JSON.parse(body);
        } catch {}
        req.query = parsed.query;
        handler(req, res);
      });
    } else {
      req.query = parsed.query;
      handler(req, res);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 404, message: `Not Found: ${pathname}` }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   enhance-axios Mock Server         ║');
  console.log('  ║   Ready: http://localhost:' + PORT + '       ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log('  ║  测试接口:                          ║');
  console.log('  ║  GET  /api/search                   ║');
  console.log('  ║  POST /api/submit                   ║');
  console.log('  ║  GET  /api/data                     ║');
  console.log('  ║  GET  /api/error                    ║');
  console.log('  ║  GET  /api/error502                 ║');
  console.log('  ║  GET  /api/error429                 ║');
  console.log('  ║  GET  /api/business-error           ║');
  console.log('  ║  GET  /api/slow                     ║');
  console.log('  ║  GET  /api/success                  ║');
  console.log('  ║  GET  /api/users                    ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});