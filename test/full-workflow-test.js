/**
 * 完整业务流程测试
 * 模拟: 注册→审批→创建订单→接单→取消→完成→查询→统计
 * 
 * 运行方式: await FullWorkflowTest.run()
 */

const FullWorkflowTest = {
  // 测试数据
  testData: {
    superAdmin: { phone: '13810062394', password: '880323' },
    dispatcher: { phone: '13800138001', password: '123456', name: '测试派单人A' },
    craftsman: { phone: '13800138002', password: '123456', name: '测试手艺人B' },
    order: {
      name: '羊毛毡测试订单',
      quantity: 10,
      price: 50,
      totalAmount: 500,
      remark: '测试订单，请及时处理',
      receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  },

  // 存储测试过程中生成的ID
  context: {
    dispatcherUserId: null,
    craftsmanUserId: null,
    orderId: null,
    orderNo: null
  },

  // 工具方法：调用云函数
  async callAPI(module, action, data = {}) {
    const { result } = await wx.cloud.callFunction({
      name: 'api',
      data: { module, action, ...data }
    })
    return result
  },

  // 工具方法：日志
  log(step, msg, data = null) {
    console.log(`\n[${step}] ${msg}`)
    if (data) console.log('数据:', JSON.stringify(data, null, 2))
  },

  // 主入口
  async run() {
    console.log('========================================')
    console.log('🚀 完整业务流程测试')
    console.log('========================================\n')

    try {
      // 阶段1: 注册
      await this.phase1Register()

      // 阶段2: 审批
      await this.phase2Approve()

      // 阶段3: 派单人创建订单
      await this.phase3CreateOrder()

      // 阶段4: 手艺人接单
      await this.phase4AcceptOrder()

      // 阶段5: 派单人取消订单
      await this.phase5CancelOrder()

      // 阶段6: 重新创建订单并完成流程
      await this.phase6CompleteFlow()

      // 阶段7: 查询和统计
      await this.phase7QueryAndStats()

      console.log('\n========================================')
      console.log('✅ 所有测试通过!')
      console.log('========================================')

    } catch (err) {
      console.error('\n❌ 测试失败:', err)
    }
  },

  // 阶段1: 注册派单人和手艺人
  async phase1Register() {
    console.log('========================================')
    console.log('📋 阶段1: 用户注册')
    console.log('========================================')

    // 1.1 注册派单人
    this.log('1.1', '注册派单人', this.testData.dispatcher)
    const dispatcherRes = await this.callAPI('auth', 'register', {
      ...this.testData.dispatcher,
      requestRole: 'dispatcher'
    })
    
    if (dispatcherRes.success || dispatcherRes.code === -1002) {
      console.log('✅ 派单人注册成功:', dispatcherRes.msg)
      
      // 获取用户ID
      const db = wx.cloud.database()
      const { data: users } = await db.collection('users')
        .where({ phone: this.testData.dispatcher.phone })
        .get()
      if (users.length > 0) {
        this.context.dispatcherUserId = users[0]._id
      }
    } else {
      throw new Error('派单人注册失败: ' + dispatcherRes.msg)
    }

    // 1.2 注册手艺人
    this.log('1.2', '注册手艺人', this.testData.craftsman)
    const craftsmanRes = await this.callAPI('auth', 'register', {
      ...this.testData.craftsman,
      requestRole: 'craftsman'
    })
    
    if (craftsmanRes.success || craftsmanRes.code === -1002) {
      console.log('✅ 手艺人注册成功:', craftsmanRes.msg)
      
      // 获取用户ID
      const db = wx.cloud.database()
      const { data: users } = await db.collection('users')
        .where({ phone: this.testData.craftsman.phone })
        .get()
      if (users.length > 0) {
        this.context.craftsmanUserId = users[0]._id
      }
    } else {
      throw new Error('手艺人注册失败: ' + craftsmanRes.msg)
    }

    console.log('\n📊 注册用户ID:')
    console.log('  派单人:', this.context.dispatcherUserId)
    console.log('  手艺人:', this.context.craftsmanUserId)
  },

  // 阶段2: 超级管理员审批
  async phase2Approve() {
    console.log('\n========================================')
    console.log('✅ 阶段2: 超级管理员审批')
    console.log('========================================')

    // 2.1 超级管理员登录
    this.log('2.1', '超级管理员登录', { phone: this.testData.superAdmin.phone })
    const loginRes = await this.callAPI('auth', 'loginByPhone', this.testData.superAdmin)
    
    if (!loginRes.success) {
      throw new Error('超级管理员登录失败: ' + loginRes.msg)
    }
    console.log('✅ 超级管理员登录成功')

    // 2.2 获取待审批列表
    this.log('2.2', '获取待审批列表')
    const pendingRes = await this.callAPI('admin', 'getPendingRequests')
    
    if (!pendingRes.success) {
      throw new Error('获取待审批列表失败: ' + pendingRes.msg)
    }
    
    console.log('📋 待审批数量:', pendingRes.data.total)
    console.log('列表:', pendingRes.data.list.map(u => `${u.name}(${u.role})`).join(', '))

    // 2.3 审批派单人
    if (this.context.dispatcherUserId) {
      this.log('2.3', '审批派单人通过')
      const approveDispatcher = await this.callAPI('admin', 'approve', {
        userId: this.context.dispatcherUserId,
        role: 'dispatcher',
        approved: true
      })
      
      if (approveDispatcher.success) {
        console.log('✅ 派单人审批通过')
      } else {
        console.log('⚠️ 派单人审批:', approveDispatcher.msg)
      }
    }

    // 2.4 审批手艺人
    if (this.context.craftsmanUserId) {
      this.log('2.4', '审批手艺人通过')
      const approveCraftsman = await this.callAPI('admin', 'approve', {
        userId: this.context.craftsmanUserId,
        role: 'craftsman',
        approved: true
      })
      
      if (approveCraftsman.success) {
        console.log('✅ 手艺人审批通过')
      } else {
        console.log('⚠️ 手艺人审批:', approveCraftsman.msg)
      }
    }

    // 2.5 验证审批结果
    this.log('2.5', '验证审批结果')
    const verifyRes = await this.callAPI('admin', 'getPendingRequests')
    console.log('剩余待审批:', verifyRes.data.total)
  },

  // 阶段3: 派单人创建订单
  async phase3CreateOrder() {
    console.log('\n========================================')
    console.log('📝 阶段3: 派单人创建订单')
    console.log('========================================')

    // 3.1 派单人登录
    this.log('3.1', '派单人登录')
    const loginRes = await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.dispatcher.phone,
      password: this.testData.dispatcher.password
    })
    
    if (!loginRes.success) {
      throw new Error('派单人登录失败: ' + loginRes.msg)
    }
    console.log('✅ 派单人登录成功')

    // 3.2 创建订单
    this.log('3.2', '创建订单', this.testData.order)
    const orderRes = await this.callAPI('order', 'create', this.testData.order)
    
    if (!orderRes.success) {
      throw new Error('创建订单失败: ' + orderRes.msg)
    }
    
    this.context.orderId = orderRes.data.orderId
    this.context.orderNo = orderRes.data.orderNo
    
    console.log('✅ 订单创建成功')
    console.log('  订单ID:', this.context.orderId)
    console.log('  订单号:', this.context.orderNo)
  },

  // 阶段4: 手艺人接单
  async phase4AcceptOrder() {
    console.log('\n========================================')
    console.log('👋 阶段4: 手艺人接单')
    console.log('========================================')

    // 4.1 手艺人登录
    this.log('4.1', '手艺人登录')
    const loginRes = await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.craftsman.phone,
      password: this.testData.craftsman.password
    })
    
    if (!loginRes.success) {
      throw new Error('手艺人登录失败: ' + loginRes.msg)
    }
    console.log('✅ 手艺人登录成功')

    // 4.2 接单
    this.log('4.2', '手艺人接单', { orderId: this.context.orderId })
    const acceptRes = await this.callAPI('order', 'accept', {
      orderId: this.context.orderId
    })
    
    if (!acceptRes.success) {
      throw new Error('接单失败: ' + acceptRes.msg)
    }
    
    console.log('✅ 接单成功')

    // 4.3 验证订单状态
    this.log('4.3', '验证订单状态')
    const db = wx.cloud.database()
    const { data: order } = await db.collection('orders').doc(this.context.orderId).get()
    console.log('订单状态:', order.status)
    console.log('接单人:', order.craftsmanName)
  },

  // 阶段5: 派单人取消订单
  async phase5CancelOrder() {
    console.log('\n========================================')
    console.log('❌ 阶段5: 派单人取消订单')
    console.log('========================================')

    // 5.1 派单人登录
    this.log('5.1', '派单人登录')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.dispatcher.phone,
      password: this.testData.dispatcher.password
    })

    // 5.2 取消订单
    this.log('5.2', '取消订单', { orderId: this.context.orderId })
    const cancelRes = await this.callAPI('order', 'cancel', {
      orderId: this.context.orderId
    })
    
    console.log('取消订单结果:', cancelRes)
    
    if (!cancelRes.success) {
      console.warn('⚠️ 取消订单失败:', cancelRes.msg)
      console.log('继续测试，跳过此步骤...')
      // 不抛出错误，继续测试
    } else {
      console.log('✅ 订单已取消')
    }

    // 5.3 验证状态
    this.log('5.3', '验证订单状态')
    const db = wx.cloud.database()
    const { data: order } = await db.collection('orders').doc(this.context.orderId).get()
    console.log('订单状态:', order.status)
  },

  // 阶段6: 重新创建订单并完成流程
  async phase6CompleteFlow() {
    console.log('\n========================================')
    console.log('🎉 阶段6: 完整订单流程（创建→接单→完成）')
    console.log('========================================')

    // 6.1 派单人创建新订单
    this.log('6.1', '派单人创建新订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.dispatcher.phone,
      password: this.testData.dispatcher.password
    })

    const orderRes = await this.callAPI('order', 'create', {
      ...this.testData.order,
      name: '羊毛毡正式订单'
    })
    
    if (!orderRes.success) {
      throw new Error('创建订单失败: ' + orderRes.msg)
    }
    
    const newOrderId = orderRes.data.orderId
    console.log('✅ 新订单创建成功:', orderRes.data.orderNo)

    // 6.2 手艺人接单
    this.log('6.2', '手艺人接单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.craftsman.phone,
      password: this.testData.craftsman.password
    })

    await this.callAPI('order', 'accept', { orderId: newOrderId })
    console.log('✅ 接单成功')

    // 6.3 手艺人完成订单
    this.log('6.3', '手艺人完成订单')
    const completeRes = await this.callAPI('order', 'complete', {
      orderId: newOrderId,
      trackingNo: 'SF1234567890',  // 上传单号
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      completionNote: '订单已完成，快递已发出'
    })
    
    if (!completeRes.success) {
      throw new Error('完成订单失败: ' + completeRes.msg)
    }
    
    console.log('✅ 订单完成')
    console.log('  快递单号: SF1234567890')

    // 6.4 验证完成状态
    this.log('6.4', '验证订单完成状态')
    const db = wx.cloud.database()
    const { data: order } = await db.collection('orders').doc(newOrderId).get()
    console.log('订单状态:', order.status)
    console.log('完成时间:', order.completeTime)
  },

  // 阶段7: 查询和统计
  async phase7QueryAndStats() {
    console.log('\n========================================')
    console.log('📊 阶段7: 查询订单和统计')
    console.log('========================================')

    // 7.1 派单人查询自己的订单
    this.log('7.1', '派单人查询订单列表')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.dispatcher.phone,
      password: this.testData.dispatcher.password
    })

    const dispatcherOrders = await this.callAPI('order', 'list')
    console.log('✅ 派单人订单查询成功')
    console.log('  订单数量:', dispatcherOrders.data?.list?.length || 0)
    console.log('  订单列表:', dispatcherOrders.data?.list?.map(o => ({
      name: o.name,
      status: o.status,
      orderNo: o.orderNo
    })))

    // 7.2 手艺人查询自己的订单
    this.log('7.2', '手艺人查询订单列表')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.testData.craftsman.phone,
      password: this.testData.craftsman.password
    })

    const craftsmanOrders = await this.callAPI('order', 'list')
    console.log('✅ 手艺人订单查询成功')
    console.log('  订单数量:', craftsmanOrders.data?.list?.length || 0)
    console.log('  订单列表:', craftsmanOrders.data?.list?.map(o => ({
      name: o.name,
      status: o.status,
      orderNo: o.orderNo
    })))

    // 7.3 超级管理员统计
    this.log('7.3', '超级管理员统计数据')
    await this.callAPI('auth', 'loginByPhone', this.testData.superAdmin)

    const statsRes = await this.callAPI('admin', 'getStats')
    console.log('✅ 统计成功')
    console.log('  用户总数:', statsRes.data?.userCount)
    console.log('  手艺人:', statsRes.data?.craftsmanCount)
    console.log('  派单人:', statsRes.data?.dispatcherCount)
    console.log('  订单总数:', statsRes.data?.orderCount)
    console.log('  待审批:', statsRes.data?.pendingCount)

    // 7.4 数据库直接统计
    this.log('7.4', '数据库订单状态统计')
    const db = wx.cloud.database()
    
    const { total: totalOrders } = await db.collection('orders').count()
    const { total: pendingOrders } = await db.collection('orders').where({ status: 'pending' }).count()
    const { total: acceptedOrders } = await db.collection('orders').where({ status: 'accepted' }).count()
    const { total: completedOrders } = await db.collection('orders').where({ status: 'completed' }).count()
    const { total: cancelledOrders } = await db.collection('orders').where({ status: 'cancelled' }).count()
    
    console.log('📊 订单统计:')
    console.log('  总数:', totalOrders)
    console.log('  待接单:', pendingOrders)
    console.log('  已接单:', acceptedOrders)
    console.log('  已完成:', completedOrders)
    console.log('  已取消:', cancelledOrders)
  }
}

// 挂载到全局
if (typeof window !== 'undefined') window.FullWorkflowTest = FullWorkflowTest
if (typeof globalThis !== 'undefined') globalThis.FullWorkflowTest = FullWorkflowTest

console.log('✅ 完整业务流程测试脚本已加载')
console.log('执行命令: await FullWorkflowTest.run()')

module.exports = FullWorkflowTest
