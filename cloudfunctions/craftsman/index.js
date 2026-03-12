const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 管理员openid列表（需要替换为实际的管理员openid）
const ADMIN_OPENIDS = ['o YOUR_ADMIN_OPENID_HERE']

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'getOpenid':
        return { openid: OPENID }
      case 'checkAdmin':
        return { isAdmin: ADMIN_OPENIDS.includes(OPENID) }
      case 'checkUserRole':
        return await checkUserRole(OPENID)
      case 'getList':
        return await getCraftsmanList()
      case 'add':
        return await addCraftsman(data)
      case 'update':
        return await updateCraftsman(data)
      case 'delete':
        return await deleteCraftsman(data)
      case 'getStats':
        return await getCraftsmanStats(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 检查用户角色
async function checkUserRole(openid) {
  const isAdmin = ADMIN_OPENIDS.includes(openid)
  
  let craftsmanInfo = null
  if (!isAdmin) {
    const craftsman = await db.collection('craftsmen').where({ openid }).get()
    if (craftsman.data.length > 0) {
      craftsmanInfo = craftsman.data[0]
    }
  }
  
  return {
    code: 0,
    data: {
      openid,
      isAdmin,
      craftsmanInfo
    }
  }
}

// 获取手工艺人列表
async function getCraftsmanList() {
  const list = await db.collection('craftsmen')
    .orderBy('starLevel', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 添加手工艺人
async function addCraftsman(data) {
  const { name, phone, starLevel, specialty, performance } = data
  
  // 生成临时openid（实际应该由用户扫码绑定）
  const result = await db.collection('craftsmen').add({
    data: {
      name,
      phone: phone || '',
      starLevel: starLevel || 3,
      specialty,
      performance: performance || '良好',
      openid: '', // 等待用户绑定
      totalOrders: 0,
      completedOrders: 0,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '添加成功',
    data: { _id: result._id }
  }
}

// 更新手工艺人
async function updateCraftsman(data) {
  const { id, ...updateData } = data
  
  await db.collection('craftsmen').doc(id).update({
    data: {
      ...updateData,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 删除手工艺人
async function deleteCraftsman(data) {
  const { id } = data
  
  await db.collection('craftsmen').doc(id).remove()
  
  return { code: 0, message: '删除成功' }
}

// 获取手工艺人统计
async function getCraftsmanStats(data) {
  const { craftsmanId } = data
  
  // 获取总接单数
  const totalRes = await db.collection('orders').where({
    craftsmanId
  }).count()
  
  // 获取进行中订单数
  const pendingRes = await db.collection('orders').where({
    craftsmanId,
    status: 'accepted'
  }).count()
  
  // 获取已完成订单数
  const completedRes = await db.collection('orders').where({
    craftsmanId,
    status: 'completed'
  }).count()
  
  // 计算总收入
  const orders = await db.collection('orders').where({
    craftsmanId,
    status: 'completed'
  }).get()
  
  const totalIncome = orders.data.reduce((sum, order) => sum + (order.totalPrice || 0), 0)
  
  return {
    code: 0,
    data: {
      totalOrders: totalRes.total,
      pendingOrders: pendingRes.total,
      completedOrders: completedRes.total,
      totalIncome: totalIncome.toFixed(2)
    }
  }
}
