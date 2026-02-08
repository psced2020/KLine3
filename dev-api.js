import http from 'http'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'public', 'export')

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = req.url

  // 处理 /api/stocks
  if (url === '/api/stocks') {
    try {
      const stocksPath = path.join(DATA_DIR, 'stocks.json')
      const content = fs.readFileSync(stocksPath, 'utf-8')
      const stocks = JSON.parse(content)
      const stockList = stocks.map((item) => item.code)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: stockList }))
    } catch (error) {
      console.error('[/api/stocks] Error:', error)
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: error.message }))
    }
  }
  // 处理 /api/stock/:code
  else if (url?.startsWith('/api/stock/')) {
    const code = url.split('/').pop()
    try {
      const stockPath = path.join(DATA_DIR, `${code}.json`)

      if (!fs.existsSync(stockPath)) {
        res.writeHead(404)
        res.end(JSON.stringify({ success: false, error: `Stock ${code} not found` }))
        return
      }

      const content = fs.readFileSync(stockPath, 'utf-8')
      const stockData = JSON.parse(content)
      const klineData = stockData.data.map((item) => ({
        date: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5]
      }))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        data: klineData,
        stockName: `${code} ${stockData.name}`
      }))
    } catch (error) {
      console.error('[/api/stock] Error:', error)
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: error.message }))
    }
  } else {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`开发API服务器运行在 http://localhost:${PORT}`)
  console.log(`- http://localhost:${PORT}/api/stocks`)
  console.log(`- http://localhost:${PORT}/api/stock/{code}`)
})
