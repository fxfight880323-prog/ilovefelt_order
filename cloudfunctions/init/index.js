const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 创建订单集合
    await db.createCollection('orders').catch(() => {})
    // 创建样式集合
    await db.createCollection('styles').catch(() => {})
    // 创建手工艺人集合
    await db.createCollection('craftsmen').catch(() => {})
    // 创建订阅者集合
    await db.createCollection('subscribers').catch(() => {})
    // 创建公告集合
    await db.createCollection('notices').catch(() => {})
    
    return {
      code: 0,
      message: '数据库集合初始化完成',
      collections: ['orders', 'styles', 'craftsmen', 'subscribers', 'notices']
    }
  } catch (err) {
    console.error('初始化失败:', err)
    return {
      code: -1,
      message: err.message
    }
  }
}
