# 手艺人完成订单图片上传功能

## 功能概述

手艺人角色在完成订单时，必须上传成品照片才能提交完成。照片将保存在云存储中，并与订单数据关联存储在数据库中。

## 已实现的功能

### 1. 前端功能 (pages/craftsman/orderDetail)

#### 数据字段
- `showCompleteSection` - 控制完成订单区域的显示/隐藏
- `completePhotos` - 存储待上传的照片文件ID数组（最多3张）

#### 方法
- `showCompleteSection()` - 显示完成订单区域
- `hideCompleteSection()` - 隐藏完成订单区域并清空照片
- `choosePhoto()` - 选择并上传照片到云存储
- `deletePhoto()` - 删除已选择的照片
- `previewPhoto()` - 预览已上传的照片
- `submitComplete()` - 提交完成订单（必须上传至少一张照片）

#### 界面元素
- 已发货订单显示"完成订单"按钮
- 点击后显示照片上传区域
- 支持拍照或从相册选择
- 最多上传3张照片
- 提交前验证必须上传照片

### 2. 云函数功能 (cloudfunctions/order)

#### completeOrder 接口
- 接收参数：`orderId`, `completePhotos`（照片文件ID数组）
- 验证必须上传至少一张照片
- 验证订单状态和权限
- 更新订单状态为 completed
- 保存照片文件ID到数据库
- 更新手艺人完成订单数

#### revertOrder 接口（撤回订单）
- 撤回订单时清空 `completePhotos` 数组
- 允许手艺人重新上传照片

### 3. 数据库字段

订单集合 (orders) 包含以下字段：
```javascript
{
  // ... 其他字段
  completePhotos: [], // 成品照片文件ID数组
  completeDate: null, // 完成时间
}
```

## 修改记录

### Bug 修复
1. **pages/craftsman/orderDetail.js** (第419行)
   - 修复：`orderInfo.name` → `this.data.orderInfo.name`
   - 问题：submitComplete 方法中使用了未定义的变量

### 功能增强
2. **cloudfunctions/order/index.js** (completeOrder 函数)
   - 添加：验证必须上传至少一张照片
   ```javascript
   if (!completePhotos || completePhotos.length === 0) {
     return { code: -1, message: '请至少上传一张成品照片' }
   }
   ```

3. **cloudfunctions/order/index.js** (revertOrder 函数)
   - 添加：撤回订单时清空 completePhotos 数组
   ```javascript
   completePhotos: [],
   ```

## 使用流程

### 正常完成订单流程
1. 手艺人进入"我的订单"页面
2. 点击已发货的订单
3. 点击"完成订单"按钮
4. 拍摄或选择成品照片（至少1张，最多3张）
5. 点击"提交完成"
6. 系统验证照片已上传
7. 订单状态变为"已完成"
8. 照片保存在云存储，文件ID保存在订单数据中

### 撤回订单流程
1. 手艺人进入已完成的订单详情
2. 点击"撤回订单"按钮
3. 确认撤回
4. 订单状态变回"进行中"
5. 已上传的照片数据被清空
6. 手艺人可以重新上传照片完成订单

## 测试要点

### 1. 上传功能测试
- [ ] 已发货订单显示"完成订单"按钮
- [ ] 点击后显示照片上传区域
- [ ] 可以拍照上传
- [ ] 可以从相册选择
- [ ] 最多上传3张照片
- [ ] 可以删除已选择的照片
- [ ] 未上传照片时提交会提示错误

### 2. 数据保存测试
- [ ] 提交后订单状态变为"已完成"
- [ ] 照片文件ID保存在订单数据中
- [ ] 照片可以在订单详情中查看
- [ ] 点击照片可以预览

### 3. 撤回功能测试
- [ ] 已完成的订单可以撤回
- [ ] 撤回后订单状态变回"进行中"
- [ ] 撤回后照片数据被清空
- [ ] 可以重新上传照片完成订单

### 4. 云函数测试
- [ ] 未上传照片调用 completeOrder 返回错误
- [ ] 无权限用户调用 completeOrder 返回错误
- [ ] 订单状态不正确时调用 completeOrder 返回错误

## 文件路径

### 前端文件
- `pages/craftsman/orderDetail.js` - 订单详情页逻辑
- `pages/craftsman/orderDetail.wxml` - 订单详情页模板
- `pages/craftsman/orderDetail.wxss` - 订单详情页样式
- `pages/craftsman/myOrders.js` - 我的订单列表
- `pages/craftsman/myOrders.wxml` - 我的订单列表模板

### 后端文件
- `cloudfunctions/order/index.js` - 订单云函数
- `cloudfunctions/craftsman/index.js` - 手艺人云函数

### 工具文件
- `utils/util.js` - 工具函数

## 注意事项

1. 照片存储在微信云存储中，路径为 `order-complete/`
2. 照片文件ID保存在订单文档的 `completePhotos` 字段中
3. 撤回订单会清空照片数据，但不会删除云存储中的文件
4. 每个订单最多保存3张成品照片
