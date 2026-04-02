# TabBar 测试指南

## 修改内容

### 1. 自定义 TabBar (`custom-tab-bar/`)
- 根据角色显示不同导航：
  - **手艺人**: 首页 → 接单 → 我的订单 → 个人中心
  - **派单人**: 首页 → 派单 → 我的订单 → 个人中心
  - **管理员**: 首页 → 控制台 → 订单管理 → 个人中心

### 2. 跳转方式
- **Tab 页面**（首页、接单/派单、我的订单、个人中心）：使用 `wx.switchTab`
- **非 Tab 页面**（控制台、订单管理）：使用 `wx.navigateTo`

### 3. 关键修改文件
- `custom-tab-bar/index.js/wxml/wxss/json` - 自定义导航
- `app.json` - 启用自定义 tabBar，添加派单页面到 list
- `pages/common/index.js` - 切换角色时更新 tabBar
- 各页面 onShow - 设置选中状态

## 测试步骤

### 1. 手艺人角色
1. 登录手艺人账号
2. 底部导航应显示：首页、接单、我的订单、个人中心
3. 点击"接单"进入接单大厅
4. 点击"我的订单"进入我的订单列表
5. 点击"个人中心"进入个人中心

### 2. 派单人角色
1. 登录派单人账号
2. 底部导航应显示：首页、派单、我的订单、个人中心
3. 点击"派单"进入我的派单列表
4. 点击"我的订单"进入我的订单列表
5. 点击"个人中心"进入个人中心

### 3. 管理员角色
1. 登录管理员账号
2. 底部导航应显示：首页、控制台、订单管理、个人中心
3. 点击"控制台"进入管理员控制台（navigateTo）
4. 点击"订单管理"进入订单管理页面（navigateTo）
5. 点击"个人中心"进入个人中心

### 4. 角色切换
1. 在首页点击切换角色
2. 切换到不同角色后，底部导航应自动更新
3. 检查导航图标和文字是否正确

## 常见问题

### 问题1：点击无响应
- 检查 `app.json` 中 tabBar list 是否包含对应页面路径
- 检查 custom-tab-bar 的 list 配置是否正确

### 问题2：图标不显示
- 检查 `images/` 目录下是否有对应图标文件
- 图标路径应为 `/images/xxx.png`

### 问题3：选中状态不正确
- 检查各页面的 onShow 中是否设置了 selected
- 检查索引值是否与 list 中的顺序一致

## 调试方法

在 custom-tab-bar/index.js 中打开控制台日志：
```javascript
console.log('userRole:', userRole)
console.log('list:', list)
console.log('switchTab:', url, 'isNavigate:', isNavigate)
```

## 文件清单

```
custom-tab-bar/
├── index.js      # TabBar 逻辑
├── index.wxml    # TabBar 模板
├── index.wxss    # TabBar 样式
└── index.json    # 组件配置

app.json          # 启用自定义 tabBar
```
