import http from 'http'
import fs from 'fs'
import path from 'path'
import iconv from 'iconv-lite'

const DATA_DIR = path.join('D:', 'software', 'export')

// 获取所有股票文件
function getAllStockFiles() {
  try {
    const files = fs.readdirSync(DATA_DIR)
    return files
      .filter(f => f.endsWith('.txt'))
      .map(f => ({
        code: f.replace('.txt', '').replace('SH', '').replace('SZ', ''),
        file: f
      }))
  } catch (error) {
    console.error('读取数据目录失败:', error)
    return []
  }
}

// 解析股票数据文件
function parseStockFile(filePath) {
  try {
    // 读取 GBK 编码的文件并转换为 UTF-8
    const buffer = fs.readFileSync(filePath)
    const content = iconv.decode(buffer, 'gbk')
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length < 3) {
      throw new Error('数据格式错误')
    }

    // 解析股票名称（第一行）
    const stockInfoLine = lines[0]
    const nameMatch = stockInfoLine.match(/([^\s]+)\s+([^\s]+)\s+([^\s]+)/)
    const stockName = nameMatch ? nameMatch[2] : ''

    // 解析K线数据（从第3行开始）
    // 数据格式：日期, 开盘, 最高, 最低, 收盘, 成交量, 成交额
    const klineData = lines.slice(2).map(line => {
      const [date, open, high, low, close, volume, amount] = line.split(',')
      return {
        date,
        open: parseFloat(open),
        close: parseFloat(close),
        high: parseFloat(high),
        low: parseFloat(low),
        volume: parseInt(volume) || 0
      }
    }).filter(item => !isNaN(item.open) && !isNaN(item.close))

    return { stockName, klineData }
  } catch (error) {
    console.error('解析文件失败:', error)
    throw error
  }
}

// 创建服务器
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
  const pathname = url.pathname

  console.log(`[${req.method}] ${pathname}`)

  // 股票列表
  if (pathname === '/api/stocks') {
    try {
      const stocks = getAllStockFiles()
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: stocks }))
    } catch (error) {
      console.error('[/api/stocks] Error:', error)
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: error.message }))
    }
  }
  // 股票K线数据
  else if (pathname === '/api/stock') {
    const searchParams = url.searchParams
    const code = searchParams.get('code') || '600519'

    try {
      // 查找对应的文件
      const files = getAllStockFiles()
      const stock = files.find(s => s.code === code)

      if (!stock) {
        res.writeHead(404)
        res.end(JSON.stringify({ success: false, error: '股票不存在' }))
        return
      }

      const filePath = path.join(DATA_DIR, stock.file)
      const { stockName, klineData } = parseStockFile(filePath)

      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: klineData,
        stockName: `${code} ${stockName}`
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
  console.log(`代理服务器运行在 http://localhost:${PORT}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`支持接口:`)
  console.log(`  - http://localhost:${PORT}/api/stocks (获取股票列表)`)
  console.log(`  - http://localhost:${PORT}/api/stock?code={code} (获取K线数据)`)
})
