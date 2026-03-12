const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 订阅消息模板ID（需要在微信公众平台配置）
const TMPL_IDS = {
  NEW_ORDER: 'YOUR_NEW_ORDER_TMPL_ID',      // 新订单提醒
  ORDER_ACCEPTED: 'YOUR_ACCEPT_TMPL_ID',    // 接单成功提醒
  ORDER_COMPLETED: 'YOUR_COMPLETE_TMPL_ID'  // 订单完成提醒
}

exports.main = async (event, context) => {
  const { action, orderId } = event
  
  try {
    switch (action) {
      case 'sendNewOrderNotice':
        return await sendNewOrderNotice(orderId)
      case 'sendAcceptConfirm':
        return await sendAcceptConfirm(orderId)
      case 'sendCompleteNotice':
        return await sendCompleteNotice(orderId)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('发送消息失败:', err)
    return { code: -1, message: err.message }
  }
}

// 发送新订单提醒给所有手工艺人
async function sendNewOrderNotice(orderId) {
  // 获取订单信息
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) {
    return { code: -1, message: '订单不存在' }
  }
  
  const orderData = order.data
  
  // 获取所有已订阅的手工艺人openid
  const subscribers = await db.collection('subscribers').where({
    tmplId: TMPL_IDS.NEW_ORDER
  }).get()
  
  if (subscribers.data.length === 0) {
    return { code: 0, message: '没有订阅者' }
  }
  
  // 批量发送订阅消息
  const sendPromises = subscribers.data.map(async (subscriber) => {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: subscriber.openid,
        templateId: TMPL_IDS.NEW_ORDER,
        page: 'pages/craftsman/orderList',
        data: {
          thing1: { value: orderData.name },           // 订单名称
          thing2: { value: orderData.styleName },      // 样式
          number3: { value: orderData.quantity },      // 数量
          amount4: { value: orderData.totalPrice.toString() }, // 总价
          date5: { value: formatDate(orderData.receiveDate) }   // 收货日期
        }
      })
      return { openid: subscriber.openid, success: true }
    } catch (err) {
      console.error(`发送给 ${subscriber.openid} 失败:`, err)
      return { openid: subscriber.openid, success: false, error: err.message }
    }
  })
  
  const results = await Promise.all(sendPromises)
  
  return {
    code: 0,
    message: '发送完成',
    data: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  }
}

// 发送接单成功确认
async function sendAcceptConfirm(orderId) {
  // 获取订单信息
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) {
    return { code: -1, message: '订单不存在' }
  }
  
  const orderData = order.data
  
  // 发送给接单人
  if (orderData.craftsmanId) {
    const craftsman = await db.collection('craftsmen').doc(orderData.craftsmanId).get()
    if (craftsman.data && craftsman.data.openid) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: craftsman.data.openid,
          templateId: TMPL_IDS.ORDER_ACCEPTED,
          page: `pages/craftsman/orderDetail?id=${orderId}`,
          data: {
            thing1: { value: orderData.name },           // 订单名称
            thing2: { value: '接单成功' },                // 状态
            date3: { value: formatDate(new Date()) },    // 接单时间
            thing4: { value: orderData.receiveDate }     // 截止日期
          }
        })
      } catch (err) {
        console.error('发送接单确认失败:', err)
      }
    }
  }
  
  return { code: 0, message: '发送完成' }
}

// 发送订单完成通知
async function sendCompleteNotice(orderId) {
  // 获取订单信息
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) {
    return { code: -1, message: '订单不存在' }
  }
  
  const orderData = order.data
  
  // 发送给接单人
  if (orderData.craftsmanId) {
    const craftsman = await db.collection('craftsmen').doc(orderData.craftsmanId).get()
    if (craftsman.data && craftsman.data.openid) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: craftsman.data.openid,
          templateId: TMPL_IDS.ORDER_COMPLETED,
          page: `pages/craftsman/orderDetail?id=${orderId}`,
          data: {
            thing1: { value: orderData.name },           // 订单名称
            thing2: { value: '已完成' },                  // 完成状态
            date3: { value: formatDate(new Date()) },    // 完成时间
            amount4: { value: orderData.totalPrice.toString() } // 收入金额
          }
        })
      } catch (err) {
        console.error('发送完成通知失败:', err)
      }
    }
  }
  
  return { code: 0, message: '发送完成' }
}

// 格式化日期
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
