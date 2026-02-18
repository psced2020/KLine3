<template>
  <div class="kline-chart">
    <div ref="chartRef" class="chart-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

interface StockData {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

interface Props {
  data: StockData[]
  currentIndex?: number
  ma10?: number
  ma20?: number
  ma60?: number
  volumeRatio?: number
  turnoverRate?: number
  currentPeriod?: string
}

const props = defineProps<Props>()

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

// Grid 3 指标类型：'macd-v' 或 'macd'
const indicatorType = ref<'macd-v' | 'macd'>('macd-v')

// 计算均线
function calculateMA(data: StockData[], dayCount: number): (number | null)[] {
  const ma: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < dayCount - 1) {
      ma.push(null) // 前19天设为null，不绘制
    } else {
      let sum = 0
      for (let j = 0; j < dayCount; j++) {
        sum += data[i - j].close
      }
      ma.push(sum / dayCount)
    }
  }
  return ma
}

// 计算KDJ
function calculateKDJ(data: StockData[]) {
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

// 计算EMA（指数移动平均线）
function calculateEMA(data: StockData[], period: number): number[] {
  const ema: number[] = []
  const k = 2 / (period + 1)

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i].close)
    } else {
      ema.push(data[i].close * k + ema[i - 1] * (1 - k))
    }
  }

  return ema
}

// 计算VEMA（成交量指数加权EMA）
// 公式：VEMA_t = (α * P_t * V_t + (1-α) * VEMA_{t-1}) / (α * V_t + (1-α))
function calculateVEMA(data: StockData[], period: number): number[] {
  const alpha = 2 / (period + 1)  // α = 2 / (N+1)
  const vema: number[] = []

  // 初始化：使用第一天的收盘价
  vema[0] = data[0].close

  // 计算成交量的中位数用于归一化
  const volumes = data.map(d => d.volume)
  volumes.sort((a, b) => a - b)
  const medianVolume = volumes[Math.floor(volumes.length / 2)]

  for (let i = 1; i < data.length; i++) {
    const price = data[i].close
    const vol = data[i].volume

    // 成交量归一化：相对于中位数的比例，使值在合理范围内
    const normalizedVol = vol / medianVolume

    // 分子：价格×成交量进入指数衰减
    const numerator = alpha * price * normalizedVol + (1 - alpha) * vema[i - 1]

    // 分母：成交量也指数衰减
    const denominator = alpha * normalizedVol + (1 - alpha)

    // VEMA = 指数衰减的 VWAP
    vema[i] = denominator !== 0 ? numerator / denominator : vema[i - 1]
  }

  return vema
}

// 计算MACD-V（成交量加权MACD）- 严格指数结构版本
function calculateMACDV(data: StockData[]) {
  // Step 3-4: 计算快线和慢线的 VEMA
  const vema12 = calculateVEMA(data, 12)  // 快线 VEMA12
  const vema26 = calculateVEMA(data, 26)  // 慢线 VEMA26

  // Step 5: 计算 DIF
  const dif: number[] = []
  for (let i = 0; i < data.length; i++) {
    dif.push(vema12[i] - vema26[i])
  }

  // Step 6: 计算 DEA（标准 EMA 结构，9日）
  const alpha9 = 2 / (9 + 1)  // α_9 = 0.2
  const dea: number[] = []
  for (let i = 0; i < dif.length; i++) {
    if (i === 0) {
      dea.push(dif[i])
    } else {
      dea.push(alpha9 * dif[i] + (1 - alpha9) * dea[i - 1])
    }
  }

  // Step 7: 计算 MACD 柱状图
  const macd: number[] = []
  for (let i = 0; i < dif.length; i++) {
    macd.push((dif[i] - dea[i]) * 2)
  }

  return { DIF: dif, DEA: dea, MACD: macd }
}

// 计算标准MACD（使用EMA）
function calculateMACD(data: StockData[]) {
  const ema12 = calculateEMA(data, 12)
  const ema26 = calculateEMA(data, 26)
  const dif: number[] = []
  const dea: number[] = []
  const macd: number[] = []

  for (let i = 0; i < data.length; i++) {
    dif.push(ema12[i] - ema26[i])

    if (i === 0) {
      dea.push(dif[i])
    } else {
      dea.push(dif[i] * 0.2 + dea[i - 1] * 0.8)
    }

    macd.push((dif[i] - dea[i]) * 2)
  }

  return { DIF: dif, DEA: dea, MACD: macd }
}

// 切换 Grid 3 指标类型
function toggleIndicator() {
  indicatorType.value = indicatorType.value === 'macd-v' ? 'macd' : 'macd-v'
  renderChart()
}

