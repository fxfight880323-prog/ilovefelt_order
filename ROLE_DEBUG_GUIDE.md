# 角色功能调试指南

## TabBar 配置总览

### app.json tabBar list
1. 首页 - pages/common/index
2. 接单 - pages/craftsman/orderList (手艺人)
3. 我的订单 - pages/craftsman/myOrders (手艺人)
4. 派单 - pages/dispatcher/myOrders (派单人)
5. 手艺人 - pages/dispatcher/craftsmen (派单人)
6. 个人中心 - pages/craftsman/profile

---

## 1. 手艺人角艺 (craftsman)

### TabBar 配置 (custom-tab-bar/index.js)
| 索引 | 页面 | 路径 |
|------|------|------|
| 0 | 首页 | pages/common/index |
| 1 | 接单 | pages/craftsman/orderList |
| 2 | 我的订单 | pages/craftsman/myOrders |
| 3 | 个人中心 | pages/craftsman/profile |

### 各页面 TabBar 选中状态
- 首页: selected: 0 ✓
- 接单: selected: 1 ✓
- 我的订单: selected: 2 ✓
- 个人中心: selected: 3 ✓

### 功能清单
- [x] 首页 - 查看统计数据
- [x] 接单 - 查看待接单订单
- [x] 我的订单 - 查看已接订单
- [x] 个人中心 - 个人信息管理

---

## 2. 派单人角艺 (dispatcher)

### TabBar 配置 (custom-tab-bar/index.js)
| 索引 | 页面 | 路径 |
|------|------|------|
| 0 | 首页 | pages/common/index |
| 1 | 派单 | pages/dispatcher/myOrders |
| 2 | 手艺人 | pages/dispatcher/craftsmen |
| 3 | 个人中心 | pages/craftsman/profile |

### 各页面 TabBar 选中状态
- 首页: selected: 0 ✓
- 派单: selected: 1 ✓
- 手艺人: selected: 2 ✓
- 个人中心: selected: 3 ✓

### 功能清单
- [x] 首页 - 查看统计数据
- [x] 派单 - 管理发布的订单
- [x] 手艺人 - 查看合作手艺人及历史订单
- [x] 个人中心 - 个人信息管理

---

## 3. 管理员角艺 (admin)

### TabBar 配置 (custom-tab-bar/index.js)
| 索引 | 页面 | 路径 | 跳转方式 |
|------|------|------|---------|
| 0 | 首页 | pages/common/index | switchTab |
| 1 | 控制台 | pages/admin/console | navigateTo |
| 2 | 订单管理 | pages/admin/orderManage | navigateTo |
| 3 | 个人中心 | pages/craftsman/profile | switchTab |

### 各页面 TabBar 选中状态
- 首页: selected: 0 ✓
- 控制台: selected: 1 ✓
- 订单管理: selected: 2 ✓
- 个人中心: selected: 3 ✓

### 功能清单
- [x] 首页 - 查看统计数据
- [x] 控制台 - 管理后台
- [x] 订单管理 - 管理所有订单
- [x] 个人中心 - 个人信息管理

---

## 常见问题排查

### 1. Tab 点击无反应
- 检查 app.json 中的 tabBar list 是否包含该页面
- 检查页面文件是否存在 (wxml, js, json, wxss)
- 检查页面 JS 是否有语法错误

### 2. Tab 选中状态不正确
- 检查页面 onShow 中的 getTabBar().setData({ selected: n })
- 确保索引与 custom-tab-bar/index.js 中的配置一致

### 3. 角色切换后 TabBar 不更新
- 检查 app.globalData.userRole 是否正确设置
- 检查 custom-tab-bar 的 updateTabBar() 方法是否被调用

---

## 调试日志位置

1. custom-tab-bar/index.js - switchTab 方法
2. custom-tab-bar/index.js - updateTabBar 方法
3. 各页面 onShow 方法
