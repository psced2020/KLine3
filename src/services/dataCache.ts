// 数据缓存服务 - 使用 IndexedDB 持久化存储股票数据

const DB_NAME = 'StockTrainingDB'
const DB_VERSION = 1
const STORE_STOCKS = 'stocks'
const STORE_LIST = 'stockList'

// 股票数据接口
export interface StockCacheData {
  code: string
  name: string
  data: StockDataItem[]
}

// K线数据接口
export interface StockDataItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

// 股票列表项
export interface StockListItem {
  code: string
  name: string
}

class DataCacheService {
  private db: IDBDatabase | null = null

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建股票数据存储
        if (!db.objectStoreNames.contains(STORE_STOCKS)) {
          const stockStore = db.createObjectStore(STORE_STOCKS, { keyPath: 'code' })
          stockStore.createIndex('name', 'name', { unique: false })
        }

        // 创建股票列表存储
        if (!db.objectStoreNames.contains(STORE_LIST)) {
          const listStore = db.createObjectStore(STORE_LIST, { keyPath: 'code' })
          listStore.createIndex('name', 'name', { unique: false })
        }
      }
    }
    })
  }

  // 存入股票数据
  async saveStock(code: string, name: string, data: StockDataItem[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_STOCKS], 'readwrite')
      const store = transaction.objectStore(STORE_STOCKS)
      const request = store.put({ code, name, data })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // 批量存入股票数据
  async saveStocks(stocks: StockCacheData[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_STOCKS, STORE_LIST], 'readwrite')
      const stockStore = transaction.objectStore(STORE_STOCKS)
      const listStore = transaction.objectStore(STORE_LIST)

      let completed = 0
      const total = stocks.length

      stocks.forEach((stock) => {
        const stockRequest = stockStore.put(stock)
        stockRequest.onsuccess = () => {
          completed++
          if (completed === total) {
            // 同时更新股票列表
            const listItem: StockListItem = { code: stock.code, name: stock.name }
            listStore.put(listItem).onsuccess = () => resolve()
          }
        }
        stockRequest.onerror = () => reject(stockRequest.error)
      })
    })
  }

  // 读取股票数据
  async getStock(code: string): Promise<StockCacheData | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_STOCKS], 'readonly')
      const store = transaction.objectStore(STORE_STOCKS)
      const request = store.get(code)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // 读取股票列表
  async getStockList(): Promise<StockListItem[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_LIST], 'readonly')
      const store = transaction.objectStore(STORE_LIST)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // 检查股票是否存在
  async hasStock(code: string): Promise<boolean> {
    const stock = await this.getStock(code)
    return stock !== null
  }

  // 清空股票数据
  async clearAll(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_STOCKS, STORE_LIST], 'readwrite')
      const stockStore = transaction.objectStore(STORE_STOCKS)
      const listStore = transaction.objectStore(STORE_LIST)

      let completed = 0
      const total = 2

      const clearStocks = stockStore.clear()
      clearStocks.onsuccess = () => {
        completed++
        if (completed === total) resolve()
        clearStocks.onerror = () => reject(clearStocks.error)
      }

      const clearList = listStore.clear()
      clearList.onsuccess = () => {
        completed++
        if (completed === total) resolve()
        clearList.onerror = () => reject(clearList.error)
      }
    })
  }

  // 获取统计信息
  async getStats(): Promise<{ stockCount: number; totalDataPoints: number }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_STOCKS], 'readonly')
      const store = transaction.objectStore(STORE_STOCKS)
      const request = store.getAll()

      request.onsuccess = () => {
        const stocks = request.result || []
        let totalDataPoints = 0
        stocks.forEach((stock: any) => {
          totalDataPoints += stock.data?.length || 0
        })
        resolve({ stockCount: stocks.length, totalDataPoints })
      }
      request.onerror = () => reject(request.error)
    })
  }
}

// 导出单例实例
export const dataCache = new DataCacheService()
