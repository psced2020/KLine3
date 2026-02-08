import fs from 'fs'
import path from 'path'

// 获取单个股票的K线数据
export default async function handler(req: any, res: any) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
    return
  }

  try {
    // 获取股票代码（Vercel 动态路由通过 query 传递）
    const code = req.query.code as string

    if (!code) {
      res.writeHead(400)
      res.end(JSON.stringify({ success: false, error: 'Stock code is required' }))
      return
    }

    // 读取股票数据文件
    const stockPath = path.join(process.cwd(), 'public', 'export', `${code}.json`)

    if (!fs.existsSync(stockPath)) {
      res.writeHead(404)
      res.end(JSON.stringify({ success: false, error: `Stock ${code} not found` }))
      return
    }

    const content = fs.readFileSync(stockPath, 'utf-8')
    const stockData = JSON.parse(content)

    // 转换数据格式为前端期望的格式
    // 前端期望: { date, open, close, high, low, volume }
    const klineData = stockData.data.map((item: any[]) => ({
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
  } catch (error: any) {
    console.error('[/api/stock] Error:', error)
    res.writeHead(500)
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
}
