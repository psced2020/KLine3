<template>
  <div class="trade-stats">
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-label">资金量</div>
        <div class="stat-value">{{ formatMoney(stats.money) }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">股数</div>
        <div class="stat-value">{{ stats.shares }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">买入价</div>
        <div class="stat-value">{{ stats.buyPrice.toFixed(2) }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">现价</div>
        <div :class="['stat-value', priceChangeClass]">{{ currentPrice }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">涨跌</div>
        <div :class="['stat-value', priceChangeClass]">{{ priceChange }}%</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-label">本局收益</div>
        <div :class="['stat-value', stats.currentReturn >= 0 ? 'positive' : 'negative']">
          {{ stats.currentReturn >= 0 ? '+' : '' }}{{ stats.currentReturn.toFixed(2) }}%
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-label">开仓收益</div>
        <div :class="['stat-value', stats.positionReturn >= 0 ? 'positive' : 'negative']">
          {{ stats.positionReturn >= 0 ? '+' : '' }}{{ stats.positionReturn.toFixed(2) }}%
        </div>
      </div>
      <div class="stat-item stock-info">
        <div class="stock-name">{{ stockName }}</div>
        <div class="stock-date">{{ stockDate }}</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-label">用时</div>
        <div class="stat-value">{{ elapsedTime }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">剩余K线</div>
        <div class="stat-value">{{ remainingBars }}根</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TradeStats {
  money: number
  shares: number
  buyPrice: number
  currentReturn: number
  positionReturn: number
}

interface StockDataItem {
  open: number
  close: number
  high: number
  low: number
  volume: number
}

interface Props {
  stats: TradeStats
  elapsedTime: string
  remainingBars: number
  stockData?: StockDataItem
  stockName?: string
  stockDate?: string
}

const props = defineProps<Props>()

const currentPrice = computed(() => props.stockData?.close.toFixed(2) || '-')
const priceChange = computed(() => {
  if (!props.stockData) return '-'
  const change = props.stockData.close - props.stockData.open
  const percent = (change / props.stockData.open) * 100
  return (change >= 0 ? '+' : '') + percent.toFixed(2)
})
const priceChangeClass = computed(() => {
  if (!props.stockData) return ''
  const change = props.stockData.close - props.stockData.open
  if (change > 0) return 'price-up'
  if (change < 0) return 'price-down'
  return 'price-neutral'
})

function formatMoney(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  }
  return value.toFixed(2)
}
</script>

<style scoped>
.trade-stats {
  background: var(--primary-purple);
  color: #fff;
  padding: 12px 16px;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  margin-bottom: 12px;
}

.stats-row:last-child {
  margin-bottom: 0;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-label {
  font-size: 11px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
}

.positive {
  color: #81C784;
}

.negative {
  color: #FF8A65;
}

.price-up {
  color: #FF8A65;
}

.price-down {
  color: #81C784;
}

.price-neutral {
  color: #fff;
}

.stock-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.stock-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.stock-date {
  font-size: 11px;
  opacity: 0.8;
}
</style>
