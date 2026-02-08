// 数据解析工具 - 解析 GBK 编码的 txt 文件

import iconv from 'iconv-lite'
import type { StockDataItem } from '../services/dataCache'

/**
 * 解析股票数据文件
 * @param fileContent - 文件内容（ArrayBuffer）
 * @returns 解析后的股票数据对象
 */
export function parseStockFile(fileName: string, fileContent: ArrayBuffer): {
  code: string
  name: string
  data: StockDataItem[]
} | null {
  try {
    // GBK 转码
    const content = iconv.decode(new Uint8Array(fileContent), 'gbk')
    const lines = content.split('\n').filter(line => line.trim())

    // 格式检查：至少3行
    if (lines.length < 3) {
      console.error(`文件格式错误: ${fileName}`)
      return null
    }

    // 第1行：股票信息
    const infoLine = lines[0]
    const nameMatch = infoLine.match(/([^\s]+)\s+([^\s]+)\s+([^\s]+)/)
    const stockName = nameMatch ? nameMatch[2] : ''

    // 第2行：表头，跳过
    // 从第3行开始是数据：日期, 开盘, 最高, 最低, 收盘, 成交量, 成交额
    const dataLines = lines.slice(2)

    const stockData: StockDataItem[] = []

    for (const line of dataLines) {
      const parts = line.trim().split(',')
      if (parts.length < 6) continue

      const date = parts[0]
      const open = parseFloat(parts[1])
      const high = parseFloat(parts[2])
      const low = parseFloat(parts[3])
      const close = parseFloat(parts[4])
      const volume = parseInt(parts[5]) || 0

      // 数据验证
      if (!date || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue
      }

      stockData.push({
        date,
        open,
        high,
        low,
        close,
        volume
      })
    }

    // 提取股票代码
    const code = fileName
      .replace('.txt', '')
      .replace('SH', '')
      .replace('SZ', '')

    return {
      code,
      name: stockName,
      data: stockData
    }
  } catch (error) {
    console.error(`解析文件失败: ${fileName}`, error)
    return null
  }
}

/**
 * 批量解析多个文件
 * @param files - 文件列表 { name: string, content: ArrayBuffer }[]
 * @returns 解析后的股票数据数组
 */
export async function parseMultipleFiles(
  files: { name: string; content: ArrayBuffer }[]
): Promise<{
  code: string
  name: string
  data: StockDataItem[]
}[]> {
  const results: ReturnType<typeof parseStockFile>[] = []

  for (const file of files) {
    const result = parseStockFile(file.name, file.content)
    if (result) {
      results.push(result)
    }
  }

  return results
}

/**
 * 从文件夹读取文件（支持 webkitdirectory）
 * @param directoryHandle - 文件夹句柄
 * @returns 解析后的股票数据数组
 */
export async function parseDirectoryFiles(
  directoryHandle: any
): Promise<{
  code: string
  name: string
  data: StockDataItem[]
}[]> {
  const results: ReturnType<typeof parseStockFile>[] = []

  try {
    for await (const [name, handle] of Object.entries(directoryHandle)) {
      if (name.endsWith('.txt')) {
        const fileHandle = await directoryHandle[name].getFile()
        const content = await fileHandle.arrayBuffer()
        const result = parseStockFile(name, content)
        if (result) {
          results.push(result)
        }
      }
    }
  } catch (error) {
    console.error('读取文件夹失败:', error)
  }

  return results
}

/**
 * 验证数据格式
 * @param data - 股票数据数组
 * @returns 是否有效
 */
export function validateStockData(data: StockDataItem[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    return false
  }

  // 检查每条数据
  for (const item of data) {
    if (
      !item.date ||
      typeof item.open !== 'number' ||
      typeof item.high !== 'number' ||
      typeof item.low !== 'number' ||
      typeof item.close !== 'number' ||
      typeof item.volume !== 'number'
    ) {
      return false
    }
  }

  return true
}