// 处理图表区域的双击事件
function handleChartDblClick(event: MouseEvent) {
  if (!chartRef.value) return

  // 获取图表容器的边界
  const containerRect = chartRef.value.getBoundingClientRect()

  // 计算鼠标相对于容器的坐标
  const offsetX = event.clientX - containerRect.left
  const offsetY = event.clientY - containerRect.top

  // Grid 3 区域: top: '81%', height: '15%'
  // 即从 81% 到 96% (81% + 15%)
  const grid3TopPercent = 0.81
  const grid3BottomPercent = 0.96

  const relativeY = offsetY / containerRect.height

  // 检查是否在 Grid 3 的 Y 坐标范围内
  if (relativeY >= grid3TopPercent && relativeY <= grid3BottomPercent) {
    // 同时检查 X 坐标范围（left: 10%, right: 10%，即 10% 到 90%）
    const grid3LeftPercent = 0.10
    const grid3RightPercent = 0.90
    const relativeX = offsetX / containerRect.width

    if (relativeX >= grid3LeftPercent && relativeX <= grid3RightPercent) {
      toggleIndicator()
    }
  }
}

function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  renderChart()
  window.addEventListener('resize', handleResize)
  // 在图表容器上添加双击事件监听
  chartRef.value.addEventListener('dblclick', handleChartDblClick)
}

