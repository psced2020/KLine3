import fs from 'fs'
import path from 'path'

// 获取股票列表
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
    // 读取股票列表文件
    const stocksPath = path.join(process.cwd(), 'public', 'export', 'stocks.json')

    if (!fs.existsSync(stocksPath)) {
      res.writeHead(404)
      res.end(JSON.stringify({ success: false, error: 'Stock data not found' }))
      return
    }

    const content = fs.readFileSync(stocksPath, 'utf-8')
    const stocks = JSON.parse(content)

    // 返回股票代码列表
    const stockList = stocks.map((item: any) => item.code)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, data: stockList }))
  } catch (error: any) {
    console.error('[/api/stocks] Error:', error)
    res.writeHead(500)
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
}
