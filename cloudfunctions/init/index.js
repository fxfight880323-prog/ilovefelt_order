const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const collections = [
      'users',              // 用户表
      'craftsmen',          // 手艺人表
      'craftsmanWorks',     // 手艺人工作记录表
      'dispatchers',        // 派单人表
      'orders',             // 订单表
      'styles',             // 样式表
      'subscribers',        // 订阅者表
      'notices',            // 公告表
      'verifyCodes',        // 验证码表
      'smsLogs',            // 短信日志表
      'adminRequests'       // 管理员审核请求表
    ]
    
    const results = []
    
    for (const name of collections) {
      try {
        await db.createCollection(name)
        results.push({ name, status: 'created' })
      } catch (err) {
        if (err.message.includes('already exists')) {
          results.push({ name, status: 'exists' })
        } else {
          results.push({ name, status: 'error', message: err.message })
        }
      }
    }

    // 创建索引
    const indexes = [
      // 用户表索引
      { collection: 'users', name: 'openid_index', key: { openid: 1 }, unique: true },
      { collection: 'users', name: 'role_index', key: { role: 1 } },
      
      // 手艺人表索引
      { collection: 'craftsmen', name: 'openid_index', key: { openid: 1 }, unique: true },
      { collection: 'craftsmen', name: 'phone_index', key: { phone: 1 }, unique: true },
      { collection: 'craftsmen', name: 'code_index', key: { code: 1 }, unique: true },
      { collection: 'craftsmen', name: 'status_index', key: { status: 1 } },
      { collection: 'craftsmen', name: 'specialty_index', key: { specialty: 1 } },
      
      // 手艺人工作记录表索引
      { collection: 'craftsmanWorks', name: 'craftsman_index', key: { craftsmanId: 1 } },
      { collection: 'craftsmanWorks', name: 'status_index', key: { completionStatus: 1 } },
      { collection: 'craftsmanWorks', name: 'delivery_date_index', key: { deliveryDate: 1 } },
      
      // 派单人表索引
      { collection: 'dispatchers', name: 'openid_index', key: { openid: 1 }, unique: true },
      { collection: 'dispatchers', name: 'phone_index', key: { phone: 1 }, unique: true },
      
      // 验证码表索引
      { collection: 'verifyCodes', name: 'phone_code_index', key: { phone: 1, code: 1 } },
      { collection: 'verifyCodes', name: 'expire_index', key: { expireTime: 1 } },
      
      // 订单表索引
      { collection: 'orders', name: 'status_index', key: { status: 1 } },
      { collection: 'orders', name: 'craftsman_index', key: { craftsmanId: 1 } },
      { collection: 'orders', name: 'style_index', key: { styleId: 1 } }
    ]
    
    for (const idx of indexes) {
      try {
        await db.collection(idx.collection).createIndex({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        })
      } catch (e) {
        // 索引可能已存在，忽略错误
      }
    }
    
    return {
      code: 0,
      message: '数据库初始化完成',
      results
    }
  } catch (err) {
    console.error('初始化失败:', err)
    return {
      code: -1,
      message: err.message
    }
  }
}
