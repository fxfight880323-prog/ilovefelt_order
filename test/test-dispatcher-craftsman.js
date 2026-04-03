/**
 * ============================================
 * 派单人和手艺人功能完整测试（含注册）
 * 账号: 派单人 13800138001/123456
 *       手艺人 13800138002/123456
 * ============================================
 * 
 * 在微信开发者工具控制台运行:
 *   await TestDispatcherCraftsman.run()
 * 
 * 测试模块:
 *   Phase 1: 登录验证（自动注册）
 *   Phase 2: 超级管理员审批
 *   Phase 3: 派单人功能 - 创建订单
 *   Phase 4: 手艺人功能 - 接单、完成订单
 *   Phase 5: 派单人功能 - 订单管理
 *   Phase 6: 手艺人功能 - 订单查询
 *   Phase 7: 测试报告
 * ============================================
 */

const TestDispatcherCraftsman = {
  // ==================== 配置 ====================
  config: {
    superAdmin: {
      phone: '13810062394',
      password: '880323'
    },
    dispatcher: {
      phone: '13800138001',
      password: '123456',
      name: '测试派单人A'
    },
    craftsman: {
      phone: '13800138002',
      password: '123456',
      name: '测试手艺人B'
    },
    testOrder: {
      name: '羊毛毡测试订单',
      quantity: 10,
      price: 50,
      remark: '派单人手艺人联合测试',
      receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  },

  // ==================== 状态 ====================
  state: {
    dispatcherId: null,
    craftsmanId: null,
    dispatcherInfo: null,
    craftsmanInfo: null,
    createdOrder: null,
    acceptedOrder: null,
    completedOrder: null,
    results: [],
    startTime: null,
    endTime: null
  },

  // ==================== 工具方法 ====================
  
  // API调用封装
  async callAPI(module, action, data = {}) {
    const { result } = await wx.cloud.callFunction({
      name: 'api',
      data: { module, action, ...data }
    })
    return result
  },

  // 数据库操作
  db() {
    return wx.cloud.database()
  },

  // 记录结果
  record(phase, testName, success, message = '', data = null) {
    const icon = success ? '✅' : '❌'
    console.log(`\n${icon} [${phase}] ${testName}`)
    if (message) console.log(`   消息: ${message}`)
    if (data) console.log(`   数据:`, JSON.stringify(data, null, 2))
    
    this.state.results.push({
      phase,
      testName,
      success,
      message,
      time: new Date().toLocaleTimeString()
    })
  },

  // ==================== 主入口 ====================
  async run(options = {}) {
    this.state.startTime = Date.now()
    this.state.results = []
    
    console.log('\n' + '='.repeat(60))
    console.log('🚀 派单人 & 手艺人功能完整测试（含注册）')
    console.log('='.repeat(60))
    console.log(`派单人: ${this.config.dispatcher.phone} / ${this.config.dispatcher.password}`)
    console.log(`手艺人: ${this.config.craftsman.phone} / ${this.config.craftsman.password}`)
    console.log('='.repeat(60) + '\n')

    try {
      // Phase 1: 登录验证（自动注册）
      await this.phase1_LoginAndRegister()

      // Phase 2: 超级管理员审批
      await this.phase2_SuperAdminApproval()

      // Phase 3: 派单人功能 - 创建订单
      await this.phase3_DispatcherCreateOrder()

      // Phase 4: 手艺人功能 - 接单、完成
      await this.phase4_CraftsmanAcceptAndComplete()

      // Phase 5: 派单人功能 - 订单管理
      await this.phase5_DispatcherOrderManagement()

      // Phase 6: 手艺人功能 - 订单查询
      await this.phase6_CraftsmanOrderQuery()

      // Phase 7: 统计报告
      await this.generateReport()

    } catch (err) {
      console.error('\n❌ 测试执行异常:', err)
      this.record('系统', '测试执行', false, err.message)
    }

    this.state.endTime = Date.now()
    const duration = ((this.state.endTime - this.state.startTime) / 1000).toFixed(2)
    
    console.log('\n' + '='.repeat(60))
    console.log(`⏱️  测试耗时: ${duration}秒`)
    console.log('='.repeat(60))

    return this.state.results
  },

  // ==================== Phase 1: 登录验证（自动注册） ====================
  async phase1_LoginAndRegister() {
    console.log('\n📋 Phase 1: 登录验证（自动注册）')
    console.log('='.repeat(40))

    // 1.1 尝试派单人登录（如果不存在则自动注册）
    console.log('\n> 尝试派单人登录...')
    let dispatcherLogin = await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.dispatcher.phone,
      password: this.config.dispatcher.password
    })
    
    // 如果登录失败（账号不存在），进行注册
    if (!dispatcherLogin.success && dispatcherLogin.code === -1003) {
      console.log('   账号不存在，准备注册...')
      
      // 注册派单人
      const registerRes = await this.callAPI('auth', 'register', {
        phone: this.config.dispatcher.phone,
        password: this.config.dispatcher.password,
        name: this.config.dispatcher.name,
        requestRole: 'dispatcher'
      })
      
      if (registerRes.success) {
        this.record('注册流程', '派单人注册', true, '注册申请已提交，等待审批')
        
        // 获取用户ID
        const { data: users } = await this.db().collection('users')
          .where({ phone: this.config.dispatcher.phone })
          .get()
        if (users[0]) {
          this.state.dispatcherId = users[0]._id
        }
      } else {
        this.record('注册流程', '派单人注册', false, registerRes.msg)
      }
    } else if (dispatcherLogin.success) {
      this.state.dispatcherInfo = dispatcherLogin.data
      this.record('登录验证', '派单人登录', true, 
        `${dispatcherLogin.data.name} (${dispatcherLogin.data.currentRole || '无角色'})`,
        { roles: dispatcherLogin.data.roles, isSuperAdmin: dispatcherLogin.data.isSuperAdmin })
      
      // 获取用户ID
      const { data: users } = await this.db().collection('users')
        .where({ phone: this.config.dispatcher.phone })
        .get()
      if (users[0]) {
        this.state.dispatcherId = users[0]._id
      }
    } else {
      this.record('登录验证', '派单人登录', false, dispatcherLogin.msg)
    }

    // 1.2 尝试手艺人登录（如果不存在则自动注册）
    console.log('\n> 尝试手艺人登录...')
    let craftsmanLogin = await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.craftsman.phone,
      password: this.config.craftsman.password
    })
    
    // 如果登录失败（账号不存在），进行注册
    if (!craftsmanLogin.success && craftsmanLogin.code === -1003) {
      console.log('   账号不存在，准备注册...')
      
      // 注册手艺人
      const registerRes = await this.callAPI('auth', 'register', {
        phone: this.config.craftsman.phone,
        password: this.config.craftsman.password,
        name: this.config.craftsman.name,
        requestRole: 'craftsman'
      })
      
      if (registerRes.success) {
        this.record('注册流程', '手艺人注册', true, '注册申请已提交，等待审批')
        
        // 获取用户ID
        const { data: users } = await this.db().collection('users')
          .where({ phone: this.config.craftsman.phone })
          .get()
        if (users[0]) {
          this.state.craftsmanId = users[0]._id
        }
      } else {
        this.record('注册流程', '手艺人注册', false, registerRes.msg)
      }
    } else if (craftsmanLogin.success) {
      this.state.craftsmanInfo = craftsmanLogin.data
      this.record('登录验证', '手艺人登录', true, 
        `${craftsmanLogin.data.name} (${craftsmanLogin.data.currentRole || '无角色'})`,
        { roles: craftsmanLogin.data.roles })
      
      // 获取用户ID
      const { data: users } = await this.db().collection('users')
        .where({ phone: this.config.craftsman.phone })
        .get()
      if (users[0]) {
        this.state.craftsmanId = users[0]._id
      }
    } else {
      this.record('登录验证', '手艺人登录', false, craftsmanLogin.msg)
    }
  },

  // ==================== Phase 2: 超级管理员审批 ====================
  async phase2_SuperAdminApproval() {
    console.log('\n📋 Phase 2: 超级管理员审批')
    console.log('='.repeat(40))

    // 2.1 超级管理员登录
    console.log('\n> 超级管理员登录...')
    const adminLogin = await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.superAdmin.phone,
      password: this.config.superAdmin.password
    })
    
    if (!adminLogin.success) {
      this.record('审批流程', '超级管理员登录', false, adminLogin.msg)
      throw new Error('超级管理员登录失败')
    }
    this.record('审批流程', '超级管理员登录', true, adminLogin.data.name)

    // 2.2 获取待审批列表
    console.log('\n> 获取待审批列表...')
    const pendingRes = await this.callAPI('admin', 'getPendingRequests')
    if (pendingRes.success) {
      this.record('审批流程', '获取待审批列表', true, 
        `${pendingRes.data.total} 条待审批`,
        { list: pendingRes.data.list.map(u => `${u.name}(${u.role})`) })
    } else {
      this.record('审批流程', '获取待审批列表', false, pendingRes.msg)
    }

    // 2.3 审批派单人
    if (this.state.dispatcherId) {
      console.log('\n> 审批派单人...')
      
      // 先检查当前状态
      const { data: dispatcherUser } = await this.db().collection('users')
        .doc(this.state.dispatcherId)
        .get()
      const dispatcherApp = dispatcherUser.roleApplications?.find(app => app.role === 'dispatcher')
      
      if (dispatcherApp?.status === 'pending') {
        // 使用API审批
        const approveRes = await this.callAPI('admin', 'approve', {
          userId: this.state.dispatcherId,
          role: 'dispatcher',
          approved: true
        })
        this.record('审批流程', '派单人审批', approveRes.success, 
          approveRes.msg || '审批完成',
          { userId: this.state.dispatcherId })
      } else if (dispatcherApp?.status === 'active' || dispatcherUser.roles?.includes('dispatcher')) {
        this.record('审批流程', '派单人审批', true, '已经是审批通过状态')
      } else {
        // 直接数据库操作
        await this.db().collection('users').doc(this.state.dispatcherId).update({
          data: {
            roles: this.db().command.push(['dispatcher']),
            currentRole: 'dispatcher',
            'roleApplications.0.status': 'active'
          }
        })
        await this.db().collection('dispatchers').where({ 
          phone: this.config.dispatcher.phone 
        }).update({
          data: { status: 'active' }
        })
        this.record('审批流程', '派单人审批', true, '已通过数据库更新')
      }
    }

    // 2.4 审批手艺人
    if (this.state.craftsmanId) {
      console.log('\n> 审批手艺人...')
      
      // 先检查当前状态
      const { data: craftsmanUser } = await this.db().collection('users')
        .doc(this.state.craftsmanId)
        .get()
      const craftsmanApp = craftsmanUser.roleApplications?.find(app => app.role === 'craftsman')
      
      if (craftsmanApp?.status === 'pending') {
        // 使用API审批
        const approveRes = await this.callAPI('admin', 'approve', {
          userId: this.state.craftsmanId,
          role: 'craftsman',
          approved: true
        })
        this.record('审批流程', '手艺人审批', approveRes.success, 
          approveRes.msg || '审批完成',
          { userId: this.state.craftsmanId })
      } else if (craftsmanApp?.status === 'active' || craftsmanUser.roles?.includes('craftsman')) {
        this.record('审批流程', '手艺人审批', true, '已经是审批通过状态')
      } else {
        // 直接数据库操作
        await this.db().collection('users').doc(this.state.craftsmanId).update({
          data: {
            roles: this.db().command.push(['craftsman']),
            currentRole: 'craftsman',
            'roleApplications.0.status': 'active'
          }
        })
        await this.db().collection('craftsmen').where({ 
          phone: this.config.craftsman.phone 
        }).update({
          data: { status: 'active' }
        })
        this.record('审批流程', '手艺人审批', true, '已通过数据库更新')
      }
    }

    // 2.5 重新登录验证审批结果
    console.log('\n> 验证审批结果...')
    
    // 派单人重新登录
    const dispatcherReLogin = await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.dispatcher.phone,
      password: this.config.dispatcher.password
    })
    if (dispatcherReLogin.success) {
      this.state.dispatcherInfo = dispatcherReLogin.data
      this.record('审批流程', '派单人重新登录', true, 
        `角色: ${dispatcherReLogin.data.currentRole}`,
        { roles: dispatcherReLogin.data.roles })
    }

    // 手艺人重新登录
    const craftsmanReLogin = await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.craftsman.phone,
      password: this.config.craftsman.password
    })
    if (craftsmanReLogin.success) {
      this.state.craftsmanInfo = craftsmanReLogin.data
      this.record('审批流程', '手艺人重新登录', true, 
        `角色: ${craftsmanReLogin.data.currentRole}`,
        { roles: craftsmanReLogin.data.roles })
    }
  },

  // ==================== Phase 3: 派单人功能 - 创建订单 ====================
  async phase3_DispatcherCreateOrder() {
    console.log('\n📋 Phase 3: 派单人功能 - 创建订单')
    console.log('='.repeat(40))

    // 3.1 切换到派单人登录
    console.log('\n> 切换到派单人...')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.dispatcher.phone,
      password: this.config.dispatcher.password
    })

    // 3.2 创建订单
    console.log('\n> 创建测试订单...')
    const createRes = await this.callAPI('order', 'create', this.config.testOrder)
    
    if (createRes.success) {
      this.state.createdOrder = createRes.data
      this.record('派单人功能', '创建订单', true, 
        `订单号: ${createRes.data.orderNo}`,
        { orderId: createRes.data.orderId, orderNo: createRes.data.orderNo })
    } else {
      this.record('派单人功能', '创建订单', false, createRes.msg)
      return
    }

    // 3.3 查询派单人的订单列表
    console.log('\n> 查询派单人订单列表...')
    const orderListRes = await this.callAPI('order', 'list', { role: 'dispatcher' })
    if (orderListRes.success) {
      this.record('派单人功能', '查询订单列表', true, 
        `${orderListRes.data.list?.length || 0} 条订单`,
        { orders: orderListRes.data.list?.map(o => ({ orderNo: o.orderNo, status: o.status })) })
    } else {
      this.record('派单人功能', '查询订单列表', false, orderListRes.msg)
    }
  },

  // ==================== Phase 4: 手艺人功能 - 接单、完成 ====================
  async phase4_CraftsmanAcceptAndComplete() {
    console.log('\n📋 Phase 4: 手艺人功能 - 接单、完成订单')
    console.log('='.repeat(40))

    if (!this.state.createdOrder) {
      this.record('手艺人功能', '接单', false, '没有可接的订单')
      return
    }

    // 4.1 切换到手艺人登录
    console.log('\n> 切换到手艺人...')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.craftsman.phone,
      password: this.config.craftsman.password
    })

    // 4.2 接单
    console.log('\n> 手艺人接单...')
    const acceptRes = await this.callAPI('order', 'accept', {
      orderId: this.state.createdOrder.orderId
    })
    
    if (acceptRes.success) {
      this.state.acceptedOrder = this.state.createdOrder
      this.record('手艺人功能', '接单', true, 
        `订单号: ${this.state.createdOrder.orderNo}`)
    } else {
      this.record('手艺人功能', '接单', false, acceptRes.msg)
      return
    }

    // 4.3 验证订单状态
    console.log('\n> 验证订单状态...')
    const { data: order } = await this.db().collection('orders')
      .doc(this.state.createdOrder.orderId)
      .get()
    
    this.record('手艺人功能', '订单状态验证', 
      order.status === 'accepted',
      `当前状态: ${order.status}`,
      { 
        orderNo: order.orderNo, 
        status: order.status,
        craftsmanName: order.craftsmanName,
        craftsmanPhone: order.craftsmanPhone,
        acceptTime: order.acceptTime
      })

    // 4.4 完成订单
    console.log('\n> 完成订单...')
    const completeRes = await this.callAPI('order', 'complete', {
      orderId: this.state.createdOrder.orderId,
      trackingNo: 'SF' + Date.now().toString().slice(-10),
      completionNote: '手艺人测试完成备注'
    })
    
    if (completeRes.success) {
      this.state.completedOrder = this.state.createdOrder
      this.record('手艺人功能', '完成订单', true, 
        `订单号: ${this.state.createdOrder.orderNo}`)
    } else {
      this.record('手艺人功能', '完成订单', false, completeRes.msg)
    }

    // 4.5 验证完成状态
    console.log('\n> 验证完成状态...')
    const { data: completedOrder } = await this.db().collection('orders')
      .doc(this.state.createdOrder.orderId)
      .get()
    
    this.record('手艺人功能', '完成状态验证', 
      completedOrder.status === 'completed',
      `状态: ${completedOrder.status}`,
      { 
        orderNo: completedOrder.orderNo,
        status: completedOrder.status,
        trackingNo: completedOrder.trackingNo,
        completionNote: completedOrder.completionNote,
        completeTime: completedOrder.completeTime
      })
  },

  // ==================== Phase 5: 派单人功能 - 订单管理 ====================
  async phase5_DispatcherOrderManagement() {
    console.log('\n📋 Phase 5: 派单人功能 - 订单管理')
    console.log('='.repeat(40))

    // 5.1 切换到派单人登录
    console.log('\n> 切换到派单人...')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.dispatcher.phone,
      password: this.config.dispatcher.password
    })

    // 5.2 创建第二个订单用于取消测试
    console.log('\n> 创建测试订单用于取消...')
    const cancelTestOrder = await this.callAPI('order', 'create', {
      ...this.config.testOrder,
      name: '取消测试订单'
    })

    if (cancelTestOrder.success) {
      this.record('派单人功能', '创建测试订单', true, 
        `订单号: ${cancelTestOrder.data.orderNo}`)

      // 5.3 取消订单
      console.log('\n> 取消订单...')
      const cancelRes = await this.callAPI('order', 'cancel', {
        orderId: cancelTestOrder.data.orderId
      })
      
      this.record('派单人功能', '取消订单', 
        cancelRes.success,
        cancelRes.msg || '取消功能正常')

      // 验证取消状态
      const { data: cancelledOrder } = await this.db().collection('orders')
        .doc(cancelTestOrder.data.orderId)
        .get()
      
      this.record('派单人功能', '取消状态验证', 
        cancelledOrder.status === 'cancelled',
        `状态: ${cancelledOrder.status}`,
        { orderNo: cancelledOrder.orderNo, cancelTime: cancelledOrder.cancelTime })
    } else {
      this.record('派单人功能', '创建测试订单', false, cancelTestOrder.msg)
    }

    // 5.4 再次查询订单列表
    console.log('\n> 查询派单人所有订单...')
    const allOrdersRes = await this.callAPI('order', 'list', { role: 'dispatcher' })
    if (allOrdersRes.success) {
      const orderSummary = allOrdersRes.data.list?.map(o => ({
        orderNo: o.orderNo,
        name: o.name,
        status: o.status,
        totalAmount: o.totalAmount
      }))
      
      this.record('派单人功能', '查询所有订单', true, 
        `${allOrdersRes.data.list?.length || 0} 条订单`,
        { orders: orderSummary })
    } else {
      this.record('派单人功能', '查询所有订单', false, allOrdersRes.msg)
    }
  },

  // ==================== Phase 6: 手艺人功能 - 订单查询 ====================
  async phase6_CraftsmanOrderQuery() {
    console.log('\n📋 Phase 6: 手艺人功能 - 订单查询')
    console.log('='.repeat(40))

    // 6.1 切换到手艺人登录
    console.log('\n> 切换到手艺人...')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.craftsman.phone,
      password: this.config.craftsman.password
    })

    // 6.2 查询手艺人订单列表
    console.log('\n> 查询手艺人订单列表...')
    const craftsmanOrdersRes = await this.callAPI('order', 'list', { role: 'craftsman' })
    if (craftsmanOrdersRes.success) {
      const orderSummary = craftsmanOrdersRes.data.list?.map(o => ({
        orderNo: o.orderNo,
        name: o.name,
        status: o.status,
        dispatcherName: o.dispatcherName,
        totalAmount: o.totalAmount
      }))
      
      this.record('手艺人功能', '查询订单列表', true, 
        `${craftsmanOrdersRes.data.list?.length || 0} 条订单`,
        { orders: orderSummary })
    } else {
      this.record('手艺人功能', '查询订单列表', false, craftsmanOrdersRes.msg)
    }

    // 6.3 按状态筛选订单
    console.log('\n> 按状态筛选已完成的订单...')
    const completedOrdersRes = await this.callAPI('order', 'list', { 
      role: 'craftsman',
      status: 'completed' 
    })
    if (completedOrdersRes.success) {
      this.record('手艺人功能', '筛选已完成订单', true, 
        `${completedOrdersRes.data.list?.length || 0} 条已完成订单`)
    } else {
      this.record('手艺人功能', '筛选已完成订单', false, completedOrdersRes.msg)
    }

    // 6.4 查询已接单的订单
    console.log('\n> 按状态筛选已接单的订单...')
    const acceptedOrdersRes = await this.callAPI('order', 'list', { 
      role: 'craftsman',
      status: 'accepted' 
    })
    if (acceptedOrdersRes.success) {
      this.record('手艺人功能', '筛选已接订单', true, 
        `${acceptedOrdersRes.data.list?.length || 0} 条已接订单`)
    } else {
      this.record('手艺人功能', '筛选已接订单', false, acceptedOrdersRes.msg)
    }
  },

  // ==================== 生成报告 ====================
  async generateReport() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 测试报告')
    console.log('='.repeat(60))

    const passed = this.state.results.filter(r => r.success).length
    const failed = this.state.results.filter(r => !r.success).length
    const total = this.state.results.length

    console.log(`\n总计: ${total} 项测试`)
    console.log(`✅ 通过: ${passed} 项 (${((passed/total)*100).toFixed(1)}%)`)
    console.log(`❌ 失败: ${failed} 项 (${((failed/total)*100).toFixed(1)}%)`)

    // 按阶段分组显示
    const phases = ['注册流程', '登录验证', '审批流程', '派单人功能', '手艺人功能', '系统']
    phases.forEach(phase => {
      const phaseResults = this.state.results.filter(r => r.phase === phase)
      if (phaseResults.length > 0) {
        console.log(`\n${phase}:`)
        phaseResults.forEach(r => {
          const icon = r.success ? '✅' : '❌'
          console.log(`  ${icon} ${r.testName}: ${r.message}`)
        })
      }
    })

    if (failed > 0) {
      console.log('\n❌ 失败的测试项:')
      this.state.results.filter(r => !r.success).forEach(r => {
        console.log(`  - [${r.phase}] ${r.testName}: ${r.message}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('测试完成时间:', new Date().toLocaleString())
    console.log('='.repeat(60))

    return { passed, failed, total }
  }
}

// ==================== 挂载到全局 ====================
if (typeof window !== 'undefined') {
  window.TestDispatcherCraftsman = TestDispatcherCraftsman
}
if (typeof globalThis !== 'undefined') {
  globalThis.TestDispatcherCraftsman = TestDispatcherCraftsman
}

console.log('\n' + '='.repeat(60))
console.log('✅ TestDispatcherCraftsman 已加载（含注册测试）')
console.log('='.repeat(60))
console.log('测试账号:')
console.log(`  派单人: ${TestDispatcherCraftsman.config.dispatcher.phone} / ${TestDispatcherCraftsman.config.dispatcher.password}`)
console.log(`  手艺人: ${TestDispatcherCraftsman.config.craftsman.phone} / ${TestDispatcherCraftsman.config.craftsman.password}`)
console.log(`  超级管理员: ${TestDispatcherCraftsman.config.superAdmin.phone} / ${TestDispatcherCraftsman.config.superAdmin.password}`)
console.log('-'.repeat(60))
console.log('使用方式:')
console.log('  await TestDispatcherCraftsman.run()  // 运行完整测试（含注册）')
console.log('='.repeat(60) + '\n')

module.exports = TestDispatcherCraftsman