function renderChart() {
  if (!chart || !props.data.length) return

  // 只显示到当前索引的数据
  const displayIndex = props.currentIndex ?? props.data.length - 1
  const displayData = props.data.slice(0, displayIndex + 1)

  const dates = displayData.map((item) => item.date)
  const values = displayData.map((item) => [item.open, item.close, item.low, item.high])
  const volumes = displayData.map((item, index) => [index, item.volume, item.open > item.close ? 1 : -1])

  const { K, D, J } = calculateKDJ(displayData)
  // 根据指标类型计算 MACD 数据
  const macdData = indicatorType.value === 'macd-v'
    ? calculateMACDV(displayData)
    : calculateMACD(displayData)
  const { DIF, DEA, MACD } = macdData
  const ma20 = calculateMA(displayData, 20)
  const ma60 = calculateMA(displayData, 60)

  // 计算默认显示最近60根K线，如果数据量少于60则显示全部
  const defaultVisibleCount = 60
  const dataCount = displayData.length
  const zoomStart = dataCount > defaultVisibleCount
    ? Math.round((1 - defaultVisibleCount / dataCount) * 100)
    : 0

  const option: echarts.EChartsOption = {
    grid: [
      { left: '10%', right: '10%', top: '10%', height: '36%' },
      { left: '10%', right: '10%', top: '49%', height: '12%' },
      { left: '10%', right: '10%', top: '64%', height: '15%' },
      { left: '10%', right: '10%', top: '81%', height: '15%' }
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: { show: false }
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: { show: false }
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 2,
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: { show: false }
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 3,
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: {
          color: '#666',
          fontSize: 11
        }
      }
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
        splitNumber: 5,
        axisLine: { lineStyle: { color: '#ddd' } },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        axisLabel: {
          color: '#666',
          formatter: (value: number) => value.toFixed(2)
        }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLine: { lineStyle: { color: '#ddd' } },
        splitLine: { show: false },
        axisLabel: { show: false }
      },
      {
        scale: true,
        gridIndex: 2,
        splitNumber: 4,
        min: -20,
        max: 120,
        axisLine: { lineStyle: { color: '#ddd' } },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        axisLabel: {
          color: '#666'
        }
      },
      {
        scale: true,
        gridIndex: 3,
        splitNumber: 4,
        axisLine: { lineStyle: { color: '#ddd' } },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        axisLabel: {
          color: '#666',
          formatter: (value: number) => value.toFixed(2)
        }
      }
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1, 2, 3],
        start: zoomStart,
        end: 100
      }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#00C853',
          color0: '#FF3D00',
          borderColor: '#00C853',
          borderColor0: '#FF3D00'
        }
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#2196F3', width: 1.5 }
      },
      {
        name: 'MA60',
        type: 'line',
        data: ma60,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#9C27B0', width: 1.5 }
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: {
          color: (params: any) => (params.data[2] === 1 ? '#00C853' : '#FF3D00')
        }
      },
      {
        name: 'K',
        type: 'line',
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: K,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#2196F3', width: 1.5 }
      },
      {
        name: 'D',
        type: 'line',
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: D,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#FFC107', width: 1.5 }
      },
      {
        name: 'J',
        type: 'line',
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: J,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#FF3D00', width: 1.5 }
      },
      {
        name: 'DIF',
        type: 'line',
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: DIF,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#2196F3', width: 1.5 }
      },
      {
        name: 'DEA',
        type: 'line',
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: DEA,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#333333', width: 1.5 }
      },
      {
        name: 'MACD',
        type: 'bar',
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: MACD,
        itemStyle: {
          color: (params: any) => (params.data >= 0 ? '#00C853' : '#FF3D00')
        }
      }
    ],
    graphic: displayData.length > 0 ? (() => {
      const current = displayData[displayData.length - 1]
      const baseStyle = {
        fontSize: 11,
        fontWeight: 400
      }
      const labelStyle = {
        fontSize: 11,
        fontWeight: 400,
        fill: '#999'
      }
      const valueStyle = {
        fontSize: 12,
        fontWeight: 600,
        fill: '#333'
      }

      return [
        {
          type: 'text',
          left: '10%',
          top: '1%',
          style: { ...baseStyle, ...labelStyle, text: '开盘' }
        },
        {
          type: 'text',
          left: '28%',
          top: '1%',
          style: { ...baseStyle, ...labelStyle, text: '最高' }
        },
        {
          type: 'text',
          left: '46%',
          top: '1%',
          style: { ...baseStyle, ...labelStyle, text: '最低' }
        },
        {
          type: 'text',
          left: '64%',
          top: '1%',
          style: { ...baseStyle, ...labelStyle, text: 'MA20' }
        },
        {
          type: 'text',
          left: '82%',
          top: '1%',
          style: { ...baseStyle, ...labelStyle, text: 'MA60' }
        },
        {
          type: 'text',
          left: '10%',
          top: '4%',
          style: { ...baseStyle, ...valueStyle, text: current?.open.toFixed(2) || '-' }
        },
        {
          type: 'text',
          left: '28%',
          top: '4%',
          style: { ...baseStyle, ...valueStyle, text: current?.high.toFixed(2) || '-' }
        },
        {
          type: 'text',
          left: '46%',
          top: '4%',
          style: { ...baseStyle, ...valueStyle, text: current?.low.toFixed(2) || '-' }
        },
        {
          type: 'text',
          left: '64%',
          top: '4%',
          style: { ...baseStyle, ...valueStyle, text: (props.ma20 || 0).toFixed(2) }
        },
        {
          type: 'text',
          left: '82%',
          top: '4%',
          style: { ...baseStyle, ...valueStyle, text: (props.ma60 || 0).toFixed(2) }
        },
        {
          type: 'text',
          left: '10%',
          top: '47%',
          style: { ...baseStyle, ...labelStyle, text: 'VOL' }
        },
        {
          type: 'text',
          left: '40%',
          top: '47%',
          style: { ...baseStyle, ...labelStyle, text: '换手' }
        },
        {
          type: 'text',
          left: '75%',
          top: '47%',
          style: { ...baseStyle, ...labelStyle, text: '量比' }
        },
        {
          type: 'text',
          left: '10%',
          top: '50%',
          style: { ...baseStyle, ...valueStyle, text: (current?.volume / 10000).toFixed(2) + '万' }
        },
        {
          type: 'text',
          left: '40%',
          top: '50%',
          style: { ...baseStyle, ...valueStyle, text: (props.turnoverRate || 0).toFixed(2) + '%' }
        },
        {
          type: 'text',
          left: '75%',
          top: '50%',
          style: { ...baseStyle, ...valueStyle, text: (props.volumeRatio || 0).toFixed(2) }
        },
        {
          type: 'text',
          left: '10%',
          top: '62%',
          style: { ...baseStyle, ...valueStyle, fill: '#2196F3', text: `K：${K[K.length - 1]?.toFixed(2) || '-'}` }
        },
        {
          type: 'text',
          left: '40%',
          top: '62%',
          style: { ...baseStyle, ...valueStyle, fill: '#FFC107', text: `D：${D[D.length - 1]?.toFixed(2) || '-'}` }
        },
        {
          type: 'text',
          left: '70%',
          top: '62%',
          style: { ...baseStyle, ...valueStyle, fill: '#FF3D00', text: `J：${J[J.length - 1]?.toFixed(2) || '-'}` }
        },
        {
          type: 'text',
          left: '10%',
          top: '79%',
          style: { ...baseStyle, ...valueStyle, fill: '#2196F3', text: `DIF：${DIF[DIF.length - 1]?.toFixed(2) || '-'}` }
        },
        {
          type: 'text',
          left: '40%',
          top: '79%',
          style: { ...baseStyle, ...valueStyle, fill: '#333333', text: `DEA：${DEA[DEA.length - 1]?.toFixed(2) || '-'}` }
        },
        {
          type: 'text',
          left: '70%',
          top: '79%',
          style: { ...baseStyle, ...valueStyle, fill: MACD[MACD.length - 1] >= 0 ? '#00C853' : '#FF3D00', text: `${indicatorType.value.toUpperCase()}：${MACD[MACD.length - 1]?.toFixed(2) || '-'}` }
        }
      ]
    })() : undefined
  }

  // 使用 notMerge: false 来平滑更新，避免闪烁
  chart.setOption(option, { notMerge: false })
}

function handleResize() {
  chart?.resize()
}

watch(() => props.data, () => {
  renderChart()
}, { deep: true })

watch(() => props.currentIndex, () => {
  renderChart()
})

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', handleResize)
  if (chartRef.value) {
    chartRef.value.removeEventListener('dblclick', handleChartDblClick)
  }
})
</script>

<style scoped>
.kline-chart {
  background: #fff;
}

.chart-container {
  width: 100%;
  height: 450px;
}
</style>
