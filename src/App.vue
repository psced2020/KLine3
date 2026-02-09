<template>
  <div class="app">
    <div class="settings-panel">
      <!-- 股票代码设置区 -->
      <div class="stock-code-section">
        <div class="stock-code-row">
          <div class="section-label">股票代码：</div>
          <input v-model="stockCode" placeholder="600519" />
          <div class="nav-buttons">
            <button class="nav-btn" @click="navigateStock('prev')" :disabled="!hasPrevStock" title="上一条">
              <svg class="nav-icon" viewBox="0 0 24 24">
                <path d="M12 4l-8 8h6v8h4v-8h6l-8-8z" fill="currentColor"/>
              </svg>
            </button>
            <button class="nav-btn" @click="navigateStock('next')" :disabled="!hasNextStock" title="下一条">
              <svg class="nav-icon" viewBox="0 0 24 24">
                <path d="M12 20l8-8h-6v-8h-4v8h-6l8 8z" fill="currentColor"/>
              </svg>
            </button>
            <button class="nav-btn" @click="navigateStock('random')">随机</button>
          </div>
        </div>
      </div>

      <!-- 训练K线选择区 -->
      <div class="training-bars-section">
        <div class="training-bars-row">
          <div class="section-label">训练K线：</div>
          <div class="training-bars-controls">
            <div class="radio-buttons">
              <button
                v-for="bars in [200, 400]"
                :key="bars"
                class="radio-btn"
                :class="{ active: trainingBars === bars }"
                @click="selectTrainingBars(bars)"
              >
                {{ bars }}
              </button>
            </div>
            <input
              v-model="customTrainingBars"
              type="number"
              min="1"
              class="custom-input"
              placeholder="自定义"
              @input="handleCustomInput"
            />
          </div>
        </div>
      </div>

      <!-- 加载数据按钮 -->
      <button class="load-button" @click="loadStockData()" :disabled="loading">
        加载数据
      </button>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <StockData
      v-if="stockData.length > 0 && currentData"
      :data="currentData"
      :stock-name="stockName"
      :stock-date="formattedCurrentDate"
    />

    <KLineChart
      v-if="stockData.length > 0"
      :data="stockData"
      :current-index="currentIndex"
      :ma10="ma10"
      :ma20="ma20"
      :ma60="ma60"
      :volume-ratio="volumeRatio"
      :turnover-rate="turnoverRate"
      @period-change="handlePeriodChange"
    />

    <TradeButtons
      v-if="stockData.length > 0"
      @buy="handleBuy"
      @sell="handleSell"
      @watch="handleWatch"
    />

    <TradeStats
      v-if="stockData.length > 0"
      :stats="tradeStats"
      :elapsed-time="elapsedTime"
      :remaining-bars="remainingBars"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import StockData from './components/StockData.vue'
import KLineChart from './components/KLineChart.vue'
import TradeButtons from './components/TradeButtons.vue'
import TradeStats from './components/TradeStats.vue'

interface StockDataItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

// 设置
const stockCode = ref('600519')
const stockName = ref('')
const currentDate = ref('')
const trainingDate = ref('')
const currentPeriod = ref('周K')
const trainingBars = ref(200)
const customTrainingBars = ref('')

// 股票列表和导航
const stockList = ref<string[]>([])
const currentStockIndex = ref(-1)

// 计算是否有上一条/下一条（基于当前股票代码在列表中的位置）
const hasPrevStock = computed(() => {
  if (stockList.value.length === 0) return false
  const idx = stockList.value.indexOf(stockCode.value)
  return idx > 0
})

const hasNextStock = computed(() => {
  if (stockList.value.length === 0) return false
  const idx = stockList.value.indexOf(stockCode.value)
  return idx >= 0 && idx < stockList.value.length - 1
})

// 星期数组
const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

// 获取日期的星期几
function getWeekDay(dateStr: string): string {
  const formattedDate = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
  const date = new Date(formattedDate)
  return weekDays[date.getDay()]
}

// 带星期的日期格式
const formattedCurrentDate = computed(() => {
  if (!currentData.value) return ''
  const displayDate = currentData.value.date
  return `${displayDate} ${getWeekDay(displayDate)}`
})

