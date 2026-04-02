# 登录流程说明

## 登录后流程

### 1. 启动小程序
- 显示 Logo 启动页（2秒）
- 检查登录状态
- 已登录：自动跳转到首页
- 未登录：显示登录按钮

### 2. 登录成功
- 统一跳转到**首页** (`pages/common/index`)
- 不是直接进入角色页面

### 3. 首页入口
- 首页显示"进入工作台"卡片
- 点击后根据角色跳转：
  - 手艺人 → 接单大厅
  - 派单人 → 派单页面
  - 管理员 → 控制台

### 4. 后退逻辑
- 从角色页面返回 → 回到首页
- 不会返回到登录页（使用 switchTab 跳转）

## 页面结构

```
登录页 (pages/login/index)
    ↓ 登录成功
首页 (pages/common/index) - 所有角色统一入口
    ↓ 点击"进入工作台"
角色页面（根据角色不同）
    - 手艺人: 接单大厅 (pages/craftsman/orderList)
    - 派单人: 派单页面 (pages/dispatcher/myOrders)
    - 管理员: 控制台 (pages/admin/console)
```

## 代码修改点

### 登录页 (pages/login/index.js)
```javascript
// 所有角色统一跳转到首页
navigateToHome(role) {
  wx.switchTab({
    url: '/pages/common/index'
  })
}
```

### 首页 (pages/common/index.js)
```javascript
// 添加进入工作台方法
enterWorkspace() {
  const { currentRole } = this.data
  
  if (currentRole === 'craftsman') {
    wx.switchTab({ url: '/pages/craftsman/orderList' })
  } else if (currentRole === 'dispatcher') {
    wx.switchTab({ url: '/pages/dispatcher/myOrders' })
  } else if (currentRole === 'admin') {
    wx.navigateTo({ url: '/pages/admin/console' })
  }
}
```

### 首页 WXML (pages/common/index.wxml)
```xml
<!-- 进入工作台卡片 -->
<view class="card card-primary" bindtap="enterWorkspace">
  <view>进入{{currentRole}}工作台</view>
</view>
```

## 测试步骤

1. 启动小程序，确保看到 Logo 和启动页
2. 登录后，确认进入首页（不是直接进入角色页面）
3. 在首页找到"进入工作台"按钮
4. 点击后进入对应角色页面
5. 在角色页面点击返回，确认回到首页
6. 再次点击返回，确认不会回到登录页
