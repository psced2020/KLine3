import http from 'http'

// 创建代理服务器来获取股票数据
const server = http.createServer(async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // 解析请求
  const url = new URL(req.url, `http://localhost:${server.address().port}`)
  const path = url.pathname

  // 股票K线数据代理
  if (path.startsWith('/api/stock/')) {
    const searchParams = url.searchParams
    const code = searchParams.get('code') || '1.600000'
    const days = parseInt(searchParams.get('days')) || 500

    try {
      // 从东方财富获取前复权K线数据
      // fqt=1: 前复权, fqt=2: 后复权, fqt=3: 不复权
      const eastmoneyUrl = `http://push2.eastmoney.com.cn/qt/kline/kline.aspx?secid=${code}&fields1=f1,f2,f3,f4,f5,f6&klt=101&fqt=1&end=20990101&lmt=${days}`

      const data = await new Promise((resolve, reject) => {
        http.get(eastmoneyUrl, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => resolve(data))
          res.on('error', reject)
        }).setTimeout(() => reject(new Error('请求超时')), 10000)
      })

      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify({ data }))
    } catch (error) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: error.message }))
    }
  } else {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`)
  console.log(`支持接口: http://localhost:${PORT}/api/stock/{code}?days={n}`)
})
