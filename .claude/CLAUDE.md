# CLAUDE.md — KLine2 项目开发规范

## 项目信息
- **项目名称**: KLine2 / stock-training-tool
- **项目类型**: Web应用 (股票交易训练工具)
- **主要语言**: TypeScript, Vue
- **框架**: Vue 3, Vite, ECharts
- **包管理器**: npm

## 常用命令
```bash
npm install     # 安装依赖
npm run dev     # 启动开发环境 (Vite dev server)
npm run build   # 构建生产版本
npm run preview # 预览生产构建
```

## 项目架构
- **前端**: Vue 3 + TypeScript + Vite，使用 ECharts 渲染K线图
- **后端**: Node.js HTTP 服务器，从本地文件读取股票数据
- **数据源**: D:\software\export 目录下的股票数据文件（GBK编码txt文件）
- **API**: http://localhost:3001/api/stock?code=股票代码

## 项目结构
```
src/
  components/    # Vue 组件 (KLine 图表、交易按钮、设置等)
  App.vue        # 根组件
  main.ts        # 应用入口
api/             # API 相关目录
dist/            # 构建输出目录
public/          # 静态资源
```

## 命名规范

### 文件命名
- **Vue 组件**: PascalCase (如 `KLineChart.vue`, `TradeButtons.vue`)
- **TypeScript**: kebab-case (如 `chart-utils.ts`)
- **类型后缀**: `.types.ts`
- **示例**:
  - Vue: `StockSettings.vue`
  - TS: `k-line-utils.ts`

### 组件命名
- 组件文件名使用 PascalCase
- 组件内部引用使用 PascalCase
- Props 使用 camelCase
- 事件使用 kebab-case

## 技术栈特点

### Vue 3
- 使用 Composition API (`<script setup>`)
- 使用 `<script setup>` SFCs 语法
- 单文件组件风格

### TypeScript
- 启用 strict 模式
- 禁止 any，使用 unknown + 类型守卫
- 禁止 @ts-ignore
- 使用 ES modules (import/export)

### ECharts
- 用于 K 线图表渲染
- 图表配置集中在组件内部
- 注意响应式更新图表

## 代码复用
**IMPORTANT: 禁止重复实现已有功能**

- 相同代码出现 2 次 → 必须提取为公共函数/composable
- 图表配置、交易逻辑 → 考虑复用
- 新建文件前 → 先搜索 components/ 目录
- 组件间通信使用 props/emit 或状态管理

## 代码健壮性

### 错误处理
- API 调用必须有错误处理机制
- 图表加载失败 → 显示友好提示
- 数据验证 → 检查必填字段
- 异步操作 → 使用 try-catch

### 输入验证
- 用户交易操作必须验证 (股票代码、价格、数量)
- API 响应数据验证
- 输入范围检查 (数量、价格区间)

### 数据状态
- 交易状态管理 (持仓、资金、盈亏)
- 图表数据缓存
- 响应式数据更新

## 修改原则
**IMPORTANT: 根本解决问题**

- 找到 root cause，从根本上解决
- 不接受"先这样绕过"、"加个判断跳过"
- 复杂修复: 说明根本原因，等待确认后再动手

### 代码清理
- 废弃组件/函数: 确认无引用 → 直接删除
- 重复逻辑: 统一为一个 → 删除其余
- 未使用的 imports → 删除

### 修改范围
- 只改必要文件，不顺便改无关代码
- 修改前先理解现有代码意图
- 修改后测试交易功能确认无回归

## 配置管理
- 敏感信息: 环境变量注入 (.env 文件)
- 优先级: 环境变量 > 配置文件 > 默认值
- API 端点配置集中管理

## 文档与注释
- 公共函数/方法: 文档注释说明参数、返回值
- 组件 props/emits: 类型定义
- 复杂交易逻辑: 注释说明"为什么"
- 图表配置: 注释解释关键参数

## 禁止事项
- 硬编码 API 密钥、服务器地址
- 提交调试 console.log 到代码库
- 组件过度嵌套导致性能问题
- 忽略 TypeScript 类型错误
- 大型组件不拆分
- 图表配置散落在多处

## AI 协作协议

### 解决问题
- 遇到问题: 先分析根本原因，再提出方案
- 不接受: "先这样绕过"、"加个判断跳过"
- 复杂修复: 说明根本原因，等待确认后再动手

### 修改前必须备份
- **强制 Git 检查**: 在进行任何非琐碎（超过 5 行或涉及核心逻辑）的修改前，必须先运行 `git status`。
- **自动提交快照**: 如果当前工作区是干净的，必须先执行 `git commit -am "CLAUDE_CHECKPOINT: [简述当前状态]"`。
- **复杂任务分支**: 对于涉及多个文件的重构，必须先创建一个新分支 `git checkout -b feature/claude-task-name`。

### 恢复机制
- **失败回退**: 如果修改后运行测试失败或用户反馈结果不对，且无法在 2 次尝试内修复，必须立即执行 `git reset --hard HEAD` 或 `git checkout .` 回退到最近的快照点。
- **禁止盲目叠加**: 禁止在错误的修改之上继续添加补丁，必须先回退，重新分析原因后再动手。

### 代码质量
- 发现重复代码: 主动指出并提议合并
- 发现死代码: 主动指出并建议删除
- 发现设计问题: 指出问题本质，提供重构建议

### 工作方式
- 不确定时: 询问确认，不要猜测
- 修改前: 先阅读理解现有代码
- 修改后: 说明改了什么、为什么改
- 发现无关问题: 指出但不"顺便"修复

### 交付标准
- 完整实现需求，不做简化版/演示版
- 代码可直接运行，不需要人工补充
- 交易功能完整测试

### 验证方式
- 完成前必须验证: 运行 dev 环境，测试交易功能
- 验证失败时: 查看错误、修复、重新验证
- 不要假设正确: 能验证的就验证
- 图表组件: 验证数据渲染正确

## Vue 3 特定规则

### 组件开发
- 使用 Composition API (`<script setup>`)
- Props 使用 `defineProps` + TypeScript 类型
- Emits 使用 `defineEmits` + TypeScript 类型
- 响应式数据使用 `ref` (基本类型) 或 `reactive` (对象)

### 性能优化
- 大列表使用虚拟滚动
- 图表按需加载
- 避免不必要的响应式数据
- 使用 `computed` 缓存计算结果

### 样式
- 组件样式使用 scoped
- 全局样式单独管理
- 避免深层嵌套选择器

## TypeScript 项目规则
- 启用 strict 模式
- 禁止 any，使用 unknown + 类型守卫
- 禁止 @ts-ignore
- 使用 ES modules (import/export)
- 接口定义统一管理

## 安全开发规范
- **数据保护**:
  - 用户交易数据安全存储
  - 日志中禁止记录敏感信息
- **输入处理**:
  - 对所有用户输入进行验证
  - 防止 XSS 攻击
- **API 安全**:
  - HTTPS 通信
  - 适当的认证机制

## 格式要求
**推荐使用:**
- 标题标记（# ## ###）建立层级结构
- 列表符号（-）表示并列项
- 缩进表示层级关系
- 代码块仅用于命令示例或配置示例

**避免使用:**
- 过多的加粗或斜体标记
- 表情符号
- 纯装饰性的分隔线

**原则**: 用 Markdown 建立结构帮助 AI 理解，但保持简洁，不过度装饰