// 本地存储所有周期的数据
const allPeriodData = ref<Record<string, StockDataItem[]>>({})

const loading = ref(false)
const errorMessage = ref('')

// 股票数据
const stockData = ref<StockDataItem[]>([])
const currentIndex = ref(0)

const currentData = computed(() => {
  if (stockData.value.length === 0 || currentIndex.value < 0 || currentIndex.value >= stockData.value.length) {
    return undefined
  }
  return stockData.value[currentIndex.value]
})

// 指标
const ma10 = ref(0)
const ma20 = ref(0)
const ma60 = ref(0)
const kdj = ref({ K: 0, D: 0, J: 0 })
const volumeRatio = ref(0)
const turnoverRate = ref(0)

// 状态
const remainingBars = ref(0)

// 交易统计
const tradeStats = ref({
  money: 1000000,
  shares: 0,
  buyPrice: 0,
  currentReturn: 0,
  positionReturn: 0
})

// 格式化日期
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 计算均线
function calculateMA(data: StockDataItem[], dayCount: number, index: number): number {
  if (index < dayCount - 1) return 0
  let sum = 0
  for (let i = 0; i < dayCount; i++) {
    sum += data[index - i].close
  }
  return sum / dayCount
}

// 计算KDJ
function calculateKDJ(data: StockDataItem[]) {
  const K: number[] = []
  const D: number[] = []
  const J: number[] = []
  const n = 9

  for (let i = 0; i < data.length; i++) {
    let high = -Infinity
    let low = Infinity
    const startIndex = Math.max(0, i - n + 1)

    for (let j = startIndex; j <= i; j++) {
      high = Math.max(high, data[j].high)
      low = Math.min(low, data[j].low)
    }

    const RSV = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100

    if (i === 0) {
      K.push(RSV / 3 + 50)
      D.push(RSV / 3 + 50)
    } else {
      K.push(RSV / 3 + K[i - 1] * (2 / 3))
      D.push(K[i] / 3 + D[i - 1] * (2 / 3))
    }

    J.push(3 * K[i] - 2 * D[i])
  }

  return { K, D, J }
}

// 更新当前数据指标
function updateIndicators() {
  if (!stockData.value.length || currentIndex.value < 0 || currentIndex.value >= stockData.value.length) return

  const idx = currentIndex.value

  ma10.value = calculateMA(stockData.value, 10, idx)
  ma20.value = calculateMA(stockData.value, 20, idx)
  ma60.value = calculateMA(stockData.value, 60, idx)

  const kdjData = calculateKDJ(stockData.value)
  // 获取当前索引的 KDJ 值
  if (idx < kdjData.K.length) {
    kdj.value = {
      K: kdjData.K[idx],
      D: kdjData.D[idx],
      J: kdjData.J[idx]
    }
  }

  if (idx > 0 && stockData.value[idx]) {
    const avgVolume = stockData.value.slice(Math.max(0, idx - 5), idx)
      .reduce((sum, d) => sum + d.volume, 0) / Math.min(5, idx)
    volumeRatio.value = avgVolume > 0 ? stockData.value[idx].volume / avgVolume : 0
    turnoverRate.value = (stockData.value[idx].volume / 1000000000 * 100)
  }
}

// 选择训练K线数量
function selectTrainingBars(bars: number) {
  trainingBars.value = bars
  customTrainingBars.value = ''
}

// 处理自定义训练K线输入
function handleCustomInput() {
  const value = parseInt(customTrainingBars.value)
  if (value > 0 && !isNaN(value)) {
    trainingBars.value = value
  }
}

// 加载股票列表
async function loadStockList() {
  try {
    const response = await fetch('/export/stocks.json')
    if (!response.ok) {
      throw new Error('获取股票列表失败')
    }
    const stocks = await response.json()
    stockList.value = stocks.map((item: any) => item.code)
    console.log('股票列表加载成功，共', stockList.value.length, '只股票')
    // 保存到 localStorage
    localStorage.setItem('stockList', JSON.stringify(stockList.value))
  } catch (error: any) {
    console.error('加载股票列表失败:', error.message)
  }
}

