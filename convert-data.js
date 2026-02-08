import fs from 'fs'
import path from 'path'
import iconv from 'iconv-lite'

const SOURCE_DIR = path.join('D:', 'software', 'export')
const TARGET_DIR = path.join(process.cwd(), 'public', 'export')

// 创建目标目录
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true })
  console.log(`创建目录: ${TARGET_DIR}`)
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
    const parts = stockInfoLine.trim().split(/\s+/)
    const stockName = parts[1] || ''
    const stockCode = parts[0] || ''

    // 解析K线数据（从第3行开始）
    // 使用紧凑数组格式: [date, open, high, low, close, volume]
    // 索引映射: 0=date, 1=open, 2=high, 3=low, 4=close, 5=volume
    const klineData = lines.slice(2).map(line => {
      const [date, open, high, low, close, volume] = line.split(',')
      return [
        date,
        parseFloat(open),
        parseFloat(high),
        parseFloat(low),
        parseFloat(close),
        parseInt(volume) || 0
      ]
    }).filter(item => !isNaN(item[1]) && !isNaN(item[4]))

    return { stockCode, stockName, klineData }
  } catch (error) {
    console.error(`解析文件失败 ${filePath}:`, error.message)
    return null
  }
}

// 获取所有股票文件
function getAllStockFiles() {
  try {
    const files = fs.readdirSync(SOURCE_DIR)
    return files.filter(f => f.endsWith('.txt'))
  } catch (error) {
    console.error('读取数据目录失败:', error)
    return []
  }
}

// 转换所有股票数据
async function convertAllStocks() {
  const files = getAllStockFiles()
  console.log(`找到 ${files.length} 个股票文件`)

  const stocks = []
  let successCount = 0
  let failCount = 0

  for (const file of files) {
    const sourcePath = path.join(SOURCE_DIR, file)

    console.log(`处理: ${file}`)

    const result = parseStockFile(sourcePath)

    if (result && result.klineData.length > 0) {
      // 股票代码（去掉 SH/SZ 前缀）
      const code = result.stockCode.replace(/^SH/, '').replace(/^SZ/, '')

      // 保存单个股票数据
      const stockData = {
        code,
        name: result.stockName,
        data: result.klineData
      }

      // 写入 JSON 文件
      const targetFile = path.join(TARGET_DIR, `${code}.json`)
      fs.writeFileSync(targetFile, JSON.stringify(stockData, null, 0), 'utf-8')

      // 添加到股票列表
      stocks.push({ code, name: result.stockName, file: `${code}.json` })

      successCount++
    } else {
      console.error(`  跳过: 数据为空或解析失败`)
      failCount++
    }
  }

  // 保存股票列表
  const stocksListPath = path.join(TARGET_DIR, 'stocks.json')
  fs.writeFileSync(stocksListPath, JSON.stringify(stocks, null, 0), 'utf-8')

  console.log(`\n转换完成!`)
  console.log(`- 成功: ${successCount} 个`)
  console.log(`- 失败: ${failCount} 个`)
  console.log(`\n股票列表: ${stocksListPath}`)
  console.log(`数据目录: ${TARGET_DIR}`)

  // 计算文件大小
  const totalSize = calculateDirSize(TARGET_DIR)
  console.log(`\n总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
}

// 计算目录大小
function calculateDirSize(dirPath) {
  let totalSize = 0

  function calculateSize(filePath) {
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      const files = fs.readdirSync(filePath)
      files.forEach(file => {
        calculateSize(path.join(filePath, file))
      })
    } else {
      totalSize += stats.size
    }
  }

  const files = fs.readdirSync(dirPath)
  files.forEach(file => {
    calculateSize(path.join(dirPath, file))
  })

  return totalSize
}

// 执行转换
convertAllStocks()
