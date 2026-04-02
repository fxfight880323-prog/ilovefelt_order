const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  
  try {
    switch (action) {
      case 'createTestOrder':
        return await createTestOrder()
      case 'clearTestData':
        return await clearTestData()
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 创建测试订单
async function createTestOrder() {
  // 先创建几个样式
  const styles = [
    { name: '现代简约', description: '简洁大方的现代风格' },
    { name: '中式古典', description: '传统中式风格' },
    { name: '欧式复古', description: '欧洲古典风格' }
  ]
  
  const styleIds = []
  for (const style of styles) {
    const existing = await db.collection('styles').where({ name: style.name }).get()
    if (existing.data.length === 0) {
      const res = await db.collection('styles').add({
        data: {
          ...style,
          createTime: db.serverDate()
        }
      })
      styleIds.push(res._id)
    } else {
      styleIds.push(existing.data[0]._id)
    }
  }
  
  // 创建测试订单
  const orders = [
    {
      name: '定制实木桌椅一套',
      styleId: styleIds[0] || '',
      styleName: '现代简约',
      quantity: 1,
      price: 3000,
      totalPrice: 3000,
      dispatchDate: new Date(),
      receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      remark: '需要与家中装修风格匹配，颜色偏深',
      status: 'pending'
    },
    {
      name: '手工陶艺花瓶10个',
      styleId: styleIds[1] || '',
      styleName: '中式古典',
      quantity: 10,
      price: 150,
      totalPrice: 1500,
      dispatchDate: new Date(),
      receiveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      remark: '用于酒店装饰，要求统一规格',
      status: 'pending'
    },
    {
      name: '手工编织挂毯5幅',
      styleId: styleIds[2] || '',
      styleName: '欧式复古',
      quantity: 5,
      price: 500,
      totalPrice: 2500,
      dispatchDate: new Date(),
      receiveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      remark: '尺寸：100cm x 150cm',
      status: 'pending'
    }
  ]
  
  const createdOrders = []
  for (const order of orders) {
    const res = await db.collection('orders').add({
      data: {
        ...order,
        craftsmanId: '',
        craftsmanName: '',
        craftsmanPhone: '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    createdOrders.push(res._id)
  }
  
  return {
    code: 0,
    message: '测试数据创建成功',
    data: {
      styleIds,
      orderIds: createdOrders
    }
  }
}

// 清理测试数据
async function clearTestData() {
  // 删除测试订单（保留真实订单）
  const orders = await db.collection('orders').get()
  
  for (const order of orders.data) {
    await db.collection('orders').doc(order._id).remove()
  }
  
  return {
    code: 0,
    message: '测试数据已清理'
  }
}