// 股票导航
function navigateStock(direction: 'prev' | 'next' | 'random') {
  if (stockList.value.length === 0) {
    alert('股票列表未加载，请稍后再试')
    return
  }

  // 获取当前股票在列表中的位置
  const idx = stockList.value.indexOf(stockCode.value)

  if (direction === 'prev') {
    if (idx > 0) {
      currentStockIndex.value = idx - 1
      stockCode.value = stockList.value[currentStockIndex.value]
      loadStockData()
    }
  } else if (direction === 'next') {
    if (idx < stockList.value.length - 1) {
      currentStockIndex.value = idx + 1
      stockCode.value = stockList.value[currentStockIndex.value]
      loadStockData()
    }
  } else if (direction === 'random') {
    const randomIndex = Math.floor(Math.random() * stockList.value.length)
    currentStockIndex.value = randomIndex
    stockCode.value = stockList.value[randomIndex]
    loadStockData()
  }
}

// 将日K数据转换为周K数据
function convertToWeeklyData(dailyData: StockDataItem[]): StockDataItem[] {
  const weeklyData: StockDataItem[] = []
  let currentWeek: StockDataItem[] = []
  let lastWeekNum = 0

  dailyData.forEach((item) => {
    const date = new Date(
      parseInt(item.date.substring(0, 4)),
      parseInt(item.date.substring(4, 6)) - 1,
      parseInt(item.date.substring(6, 8))
    )
    const weekNum = getWeekNumber(date)

    if (weekNum !== lastWeekNum && currentWeek.length > 0) {
      // 合并一周的数据
      weeklyData.push(mergeWeekData(currentWeek))
      currentWeek = []
    }

    currentWeek.push(item)
    lastWeekNum = weekNum
  })

  // 添加最后一周的数据
  if (currentWeek.length > 0) {
    weeklyData.push(mergeWeekData(currentWeek))
  }

  return weeklyData
}

// 合并一周的数据
function mergeWeekData(weekData: StockDataItem[]): StockDataItem {
  return {
    date: weekData[weekData.length - 1].date, // 使用周五的日期
    open: weekData[0].open, // 周一开盘
    high: Math.max(...weekData.map(d => d.high)), // 本周最高
    low: Math.min(...weekData.map(d => d.low)), // 本周最低
    close: weekData[weekData.length - 1].close, // 周五收盘
    volume: weekData.reduce((sum, d) => sum + d.volume, 0) // 本周总成交量
  }
}
// 合并一月的数据
function mergeMonthData(monthData: StockDataItem[]): StockDataItem {
  return {
    date: monthData[monthData.length - 1].date, // 使用月末的日期
    open: monthData[0].open, // 月初开盘
    high: Math.max(...monthData.map(d => d.high)), // 本月最高
    low: Math.min(...monthData.map(d => d.low)), // 本月最低
    close: monthData[monthData.length - 1].close, // 月末收盘
    volume: monthData.reduce((sum, d) => sum + d.volume, 0) // 本月总成交量
  }
}

// 将日K数据转换为月K数据
function convertToMonthlyData(dailyData: StockDataItem[]): StockDataItem[] {
  const monthlyData: StockDataItem[] = []
  let currentMonth: StockDataItem[] = []
  let lastMonthKey = ''

  dailyData.forEach((item) => {
    const monthKey = item.date.substring(0, 6) // YYYYMM

    if (monthKey !== lastMonthKey && currentMonth.length > 0) {
      monthlyData.push(mergeMonthData(currentMonth))
      currentMonth = []
    }

    currentMonth.push(item)
    lastMonthKey = monthKey
  })

  // 添加最后一月的数据
  if (currentMonth.length > 0) {
    monthlyData.push(mergeMonthData(currentMonth))
  }

  return monthlyData
}

// 获取日期所在的周数
function getWeekNumber(date: Date): number {
  const onejan = new Date(date.getFullYear(), 0, 1)
  return Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
}

