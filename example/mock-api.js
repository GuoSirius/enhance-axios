/**
 * Mock API 处理器
 * 用于测试 enhance-axios 的各项功能
 *
 * 注意：使用原生 http 模块，res 没有 status() 方法
 * 需要使用 res.writeHead() 来设置状态码
 */

const mockDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 辅助函数：设置状态码并发送 JSON 响应
const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const responses = {
  // 防重复提交测试 - 随机延迟
  submit: (req, res) => {
    const delay = mockDelay(200, 500);
    setTimeout(() => {
      sendJson(res, 200, {
        code: 0,
        message: 'success',
        data: { id: Date.now() },
        delay
      });
    }, delay);
  },

  // 取消请求测试 - 较慢响应
  search: (req, res) => {
    const delay = mockDelay(800, 1500);
    setTimeout(() => {
      sendJson(res, 200, {
        code: 0,
        message: 'success',
        data: {
          list: [
            { id: 1, name: 'result-' + Date.now() }
          ],
          total: 100
        },
        delay
      });
    }, delay);
  },

  // 重试测试 - 50% 概率返回错误
  data: (req, res) => {
    const shouldFail = Math.random() < 0.5;
    const delay = mockDelay(100, 300);

    setTimeout(() => {
      if (shouldFail) {
        sendJson(res, 500, {
          code: 500,
          message: 'Internal Server Error',
          data: null
        });
      } else {
        sendJson(res, 200, {
          code: 0,
          message: 'success',
          data: { value: Math.random().toString(36).substring(7) }
        });
      }
    }, delay);
  },

  // 固定 500 错误
  error: (req, res) => {
    sendJson(res, 500, {
      code: 500,
      message: 'Server Error',
      data: null
    });
  },

  // 固定 502 错误
  error502: (req, res) => {
    sendJson(res, 502, {
      code: 502,
      message: 'Bad Gateway',
      data: null
    });
  },

  // HTTP 2xx 但业务码错误
  'business-error': (req, res) => {
    sendJson(res, 200, {
      code: 1001,
      message: 'Business Error: Invalid parameter',
      data: null
    });
  },

  // 429 Too Many Requests
  error429: (req, res) => {
    sendJson(res, 429, {
      code: 429,
      message: 'Too Many Requests',
      data: null
    });
  },

  // 慢接口 - 3秒延迟
  slow: (req, res) => {
    setTimeout(() => {
      sendJson(res, 200, {
        code: 0,
        message: 'success',
        data: { slow: true }
      });
    }, 3000);
  },

  // 成功接口
  success: (req, res) => {
    sendJson(res, 200, {
      code: 0,
      message: 'success',
      data: { timestamp: Date.now() }
    });
  },

  // 网络错误模拟 - 直接关闭连接
  'network-error': (req, res) => {
    res.destroy();  // 直接断开，模拟网络错误
  },

  // 用户列表 - 用于测试 params
  users: (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    sendJson(res, 200, {
      code: 0,
      message: 'success',
      data: {
        list: Array.from({ length: pageSize }, (_, i) => ({
          id: (page - 1) * pageSize + i + 1,
          name: `User ${(page - 1) * pageSize + i + 1}`
        })),
        total: 100,
        page,
        pageSize
      }
    });
  }
};

module.exports = responses;