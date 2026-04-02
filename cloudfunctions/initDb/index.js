const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 检查并创建单个集合
async function ensureCollection(name) {
  try {
    await db.createCollection(name)
    return { name, status: 'created', message: '创建成功' }
  } catch (err) {
    if (err.message.includes('already exists') || err.errCode === -502001) {
      return { name, status: 'exists', message: '已存在' }
    }
    return { name, status: 'error', message: err.message }
  }
}

// 检查索引是否存在
async function ensureIndex(collection, indexName) {
  try {
    const indexes = await db.collection(collection).getIndexes()
    const exists = indexes.data.some(idx => idx.name === indexName)
    return exists
  } catch (err) {
    return false
  }
}

exports.main = async (event, context) => {
  const { checkOnly = false } = event
  
  // 集合列表
  const collections = [
    { name: 'users', desc: '用户表' },
    { name: 'craftsmen', desc: '手艺人表' },
    { name: 'craftsmanWorks', desc: '工作记录表 ⭐' },
    { name: 'dispatchers', desc: '派单人表' },
    { name: 'orders', desc: '订单表' },
    { name: 'styles', desc: '样式表' },
    { name: 'subscribers', desc: '订阅者表' },
    { name: 'notices', desc: '公告表' },
    { name: 'verifyCodes', desc: '验证码表' },
    { name: 'smsLogs', desc: '短信日志表' },
    { name: 'adminRequests', desc: '管理员审核表' },
    { name: 'adminNotifications', desc: '管理员通知表' },
    { name: 'ratings', desc: '评分表' }
  ]
  
  // 索引配置
  const indexes = [
    { collection: 'users', name: 'openid_index', key: { openid: 1 } },
    { collection: 'users', name: 'phone_index', key: { phone: 1 }, unique: true },
    { collection: 'users', name: 'role_index', key: { role: 1 } },
    { collection: 'users', name: 'currentRole_index', key: { currentRole: 1 } },
    { collection: 'craftsmen', name: 'openid_index', key: { openid: 1 }, unique: true },
    { collection: 'craftsmen', name: 'phone_index', key: { phone: 1 }, unique: true },
    { collection: 'craftsmen', name: 'code_index', key: { code: 1 }, unique: true },
    { collection: 'craftsmen', name: 'status_index', key: { status: 1 } },
    { collection: 'craftsmanWorks', name: 'craftsman_index', key: { craftsmanId: 1 } },
    { collection: 'craftsmanWorks', name: 'status_index', key: { completionStatus: 1 } },
    { collection: 'dispatchers', name: 'openid_index', key: { openid: 1 }, unique: true },
    { collection: 'orders', name: 'status_index', key: { status: 1 } },
    { collection: 'orders', name: 'craftsman_index', key: { craftsmanId: 1 } },
    { collection: 'orders', name: 'dispatcher_index', key: { dispatcherId: 1 } },
    { collection: 'orders', name: 'createTime_index', key: { createTime: -1 } },
    { collection: 'ratings', name: 'craftsman_index', key: { craftsmanId: 1 } },
    { collection: 'ratings', name: 'order_index', key: { orderId: 1 } }
  ]
  
  const results = {
    collections: [],
    indexes: [],
    summary: { created: 0, exists: 0, error: 0 }
  }
  
  // 检查/创建集合
  for (const col of collections) {
    if (checkOnly) {
      // 仅检查
      try {
        await db.collection(col.name).limit(1).get()
        results.collections.push({ ...col, status: 'exists' })
        results.summary.exists++
      } catch (err) {
        results.collections.push({ ...col, status: 'missing', error: err.message })
        results.summary.error++
      }
    } else {
      // 创建
      const result = await ensureCollection(col.name)
      results.collections.push({ ...col, ...result })
      results.summary[result.status === 'created' ? 'created' : result.status === 'exists' ? 'exists' : 'error']++
    }
  }
  
  // 仅在实际创建时添加索引
  if (!checkOnly) {
    for (const idx of indexes) {
      try {
        const exists = await ensureIndex(idx.collection, idx.name)
        if (!exists) {
          await db.collection(idx.collection).createIndex({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false
          })
          results.indexes.push({ ...idx, status: 'created' })
        } else {
          results.indexes.push({ ...idx, status: 'exists' })
        }
      } catch (err) {
        results.indexes.push({ ...idx, status: 'error', message: err.message })
      }
    }
  }
  
  return {
    code: 0,
    message: checkOnly ? '检查完成' : '初始化完成',
    mode: checkOnly ? 'check' : 'init',
    data: results
  }
}