// 加载股票数据（使用本地数据源）
async function loadStockData() {
  console.log('loadStockData 被调用，股票代码:', stockCode.value, '训练K线数:', trainingBars.value)

  loading.value = true
  errorMessage.value = ''

  try {
    // 从本地 JSON 文件获取数据
    const response = await fetch(`/export/${stockCode.value}.json`)

    if (!response.ok) {
      throw new Error('获取数据失败')
    }

    const jsonData = await response.json()

    console.log('本地数据响应:', jsonData)

    // 转换数据格式: 紧凑数组 → 对象
    const data: StockDataItem[] = jsonData.data.map((item: any[]) => ({
      date: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5]
    }))
    console.log('本地数据条数:', data.length)

    if (data.length === 0) {
      throw new Error('未获取到股票数据')
    }

    // 数据已经是按日期排序的
    allPeriodData.value = {
      '日K': data,
      '周K': convertToWeeklyData(data),
      '月K': convertToMonthlyData(data)
    }

    stockData.value = allPeriodData.value[currentPeriod.value]

    // 根据训练K线数量计算显示位置（使用当前周期数据的长度）
    const currentPeriodData = allPeriodData.value[currentPeriod.value]
    const totalBars = currentPeriodData.length
    const trainCount = trainingBars.value

    if (totalBars <= trainCount) {
      // 数据不足，所有K线都用于训练，初始界面为空
      currentIndex.value = 0
      console.log('数据不足，所有K线都用于训练，初始界面为空')
    } else {
      // 显示训练数据之前的最后一根K线
      currentIndex.value = totalBars - trainCount - 1
      console.log('设置初始位置:', currentIndex.value)
    }

    // 更新训练日期
    if (currentIndex.value >= 0 && currentIndex.value < totalBars) {
      trainingDate.value = currentPeriodData[currentIndex.value].date
    }

    remainingBars.value = totalBars - currentIndex.value - 1

    // 更新当前数据的指标
    updateIndicators()

    // 从股票信息中提取股票名称
    if (jsonData.name) {
      stockName.value = jsonData.name
    } else {
      stockName.value = stockCode.value
    }

    // 更新当前股票在列表中的索引
    const stockIndex = stockList.value.indexOf(stockCode.value)
    if (stockIndex !== -1) {
      currentStockIndex.value = stockIndex
    }

    // 重置交易统计
    tradeStats.value = {
      money: 1000000,
      shares: 0,
      buyPrice: 0,
      currentReturn: 0,
      positionReturn: 0
    }

    // 重置计时
    elapsedSeconds.value = 5

    console.log('数据加载完成，总条数:', data.length)
  } catch (error: any) {
    console.error('加载失败:', error)
    errorMessage.value = '加载失败: ' + (error.message || '请检查本地服务器是否运行')
  } finally {
    loading.value = false
  }
}

// 加载数据（观望时新增）
function handleWatch() {
  console.log('观望')
  if (currentIndex.value < stockData.value.length - 1) {
    currentIndex.value++
    remainingBars.value = stockData.value.length - currentIndex.value - 1
    trainingDate.value = stockData.value[currentIndex.value].date
    updateIndicators()
  }
}

function handlePeriodChange(period: string) {
  console.log('切换周期:', period, '当前训练日期:', trainingDate.value)
  if (currentPeriod.value !== period) {
    currentPeriod.value = period
    // 切换到对应周期的数据
    const newData = allPeriodData.value[period]
    if (newData && newData.length > 0) {
      stockData.value = newData
      // 重置到新周期数据的开头
      currentIndex.value = Math.max(0, newData.length - trainingBars.value - 1)
      // 更新训练日期
      if (currentIndex.value >= 0 && currentIndex.value < newData.length) {
        trainingDate.value = newData[currentIndex.value].date
      }
      remainingBars.value = newData.length - currentIndex.value - 1
      updateIndicators()
    }
  }
}

function handleBuy() {
  console.log('买入', currentData.value.close)
  if (tradeStats.value.money > 0 && tradeStats.value.shares === 0 && currentData.value) {
    const pricePerLot = currentData.value.close * 100
    const lots = Math.floor(tradeStats.value.money / pricePerLot)
    const shares = lots * 100
    tradeStats.value.shares = shares
    tradeStats.value.buyPrice = currentData.value.close
    tradeStats.value.money = tradeStats.value.money - shares * currentData.value.close
    console.log(`买入成功: ${shares}股, 价格: ${currentData.value.close}, 花费: ${shares * currentData.value.close}`)
  }
}

