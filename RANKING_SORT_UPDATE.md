# 手艺人排行榜排序优化说明

## 修改内容

### 1. 云函数排序逻辑 (`cloudfunctions/order/index.js`)

**getRanking 函数修改：**
- 之前：按完成订单数排序
- **修改后：按完成订单金额总数降序，金额相同按评价降序**

```javascript
// 排序逻辑
ranking.sort((a, b) => {
  if (b.totalAmount !== a.totalAmount) {
    return b.totalAmount - a.totalAmount  // 金额降序
  }
  return b.rating - a.rating  // 评价降序
})
```

### 2. 管理员统计页面 (`pages/admin/stats/index`)

**WXML 修改：**
- 标题从"完成订单数"改为"手艺人排行榜"
- 添加排序说明子标题："排序：完成金额 ↓ | 评价 ↓"
- 金额显示样式调整为更突出（字号大、红色加粗）
- 显示评价分数

**WXSS 修改：**
- 添加 `.ranking-subtitle` 排序说明样式
- 添加 `.rank-rating` 和 `.rating-score` 评价显示样式
- 添加 `.rank-amount.primary` 金额突出显示样式

### 3. 通用统计页面 (`pages/common/statistics`)

**JS 修改：**
- 调用云函数从 `craftsman/getList` 改为 `order/getRanking`
- 确保与管理员页面使用同一套排序逻辑

**WXML 修改：**
- 添加排序说明子标题
- 修复字段名 `totalPrice` → `totalAmount`
- 调整显示样式

**WXSS 修改：**
- 添加 `.rank-amount-primary` 金额突出样式
- 添加 `.card-subtitle` 子标题样式

## 排序规则

1. **第一优先级：完成订单金额总数**（降序）
2. **第二优先级：评价分数**（降序，金额相同时）

## 界面效果

### 排行榜卡片
```
🏆 手艺人排行榜
排序：完成金额 ↓ | 评价 ↓

1  [头像]  张三        ¥12,580  ← 红色粗体
            ★ 4.8          45单

2  [头像]  李四          ¥10,260
            ★ 4.9          38单

3  [头像]  王五          ¥9,850
            ★ 4.7          42单
```

## 测试验证

1. 登录管理员账号
2. 进入"数据统计"页面
3. 查看"手艺人排行榜"
4. 验证排序是否按金额降序
5. 验证金额相同时是否按评价降序
