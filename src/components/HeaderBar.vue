<template>
  <div class="header-bar">
    <div class="header-left">
      <div class="app-icon">🧨</div>
      <div class="app-title">
        <div class="title">股票K线训练</div>
        <div class="subtitle">{{ status }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  status: string
}

defineProps<Props>()
</script>

<style scoped>
.header-bar {
  background: var(--primary-purple);
  color: #fff;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  font-size: 24px;
}

.app-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  font-size: 12px;
  opacity: 0.9;
}
</style>