function handleSell() {
  console.log('卖出', currentData.value.close)
  if (tradeStats.value.shares > 0 && currentData.value) {
    tradeStats.value.money = tradeStats.value.money + tradeStats.value.shares * currentData.value.close
    tradeStats.value.shares = 0
    tradeStats.value.buyPrice = 0
  }
}

// 计算收益率
function calculateReturns() {
  if (!currentData.value || currentData.value.close <= 0) return

  const totalValue = tradeStats.value.money + tradeStats.value.shares * currentData.value.close
  const initialMoney = 1000000
  tradeStats.value.currentReturn = ((totalValue - initialMoney) / initialMoney) * 100

  if (tradeStats.value.shares > 0 && tradeStats.value.buyPrice > 0) {
    tradeStats.value.positionReturn = ((currentData.value.close - tradeStats.value.buyPrice) / tradeStats.value.buyPrice) * 100
  } else {
    tradeStats.value.positionReturn = 0
  }
}

// 监听价格变化，更新收益率和指标
watch(currentData, () => {
  if (currentData.value) {
    calculateReturns()
    currentDate.value = currentData.value.date
    updateIndicators()
  }
})

// 监听股票代码变化，清空缓存并保存到 localStorage
watch(stockCode, (newCode) => {
  console.log('股票代码变化，清空缓存')
  allPeriodData.value = {}
  trainingDate.value = ''
  stockData.value = []
  // 保存到 localStorage
  if (newCode) {
    localStorage.setItem('lastStockCode', newCode)
  }
})

// 时间计时（秒数）
const elapsedSeconds = ref(5)

// 格式化显示的计时文本
const elapsedTime = computed(() => `${elapsedSeconds.value}秒`)

let timer: number | null = null
onMounted(() => {
  // 从 localStorage 恢复股票列表（如果存在）
  const savedStockList = localStorage.getItem('stockList')
  if (savedStockList) {
    try {
      stockList.value = JSON.parse(savedStockList)
      console.log('从 localStorage 恢复股票列表，共', stockList.value.length, '只股票')
    } catch (e) {
      console.error('解析股票列表失败:', e)
    }
  }

  // 从 localStorage 恢复上次股票代码（如果存在）
  const savedStockCode = localStorage.getItem('lastStockCode')
  if (savedStockCode) {
    stockCode.value = savedStockCode
  }

  // 加载股票列表（更新最新数据）
  loadStockList()

  timer = window.setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.app {
  max-width: 480px;
  margin: 0 auto;
  background: var(--bg-light);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.settings-panel {
  background: #fff;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.stock-code-section {
  margin-bottom: 15px;
}

.section-label {
  font-size: 14px;
  color: #666;
}

.stock-code-section .section-label,
.training-bars-section .section-label {
  margin-bottom: 0;
}

.stock-code-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.stock-code-row input {
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  width: 100px;
}

.nav-buttons {
  display: flex;
  gap: 8px;
}

.nav-btn {
  padding: 8px 12px;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon {
  width: 18px;
  height: 18px;
}

.nav-btn:has(.nav-icon) {
  padding: 8px;
}

.nav-btn:hover:not(:disabled) {
  background: #e0e0e0;
  border-color: #ccc;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.radio-buttons {
  display: flex;
  gap: 20px;
}

.training-bars-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.custom-input {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  width: 80px;
}

.custom-input:focus {
  outline: none;
  border-color: var(--primary-purple);
}

.radio-btn {
  padding: 6px 16px;
  border-radius: 12px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-btn.active {
  background: var(--primary-purple);
  color: #fff;
}

.radio-btn:hover:not(.active) {
  background: #f0f0f0;
}

.radio-btn.active:hover {
  background: var(--dark-purple);
}

.training-bars-section {
  margin-bottom: 15px;
}

.training-bars-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.section-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.hint-text {
  margin: 12px 0 0;
  font-size: 13px;
  color: #999;
  text-align: center;
}

.load-button {
  width: 100%;
  padding: 12px;
  background: var(--primary-purple);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.2s;
}

.load-button:hover:not(:disabled) {
  background: var(--dark-purple);
}

.load-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--price-red);
  text-align: center;
}
</style>
