const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 主入口函数
exports.main = async (event, context) => {
  const { action, data } = event
  
  try {
    switch (action) {
      case 'create':
        return await createOrder(data)
      case 'getList':
        return await getOrderList(data)
      case 'getPendingList':
        return await getPendingList(data)
      case 'getMyOrders':
        return await getMyOrders(data)
      case 'getDetail':
        return await getOrderDetail(data)
      case 'update':
        return await updateOrder(data)
      case 'accept':
        return await acceptOrder(data)
      case 'complete':
        return await completeOrder(data)
      case 'cancel':
        return await cancelOrder(data)
      case 'delete':
        return await deleteOrder(data)
      case 'getOrderStats':
        return await getOrderStats()
      case 'getNoticeList':
        return await getNoticeList(data)
      case 'countByStyle':
        return await countByStyle(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 创建订单
async function createOrder(data) {
  const { name, styleId, styleName, quantity, price, dispatchDate, receiveDate, remark } = data
  
  const result = await db.collection('orders').add({
    data: {
      name,
      styleId,
      styleName,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      totalPrice: parseFloat(price) * parseInt(quantity),
      dispatchDate: new Date(dispatchDate),
      receiveDate: new Date(receiveDate),
      remark: remark || '',
      status: 'pending', // pending: 待接单, accepted: 进行中, completed: 已完成, cancelled: 已取消
      craftsmanId: '',
      craftsmanName: '',
      craftsmanPhone: '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '创建成功',
    data: { _id: result._id }
  }
}

// 获取订单列表（管理员）
async function getOrderList(data) {
  const { page = 1, pageSize = 10, status = '', keyword = '' } = data
  
  let where = {}
  if (status) {
    where.status = status
  }
  if (keyword) {
    where = {
      ...where,
      name: db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    }
  }
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

// 获取待接单列表
async function getPendingList(data) {
  const { page = 1, pageSize = 10 } = data
  
  const total = await db.collection('orders').where({
    status: 'pending'
  }).count()
  
  const list = await db.collection('orders')
    .where({
      status: 'pending'
    })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

// 获取我的订单
async function getMyOrders(data) {
  const { craftsmanId, page = 1, pageSize = 10, status = '' } = data
  
  let where = {
    craftsmanId
  }
  if (status) {
    where.status = status
  }
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('acceptDate', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

// 获取订单详情
async function getOrderDetail(data) {
  const { orderId } = data
  
  const order = await db.collection('orders').doc(orderId).get()
  
  return {
    code: 0,
    data: order.data
  }
}

// 更新订单
async function updateOrder(data) {
  const { id, ...updateData } = data
  
  await db.collection('orders').doc(id).update({
    data: {
      ...updateData,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 接单
async function acceptOrder(data) {
  const { orderId, craftsmanId } = data
  
  // 获取手工艺人信息
  const craftsman = await db.collection('craftsmen').doc(craftsmanId).get()
  
  // 检查订单是否已被接
  const order = await db.collection('orders').doc(orderId).get()
  if (order.data.status !== 'pending') {
    return { code: -1, message: '该订单已被接' }
  }
  
  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'accepted',
      craftsmanId,
      craftsmanName: craftsman.data.name,
      craftsmanPhone: craftsman.data.phone || '',
      acceptDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 更新手工艺人接单数
  await db.collection('craftsmen').doc(craftsmanId).update({
    data: {
      totalOrders: _.inc(1),
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '接单成功' }
}

// 完成订单
async function completeOrder(data) {
  const { orderId } = data
  
  const order = await db.collection('orders').doc(orderId).get()
  
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'completed',
      completeDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 更新手工艺人完成数
  if (order.data.craftsmanId) {
    await db.collection('craftsmen').doc(order.data.craftsmanId).update({
      data: {
        completedOrders: _.inc(1),
        updateTime: db.serverDate()
      }
    })
  }
  
  return { code: 0, message: '完成成功' }
}

// 取消订单
async function cancelOrder(data) {
  const { orderId } = data
  
  const order = await db.collection('orders').doc(orderId).get()
  
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'cancelled',
      updateTime: db.serverDate()
    }
  })
  
  // 如果是已接订单，减少手工艺人接单数
  if (order.data.craftsmanId && order.data.status === 'accepted') {
    await db.collection('craftsmen').doc(order.data.craftsmanId).update({
      data: {
        totalOrders: _.inc(-1),
        updateTime: db.serverDate()
      }
    })
  }
  
  return { code: 0, message: '取消成功' }
}

// 删除订单
async function deleteOrder(data) {
  const { orderId } = data
  
  await db.collection('orders').doc(orderId).remove()
  
  return { code: 0, message: '删除成功' }
}

// 获取订单统计
async function getOrderStats() {
  const pendingCount = await db.collection('orders').where({ status: 'pending' }).count()
  const acceptedCount = await db.collection('orders').where({ status: 'accepted' }).count()
  const completedCount = await db.collection('orders').where({ status: 'completed' }).count()
  const totalCount = await db.collection('orders').count()
  
  return {
    code: 0,
    data: {
      pendingCount: pendingCount.total,
      acceptedCount: acceptedCount.total,
      completedCount: completedCount.total,
      totalCount: totalCount.total
    }
  }
}

// 获取公告列表
async function getNoticeList(data) {
  const { limit = 5 } = data
  
  const list = await db.collection('notices')
    .orderBy('createTime', 'desc')
    .limit(limit)
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 统计使用该样式的订单数量
async function countByStyle(data) {
  const { styleId } = data
  
  const count = await db.collection('orders').where({ styleId }).count()
  
  return {
    code: 0,
    count: count.total
  }
}
