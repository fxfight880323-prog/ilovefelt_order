const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 引入配置
const subscribeConfig = {
  NEW_ORDER: 'dUvWdLqKFxuJmYM69-V0X7SJ0LfeBx5bS9igrDgf6-4',
  ORDER_STATUS_CHANGE: '',
  ORDER_COMPLETE: '',
  AUDIT_RESULT: ''
}

// 订阅消息模板ID
const TMPL_IDS = {
  NEW_ORDER: subscribeConfig.NEW_ORDER,           // 新订单提醒
  ORDER_ACCEPTED: subscribeConfig.ORDER_STATUS_CHANGE,  // 接单成功提醒
  ORDER_COMPLETED: subscribeConfig.ORDER_COMPLETE      // 订单完成提醒
}

exports.main = async (event, context) => {
  const { action, orderId, type, orderName, trackingNumber, trackingCompany, craftsmanName, dispatcherId, craftsmanId, totalPrice, tmplId, openid } = event
  
  try {
    switch (action) {
      case 'sendNewOrderNotice':
        return await sendNewOrderNotice(orderId)
      case 'sendAcceptConfirm':
        return await sendAcceptConfirm(orderId)
      case 'sendCompleteNotice':
        return await sendCompleteNotice(orderId)
      case 'sendPaymentNotice':
        return await sendPaymentNotice(craftsmanId, orderName, totalPrice)
      case 'sendReceiptNotice':
        return await sendReceiptNotice(dispatcherId, orderName, craftsmanName)
      case 'saveSubscribe':
        return await saveSubscribe(openid, tmplId)
      case 'notifyAdmin':
        return await notifyAdmin(type, { orderName, trackingNumber, trackingCompany, craftsmanName })
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

// 通知管理员
async function notifyAdmin(type, data) {
  const { orderName, trackingNumber, trackingCompany, craftsmanName } = data
  
  // 获取所有管理员（openid列表）
  // 管理员是 roles 包含 admin 的用户
  const adminUsers = await db.collection('users').where({
    roles: db.command.all(['admin'])
  }).get()
  
  if (adminUsers.data.length === 0) {
    console.log('没有找到管理员')
    return { code: 0, message: '没有找到管理员' }
  }
  
  // 根据类型构建通知内容
  let title, content
  if (type === 'tracking_added') {
    title = '订单已发货'
    content = `手艺人${craftsmanName}已为订单「${orderName}」填写运单号：${trackingCompany} ${trackingNumber}`
  } else if (type === 'order_completed') {
    title = '订单已完成'
    content = `手艺人${craftsmanName}已完成订单「${orderName}」`
  }
  
  // 发送给所有管理员
  const sendPromises = adminUsers.data.map(async (admin) => {
    if (admin.openid) {
      try {
        // 添加通知记录到数据库
        await db.collection('notices').add({
          data: {
            type: 'admin',
            toUser: admin.openid,
            title,
            content,
            read: false,
            createTime: db.serverDate()
          }
        })
      } catch (err) {
        console.error('通知管理员失败:', err)
      }
    }
  })
  
  await Promise.all(sendPromises)
  
  return { code: 0, message: '通知已发送' }
}

// 发送付款通知给手艺人
async function sendPaymentNotice(craftsmanId, orderName, totalPrice) {
  // 获取手艺人信息
  const craftsmanRes = await db.collection('craftsmen').doc(craftsmanId).get()
  if (!craftsmanRes.data || !craftsmanRes.data.openid) {
    return { code: 0, message: '手艺人未绑定微信' }
  }
  
  const openid = craftsmanRes.data.openid
  
  // 添加通知记录到数据库
  try {
    await db.collection('notices').add({
      data: {
        type: 'payment',
        toUser: openid,
        title: '订单付款确认',
        content: `订单「${orderName}」款项 ¥${totalPrice || 0} 已确认支付，请及时确认收款`,
        read: false,
        createTime: db.serverDate()
      }
    })
  } catch (err) {
    console.error('添加付款通知失败:', err)
  }
  
  return { code: 0, message: '付款通知已发送' }
}

// 发送收款通知给派单人
async function sendReceiptNotice(dispatcherId, orderName, craftsmanName) {
  // 获取派单人信息
  const dispatcherRes = await db.collection('dispatchers').doc(dispatcherId).get()
  if (!dispatcherRes.data || !dispatcherRes.data.openid) {
    return { code: 0, message: '派单人未绑定微信' }
  }
  
  const openid = dispatcherRes.data.openid
  
  // 添加通知记录到数据库
  try {
    await db.collection('notices').add({
      data: {
        type: 'receipt',
        toUser: openid,
        title: '订单收款确认',
        content: `手艺人${craftsmanName || ''}已确认收到订单「${orderName}」的款项，订单已结束`,
        read: false,
        createTime: db.serverDate()
      }
    })
  } catch (err) {
    console.error('添加收款通知失败:', err)
  }
  
  return { code: 0, message: '收款通知已发送' }
}

// 保存订阅者信息
async function saveSubscribe(openid, tmplId) {
  if (!openid || !tmplId) {
    return { code: -1, message: '缺少参数' }
  }
  
  try {
    // 检查是否已存在
    const existRes = await db.collection('subscribers').where({
      openid,
      tmplId
    }).get()
    
    if (existRes.data.length > 0) {
      // 更新订阅时间
      await db.collection('subscribers').doc(existRes.data[0]._id).update({
        data: {
          updateTime: db.serverDate()
        }
      })
    } else {
      // 创建新订阅记录
      await db.collection('subscribers').add({
        data: {
          openid,
          tmplId,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    }
    
    return { code: 0, message: '订阅保存成功' }
  } catch (err) {
    console.error('保存订阅失败:', err)
    return { code: -1, message: '保存订阅失败' }
  }
}

// 格式化日期
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
