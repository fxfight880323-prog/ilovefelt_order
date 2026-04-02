# 订单唯一编码功能

## 功能概述

系统自动为每个新创建的订单生成一个**10位唯一编码**（2位字母 + 8位数字），作为订单的独立唯一识别码。

## 编码规则

### 格式
```
AB24031578
││└──────┘
││    └─ 8位数字
└┴─ 2位大写字母（排除 I, O）
```

### 详细说明

| 位置 | 内容 | 说明 |
|------|------|------|
| 第1-2位 | 大写字母 | A-Z（排除易混淆的 I 和 O）|
| 第3-4位 | 年份后2位 | 如 24 表示 2024年 |
| 第5-6位 | 月份 | 01-12 |
| 第7-8位 | 日期 | 01-31 |
| 第9-10位 | 随机数 | 00-99 |

### 示例
- `AB24031578`：2024年3月15日生成的第78个随机编号
- `KM24071245`：2024年7月12日生成的第45个随机编号
- `XP24120103`：2024年12月1日生成的第3个随机编号

## 唯一性保证

1. **日期部分**：包含年月日信息，确保不同日期生成的编码前缀不同
2. **随机部分**：2位随机数（00-99），每天可生成最多100个不重复编码（每个字母组合）
3. **字母部分**：24×24=576种字母组合，扩大编码空间
4. **数据库检查**：创建前检查数据库，确保编码唯一
5. **重试机制**：如果冲突，自动重试生成（最多10次）

## 技术实现

### 云函数代码

```javascript
// cloudfunctions/order/index.js

async function generateOrderCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // 24个字母
  const maxAttempts = 10
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 2位随机字母前缀
    const letter1 = letters[Math.floor(Math.random() * letters.length)]
    const letter2 = letters[Math.floor(Math.random() * letters.length)]
    const letterPrefix = letter1 + letter2  // 如：AB, KM, XP
    
    // 8位数字：YYMMDD(6位) + 随机数(2位)
    const now = new Date()
    const year = String(now.getFullYear()).slice(2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')  // 00-99
    
    const orderCode = letterPrefix + year + month + day + random  // 共10位
    
    // 检查唯一性
    const existRes = await db.collection('orders').where({ orderCode }).count()
    if (existRes.total === 0) {
      return orderCode
    }
  }
  
  throw new Error('无法生成唯一订单编码')
}
```

### 数据库字段

```javascript
{
  _id: "xxx",              // 数据库自动生成的ID
  orderCode: "AB24031578", // 10位唯一订单编码（新增）
  name: "订单名称",
  status: "pending",
  // ... 其他字段
}
```

## 前端显示

### 手艺人端

#### 订单详情页
```
ORDER CODE
#AB24031578
```

#### 订单列表
```
订单名称
#AB24031578                    [状态标签]
```

### 管理员端

#### 订单管理列表
```
订单名称          [状态标签]
#AB24031578
```

## 使用场景

### 场景1：手艺人查找订单
手艺人可以通过订单编码快速定位订单，比使用长串的 `_id` 更方便。

### 场景2：客服沟通
客服与手艺人/派单人沟通时，可以使用简短的订单编码：
- "您好，订单 AB24031578 有新的消息..."

### 场景3：线下记录
打印订单或线下记录时，10位编码更易书写和识别。

## 容量估算

### 每日容量
- 每对字母组合每天可生成：100个（00-99）
- 576对字母组合每天可生成：`576 × 100 = 57,600` 个唯一编码

### 年度容量
- 每年可生成：`57,600 × 365天 = 21,024,000` 个唯一编码

### 理论总容量
- 百年容量：`21,024,000 × 100年 = 2,102,400,000` 个唯一编码

完全满足业务需求。

## 部署步骤

### 1. 部署云函数
```bash
cd cloudfunctions/order
wxcloud deploy --env <your-env-id>
```

### 2. 测试验证
1. 创建一个新订单
2. 检查返回数据中的 `orderCode` 字段
3. 检查订单详情页显示 `#AB24031578` 格式的编码
4. 检查订单列表中显示编码

### 3. 旧订单处理
旧订单没有 `orderCode` 字段，前端会回退显示 `_id`：
```javascript
#{{orderInfo.orderCode || orderInfo._id}}
```

## 注意事项

1. **不可修改**：订单编码一旦生成，不可修改
2. **唯一索引**：建议在数据库中为 `orderCode` 创建唯一索引（可选）
3. **并发处理**：高并发时可能有极小的冲突概率，已内置重试机制
4. **时区问题**：编码基于服务器时区（通常是中国时区）

## 未来扩展

### 业务编码（可选扩展）
可以根据业务需要，在字母部分加入业务含义：
```
PP24031501  // PP = 普通订单
VV24031501  // VV = VIP订单
EE24031501  // EE = 紧急订单
```

### 分库分表（可选扩展）
如果订单量极大，可以用前1位或2位字母作为分表依据：
- A-H 开头的订单 → 表1
- J-N 开头的订单 → 表2
- P-Z 开头的订单 → 表3
