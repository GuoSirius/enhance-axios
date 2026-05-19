/**
 * Mock API 处理器
 * 用于测试 enhance-axios 的各项功能
 */

const mockDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const responses = {
  // 防重复提交测试 - 随机延迟
  submit: (req, res) => {
    const delay = mockDelay(200, 500);
    setTimeout(() => {
      res.json({
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
      res.json({
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
        res.status(500).json({
          code: 500,
          message: 'Internal Server Error',
          data: null
        });
      } else {
        res.json({
          code: 0,
          message: 'success',
          data: { value: Math.random().toString(36).substring(7) }
        });
      }
    }, delay);
  },

  // 固定 500 错误
  error: (req, res) => {
    res.status(500).json({
      code: 500,
      message: 'Server Error',
      data: null
    });
  },

  // 固定 502 错误
  error502: (req, res) => {
    res.status(502).json({
      code: 502,
      message: 'Bad Gateway',
      data: null
    });
  },

  // HTTP 2xx 但业务码错误
  'business-error': (req, res) => {
    res.json({
      code: 1001,
      message: 'Business Error: Invalid parameter',
      data: null
    });
  },

  // 429 Too Many Requests
  error429: (req, res) => {
    res.status(429).json({
      code: 429,
      message: 'Too Many Requests',
      data: null
    });
  },

  // 慢接口 - 3秒延迟
  slow: (req, res) => {
    setTimeout(() => {
      res.json({
        code: 0,
        message: 'success',
        data: { slow: true }
      });
    }, 3000);
  },

  // 成功接口
  success: (req, res) => {
    res.json({
      code: 0,
      message: 'success',
      data: { timestamp: Date.now() }
    });
  },

  // 用户列表 - 用于测试 params
  users: (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    res.json({
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