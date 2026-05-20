/**
 * enhance-axios Mock Server
 * 用于测试防重复提交、取消请求、重试功能
 *
 * 使用原生 http 模块，避免依赖 express/koa 等框架
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
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

// 辅助函数：发送 JSON 响应
const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const server = http.createServer((req, res) => {
  // CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 使用 WHATWG URL API 解析请求 URL
  const baseUrl = `http://${req.headers.host || 'localhost:' + PORT}`;
  const parsedUrl = new URL(req.url, baseUrl);
  const pathname = parsedUrl.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const query = Object.fromEntries(parsedUrl.searchParams);

  // 静态文件服务 - 支持 ../dist/ 和 ../node_modules/ 目录
  if (pathname.startsWith('dist/') || pathname.startsWith('node_modules/')) {
    const staticPath = path.join(__dirname, '..', pathname);
    const ext = path.extname(staticPath);
    const contentType = MIME_TYPES[ext] || 'application/javascript';

    fs.readFile(staticPath, (err, data) => {
      if (err) {
        sendJson(res, 404, { code: 404, message: 'Not Found: ' + pathname });
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
        sendJson(res, 500, { code: 500, message: 'Failed to load index.html' });
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
        } catch {
          req.body = {};
        }
        req.query = query;
        try {
          handler(req, res);
        } catch (err) {
          console.error('Handler error:', err);
          sendJson(res, 500, { code: 500, message: 'Internal handler error' });
        }
      });
    } else {
      req.query = query;
      try {
        handler(req, res);
      } catch (err) {
        console.error('Handler error:', err);
        sendJson(res, 500, { code: 500, message: 'Internal handler error' });
      }
    }
  } else {
    sendJson(res, 404, { code: 404, message: 'Not Found: ' + pathname });
  }
});

// 错误处理，防止服务器崩溃
server.on('error', (err) => {
  console.error('Server error:', err);
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