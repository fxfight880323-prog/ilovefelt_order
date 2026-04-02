# 更新部署说明

## 本次更新内容

### 1. 运单号功能
- 匠人完成订单时需填写运单号
- 支持选择物流公司
- 新增订单状态：已发货 (shipped)

### 2. 订阅消息修复
- 修复模板ID错误提示
- 添加空模板检查
- 创建配置文件

### 3. 微信自动登录
- 已注册用户自动登录
- 本地缓存支持
- 显示"欢迎回来"

## 需要部署的文件

### 云函数（必须重新部署）
```bash
☐ cloudfunctions/order      # 新增运单号接口
☐ cloudfunctions/init       # 更新数据库索引
```

### 页面文件（已更新）
- `pages/craftsman/orderDetail.wxml` - 运单号输入界面
- `pages/craftsman/orderDetail.js` - 运单号提交逻辑
- `pages/craftsman/orderDetail.wxss` - 运单号样式
- `pages/admin/orderManage.js` - 添加"已发货"筛选

## 部署步骤

### 步骤1：部署云函数
在微信开发者工具中：
1. 右键 `cloudfunctions/order` → "创建并部署：云端安装依赖"
2. 右键 `cloudfunctions/init` → "创建并部署：云端安装依赖"（如需要更新索引）

### 步骤2：更新数据库（可选）
如需添加运单号字段索引：
```javascript
wx.cloud.callFunction({ name: 'init' })
```

### 步骤3：测试运单号功能
1. 匠人接单一个订单
2. 点击"完成并填写运单号"
3. 输入运单号提交
4. 验证订单状态变为"已发货"

## 配置说明

### 订阅消息配置（可选）
如需使用订阅消息功能：
1. 申请订阅消息模板
2. 编辑 `config/subscribe.js`
3. 填入模板ID

### 数据库集合结构
订单集合已包含以下字段（无需手动创建）：
- `trackingNumber` - 运单号
- `trackingCompany` - 物流公司
- `trackingStatus` - 物流状态
- `shipDate` - 发货时间
