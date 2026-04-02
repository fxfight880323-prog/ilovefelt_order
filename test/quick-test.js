/**
 * 快速业务流程测试 - 简化版
 * 在微信开发者工具控制台执行
 */

async function quickTest() {
  const API = {
    call: async (module, action, data = {}) => {
      const { result } = await wx.cloud.callFunction({
        name: 'api',
        data: { module, action, ...data }
      })
      return result
    }
  }

  const log = (msg, data) => {
    console.log(`\n${msg}`)
    if (data) console.log(JSON.stringify(data, null, 2))
  }

  console.log('🚀 开始快速业务流程测试\n')

  // 1. 注册派单人
  log('1. 注册派单人 13800138001')
  let res = await API.call('auth', 'register', {
    phone: '13800138001',
    password: '123456',
    name: '测试派单人',
    requestRole: 'dispatcher'
  })
  log('结果:', res)

  // 2. 注册手艺人
  log('2. 注册手艺人 13800138002')
  res = await API.call('auth', 'register', {
    phone: '13800138002',
    password: '123456',
    name: '测试手艺人',
    requestRole: 'craftsman'
  })
  log('结果:', res)

  // 3. 超级管理员登录
  log('3. 超级管理员登录 13810062394')
  res = await API.call('auth', 'loginByPhone', {
    phone: '13810062394',
    password: '880323'
  })
  log('结果:', res)

  // 4. 获取待审批列表
  log('4. 获取待审批列表')
  res = await API.call('admin', 'getPendingRequests')
  log('结果:', res)

  // 5. 审批（简化：直接数据库操作）
  log('5. 审批用户')
  const db = wx.cloud.database()
  
  // 审批派单人
  const { data: d1 } = await db.collection('users').where({ phone: '13800138001' }).get()
  if (d1[0]) {
    await db.collection('users').doc(d1[0]._id).update({
      data: {
        roles: ['dispatcher'],
        currentRole: 'dispatcher',
        'roleApplications.0.status': 'active'
      }
    })
    await db.collection('dispatchers').where({ phone: '13800138001' }).update({
      data: { status: 'active' }
    })
    log('派单人审批完成')
  }

  // 审批手艺人
  const { data: d2 } = await db.collection('users').where({ phone: '13800138002' }).get()
  if (d2[0]) {
    await db.collection('users').doc(d2[0]._id).update({
      data: {
        roles: ['craftsman'],
        currentRole: 'craftsman',
        'roleApplications.0.status': 'active'
      }
    })
    await db.collection('craftsmen').where({ phone: '13800138002' }).update({
      data: { status: 'active' }
    })
    log('手艺人审批完成')
  }

  // 6. 派单人创建订单
  log('6. 派单人登录并创建订单')
  await API.call('auth', 'loginByPhone', {
    phone: '13800138001',
    password: '123456'
  })
  res = await API.call('order', 'create', {
    name: '羊毛毡测试订单',
    quantity: 10,
    price: 50,
    remark: '测试订单',
    receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  log('结果:', res)

  const orderId = res.data?.orderId
  const orderNo = res.data?.orderNo

  if (!orderId) {
    log('❌ 订单创建失败')
    return
  }

  log(`订单创建成功: ${orderNo}`)

  // 7. 手艺人接单
  log('7. 手艺人登录并接单')
  await API.call('auth', 'loginByPhone', {
    phone: '13800138002',
    password: '123456'
  })
  res = await API.call('order', 'accept', { orderId })
  log('结果:', res)

  // 8. 手艺人完成订单
  log('8. 手艺人完成订单（上传单号）')
  res = await API.call('order', 'complete', {
    orderId,
    trackingNo: 'SF1234567890',
    completionNote: '订单已完成'
  })
  log('结果:', res)

  // 9. 查询订单
  log('9. 派单人查询订单')
  await API.call('auth', 'loginByPhone', {
    phone: '13800138001',
    password: '123456'
  })
  res = await API.call('order', 'list')
  log('派单人订单:', res.data?.list?.length || 0, '条')

  log('10. 手艺人查询订单')
  await API.call('auth', 'loginByPhone', {
    phone: '13800138002',
    password: '123456'
  })
  res = await API.call('order', 'list')
  log('手艺人订单:', res.data?.list?.length || 0, '条')

  // 11. 统计
  log('11. 统计数据')
  await API.call('auth', 'loginByPhone', {
    phone: '13810062394',
    password: '880323'
  })
  res = await API.call('admin', 'getStats')
  log('统计结果:', res.data)

  console.log('\n✅ 快速测试完成!')
}

// 挂载到全局
if (typeof window !== 'undefined') window.quickTest = quickTest
if (typeof globalThis !== 'undefined') globalThis.quickTest = quickTest

console.log('✅ 快速测试脚本已加载')
console.log('执行: await quickTest()')
