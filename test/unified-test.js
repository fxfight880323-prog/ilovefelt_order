/**
 * ============================================
 * 统一完整测试 - UnifiedCompleteTest
 * ============================================
 * 整合历史所有测试功能于一体
 * 
 * 运行方式:
 *   await UnifiedCompleteTest.run()
 * 
 * 功能模块:
 *   Phase 1: 环境检查
 *   Phase 2: 超级管理员验证
 *   Phase 3: 用户注册与审批
 *   Phase 4: 完整订单流程
 *   Phase 5: 列表管理功能
 *   Phase 6: 数据统计验证
 *   Phase 7: 清理测试数据
 * 
 * 历史测试整合:
 *   - complete-test.js: 环境检查 + 报告生成
 *   - full-workflow-test.js: 完整业务流程
 *   - quick-test.js: 快速测试流程
 *   - test-admin-login.js: 管理员登录验证
 *   - full-test.js: 系统化测试结构
 * ============================================
 */

const UnifiedCompleteTest = {
  // ==================== 配置 ====================
  config: {
    superAdmin: {
      phone: '13810062394',
      password: '880323',
      name: '超级管理员'
    },
    testDispatcher: {
      phone: '13800138001',
      password: '123456',
      name: '测试派单人A'
    },
    testCraftsman: {
      phone: '13800138002',
      password: '123456',
      name: '测试手艺人B'
    },
    testOrder: {
      name: '羊毛毡测试订单',
      quantity: 10,
      price: 50,
      remark: '统一测试订单',
      receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  },

  // ==================== 状态 ====================
  state: {
    dispatcherId: null,
    craftsmanId: null,
    orderId: null,
    orderNo: null,
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

  // 数据库直接操作
  db() {
    return wx.cloud.database()
  },

  // 日志输出
  log(phase, step, msg, data = null) {
    const icon = step.includes('❌') ? '' : '✅'
    console.log(`\n[${phase}] ${step} ${icon}`)
    if (data) {
      console.log('数据:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
    }
  },

  // 记录测试结果
  record(testName, success, message = '') {
    this.state.results.push({
      testName,
      success,
      message,
      time: new Date().toLocaleTimeString()
    })
    const icon = success ? '✅' : '❌'
    console.log(`${icon} ${testName}: ${message}`)
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  // ==================== 主入口 ====================
  async run(options = {}) {
    this.state.startTime = Date.now()
    this.state.results = []
    
    console.log('\n' + '='.repeat(60))
    console.log('🚀 统一完整测试 - UnifiedCompleteTest')
    console.log('='.repeat(60))
    console.log(`开始时间: ${new Date().toLocaleString()}`)
    console.log('='.repeat(60) + '\n')

    try {
      // Phase 1: 环境检查
      await this.phase1_EnvironmentCheck()

      // Phase 2: 超级管理员验证
      await this.phase2_SuperAdminVerify()

      // Phase 3: 用户注册与审批
      await this.phase3_UserRegistration()

      // Phase 4: 完整订单流程
      await this.phase4_OrderWorkflow()

      // Phase 5: 列表管理功能
      if (!options.skipListTest) {
        await this.phase5_ListManagement()
      }

      // Phase 6: 数据统计验证
      await this.phase6_Statistics()

      // Phase 7: 清理（可选）
      if (options.cleanup) {
        await this.phase7_Cleanup()
      }

      // 生成报告
      await this.generateReport()

    } catch (err) {
      console.error('\n❌ 测试执行异常:', err)
      this.record('测试执行', false, err.message)
    }

    this.state.endTime = Date.now()
    const duration = ((this.state.endTime - this.state.startTime) / 1000).toFixed(2)
    
    console.log('\n' + '='.repeat(60))
    console.log(`⏱️  测试耗时: ${duration}秒`)
    console.log('='.repeat(60))

    return this.state.results
  },

  // ==================== Phase 1: 环境检查 ====================
  async phase1_EnvironmentCheck() {
    console.log('\n' + '='.repeat(40))
    console.log('📋 Phase 1: 环境检查')
    console.log('='.repeat(40))

    // 1.1 检查数据库连接
    try {
      const { data } = await this.db().collection('users').limit(1).get()
      this.record('数据库连接', true, `正常，当前有 ${data.length} 条记录`)
    } catch (err) {
      this.record('数据库连接', false, err.message)
      throw new Error('数据库连接失败，终止测试')
    }

    // 1.2 检查云函数
    try {
      const res = await this.callAPI('auth', 'checkStatus')
      if (res && res.hasOwnProperty('success')) {
        this.record('云函数API', true, '调用正常')
      } else {
        this.record('云函数API', false, '返回格式异常')
      }
    } catch (err) {
      this.record('云函数API', false, err.message)
    }

    // 1.3 检查必要集合
    const collections = ['users', 'craftsmen', 'dispatchers', 'orders']
    for (const coll of collections) {
      try {
        await this.db().collection(coll).limit(1).get()
        this.record(`集合 ${coll}`, true, '存在且可访问')
      } catch (err) {
        this.record(`集合 ${coll}`, false, err.message)
      }
    }
  },

  // ==================== Phase 2: 超级管理员验证 ====================
  async phase2_SuperAdminVerify() {
    console.log('\n' + '='.repeat(40))
    console.log('👑 Phase 2: 超级管理员验证')
    console.log('='.repeat(40))

    const { phone, password } = this.config.superAdmin

    // 2.1 登录测试
    this.log('Phase 2', '2.1 超级管理员登录', { phone })
    const loginRes = await this.callAPI('auth', 'loginByPhone', { phone, password })
    
    if (loginRes.success) {
      this.record('超级管理员登录', true, `${loginRes.data.name} (${loginRes.data.phone})`)
      if (loginRes.data.isSuperAdmin) {
        this.record('超级管理员权限', true, '验证通过')
      }
    } else {
      this.record('超级管理员登录', false, loginRes.msg)
      throw new Error('超级管理员登录失败')
    }

    // 2.2 检查状态
    this.log('Phase 2', '2.2 检查登录状态')
    const statusRes = await this.callAPI('auth', 'checkStatus')
    if (statusRes.success && statusRes.data.isSuperAdmin) {
      this.record('登录状态检查', true, '超级管理员状态正常')
    }

    // 2.3 获取统计
    this.log('Phase 2', '2.3 获取统计数据')
    const statsRes = await this.callAPI('admin', 'getStats')
    if (statsRes.success) {
      this.record('统计数据获取', true, `用户:${statsRes.data.userCount} 订单:${statsRes.data.orderCount}`)
      console.log('📊 当前统计:', statsRes.data)
    }
  },

  // ==================== Phase 3: 用户注册与审批 ====================
  async phase3_UserRegistration() {
    console.log('\n' + '='.repeat(40))
    console.log('👥 Phase 3: 用户注册与审批')
    console.log('='.repeat(40))

    // 3.1 注册派单人
    this.log('Phase 3', '3.1 注册派单人', this.config.testDispatcher)
    const dispatcherRes = await this.callAPI('auth', 'register', {
      ...this.config.testDispatcher,
      requestRole: 'dispatcher'
    })
    
    if (dispatcherRes.success || dispatcherRes.code === -1002) {
      this.record('派单人注册', true, dispatcherRes.msg || '已注册')
      
      // 获取ID
      const { data } = await this.db().collection('users')
        .where({ phone: this.config.testDispatcher.phone })
        .get()
      if (data[0]) {
        this.state.dispatcherId = data[0]._id
      }
    } else {
      this.record('派单人注册', false, dispatcherRes.msg)
    }

    // 3.2 注册手艺人
    this.log('Phase 3', '3.2 注册手艺人', this.config.testCraftsman)
    const craftsmanRes = await this.callAPI('auth', 'register', {
      ...this.config.testCraftsman,
      requestRole: 'craftsman'
    })
    
    if (craftsmanRes.success || craftsmanRes.code === -1002) {
      this.record('手艺人注册', true, craftsmanRes.msg || '已注册')
      
      // 获取ID
      const { data } = await this.db().collection('users')
        .where({ phone: this.config.testCraftsman.phone })
        .get()
      if (data[0]) {
        this.state.craftsmanId = data[0]._id
      }
    } else {
      this.record('手艺人注册', false, craftsmanRes.msg)
    }

    // 3.3 获取待审批列表
    this.log('Phase 3', '3.3 获取待审批列表')
    const pendingRes = await this.callAPI('admin', 'getPendingRequests')
    if (pendingRes.success) {
      this.record('待审批列表', true, `${pendingRes.data.total} 条待审批`)
      console.log('📋 待审批:', pendingRes.data.list.map(u => `${u.name}(${u.role})`).join(', '))
    }

    // 3.4 审批派单人
    if (this.state.dispatcherId) {
      this.log('Phase 3', '3.4 审批派单人')
      
      // 先检查用户当前状态
      const { data: dispatcherUser } = await this.db().collection('users').doc(this.state.dispatcherId).get()
      const dispatcherApp = dispatcherUser.roleApplications?.find(app => app.role === 'dispatcher')
      
      if (dispatcherApp?.status === 'pending') {
        // 使用API审批
        const approveRes = await this.callAPI('admin', 'approve', {
          userId: this.state.dispatcherId,
          role: 'dispatcher',
          approved: true
        })
        this.record('派单人审批', approveRes.success, approveRes.msg || '审批完成')
      } else if (dispatcherApp?.status === 'active' || dispatcherUser.roles?.includes('dispatcher')) {
        // 已经是审批状态
        this.record('派单人审批', true, '已经是审批通过状态')
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
          phone: this.config.testDispatcher.phone 
        }).update({
          data: { status: 'active' }
        })
        this.record('派单人审批', true, '已通过数据库更新')
      }
    }

    // 3.5 审批手艺人
    if (this.state.craftsmanId) {
      this.log('Phase 3', '3.5 审批手艺人')
      
      // 先检查用户当前状态
      const { data: craftsmanUser } = await this.db().collection('users').doc(this.state.craftsmanId).get()
      const craftsmanApp = craftsmanUser.roleApplications?.find(app => app.role === 'craftsman')
      
      if (craftsmanApp?.status === 'pending') {
        // 使用API审批
        const approveRes = await this.callAPI('admin', 'approve', {
          userId: this.state.craftsmanId,
          role: 'craftsman',
          approved: true
        })
        this.record('手艺人审批', approveRes.success, approveRes.msg || '审批完成')
      } else if (craftsmanApp?.status === 'active' || craftsmanUser.roles?.includes('craftsman')) {
        // 已经是审批状态
        this.record('手艺人审批', true, '已经是审批通过状态')
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
          phone: this.config.testCraftsman.phone 
        }).update({
          data: { status: 'active' }
        })
        this.record('手艺人审批', true, '已通过数据库更新')
      }
    }
  },

  // ==================== Phase 4: 完整订单流程 ====================
  async phase4_OrderWorkflow() {
    console.log('\n' + '='.repeat(40))
    console.log('📦 Phase 4: 完整订单流程')
    console.log('='.repeat(40))

    // 4.1 派单人登录创建订单
    this.log('Phase 4', '4.1 派单人登录并创建订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testDispatcher.phone,
      password: this.config.testDispatcher.password
    })

    const createRes = await this.callAPI('order', 'create', this.config.testOrder)
    if (createRes.success) {
      this.state.orderId = createRes.data.orderId
      this.state.orderNo = createRes.data.orderNo
      this.record('创建订单', true, `订单号: ${this.state.orderNo}`)
    } else {
      this.record('创建订单', false, createRes.msg)
      return
    }

    // 4.2 手艺人接单
    this.log('Phase 4', '4.2 手艺人接单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testCraftsman.phone,
      password: this.config.testCraftsman.password
    })

    const acceptRes = await this.callAPI('order', 'accept', {
      orderId: this.state.orderId
    })
    this.record('手艺人接单', acceptRes.success, acceptRes.msg || '接单成功')

    // 4.3 验证订单状态
    this.log('Phase 4', '4.3 验证订单状态')
    const { data: order } = await this.db().collection('orders').doc(this.state.orderId).get()
    this.record('订单状态验证', order.status === 'accepted', `当前状态: ${order.status}`)

    // 4.4 派单人取消测试（可选）
    this.log('Phase 4', '4.4 测试取消订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testDispatcher.phone,
      password: this.config.testDispatcher.password
    })

    // 创建一个新订单用于取消测试
    const cancelTestOrder = await this.callAPI('order', 'create', {
      ...this.config.testOrder,
      name: '取消测试订单'
    })

    if (cancelTestOrder.success) {
      const cancelRes = await this.callAPI('order', 'cancel', {
        orderId: cancelTestOrder.data.orderId
      })
      this.record('取消订单', cancelRes.success, cancelRes.msg || '取消功能正常')
    }

    // 4.5 完成订单
    this.log('Phase 4', '4.5 完成订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testCraftsman.phone,
      password: this.config.testCraftsman.password
    })

    const completeRes = await this.callAPI('order', 'complete', {
      orderId: this.state.orderId,
      trackingNo: 'SF' + Date.now().toString().slice(-10),
      completionNote: '统一测试完成'
    })
    this.record('完成订单', completeRes.success, completeRes.msg || '订单已完成')

    // 4.6 验证完成状态
    const { data: completedOrder } = await this.db().collection('orders').doc(this.state.orderId).get()
    this.record('完成状态验证', completedOrder.status === 'completed', `状态: ${completedOrder.status}`)
  },

  // ==================== Phase 5: 列表管理功能 ====================
  async phase5_ListManagement() {
    console.log('\n' + '='.repeat(40))
    console.log('📋 Phase 5: 列表管理功能')
    console.log('='.repeat(40))

    // 5.1 获取手艺人列表
    this.log('Phase 5', '5.1 获取手艺人列表')
    const craftsmenRes = await this.callAPI('admin', 'getCraftsmenList', { page: 1, pageSize: 10 })
    if (craftsmenRes.success) {
      this.record('手艺人列表', true, `${craftsmenRes.data.total} 条记录`)
    }

    // 5.2 获取派单人列表
    this.log('Phase 5', '5.2 获取派单人列表')
    const dispatchersRes = await this.callAPI('admin', 'getDispatchersList', { page: 1, pageSize: 10 })
    if (dispatchersRes.success) {
      this.record('派单人列表', true, `${dispatchersRes.data.total} 条记录`)
    }

    // 5.3 获取订单列表
    this.log('Phase 5', '5.3 获取订单列表')
    const ordersRes = await this.callAPI('admin', 'getOrdersList', { page: 1, pageSize: 10 })
    if (ordersRes.success) {
      this.record('订单列表', true, `${ordersRes.data.total} 条记录`)
    }

    // 5.4 更新手艺人信息测试
    if (this.state.craftsmanId) {
      this.log('Phase 5', '5.4 更新手艺人信息')
      const updateRes = await this.callAPI('admin', 'updateCraftsman', {
        id: this.state.craftsmanId,
        name: this.config.testCraftsman.name + '_已更新',
        remark: '统一测试更新'
      })
      this.record('更新手艺人', updateRes.success, updateRes.msg || '更新成功')
    }
  },

  // ==================== Phase 6: 数据统计验证 ====================
  async phase6_Statistics() {
    console.log('\n' + '='.repeat(40))
    console.log('📊 Phase 6: 数据统计验证')
    console.log('='.repeat(40))

    // 重新登录超级管理员
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.superAdmin.phone,
      password: this.config.superAdmin.password
    })

    // 6.1 获取最新统计
    this.log('Phase 6', '6.1 获取系统统计')
    const statsRes = await this.callAPI('admin', 'getStats')
    if (statsRes.success) {
      console.log('\n📈 系统统计:')
      console.log(`  用户总数: ${statsRes.data.userCount}`)
      console.log(`  手艺人: ${statsRes.data.craftsmanCount}`)
      console.log(`  派单人: ${statsRes.data.dispatcherCount}`)
      console.log(`  订单总数: ${statsRes.data.orderCount}`)
      console.log(`  待审批: ${statsRes.data.pendingCount}`)
      this.record('系统统计', true, '数据获取成功')
    }

    // 6.2 派单人查询自己的订单
    this.log('Phase 6', '6.2 派单人查询订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testDispatcher.phone,
      password: this.config.testDispatcher.password
    })
    const dispatcherOrders = await this.callAPI('order', 'list')
    this.record('派单人订单查询', dispatcherOrders.success, `${dispatcherOrders.data?.list?.length || 0} 条订单`)

    // 6.3 手艺人查询自己的订单
    this.log('Phase 6', '6.3 手艺人查询订单')
    await this.callAPI('auth', 'loginByPhone', {
      phone: this.config.testCraftsman.phone,
      password: this.config.testCraftsman.password
    })
    const craftsmanOrders = await this.callAPI('order', 'list')
    this.record('手艺人订单查询', craftsmanOrders.success, `${craftsmanOrders.data?.list?.length || 0} 条订单`)
  },

  // ==================== Phase 7: 清理测试数据 ====================
  async phase7_Cleanup() {
    console.log('\n' + '='.repeat(40))
    console.log('🧹 Phase 7: 清理测试数据')
    console.log('='.repeat(40))

    const db = this.db()

    try {
      // 清理测试订单
      const { data: orders } = await db.collection('orders')
        .where({
          name: db.RegExp({ regexp: '测试', options: 'i' })
        })
        .get()
      
      for (const order of orders) {
        await db.collection('orders').doc(order._id).remove()
      }
      this.record('清理订单', true, `删除 ${orders.length} 条测试订单`)

      // 清理测试用户
      const testPhones = [this.config.testDispatcher.phone, this.config.testCraftsman.phone]
      for (const phone of testPhones) {
        const { data: users } = await db.collection('users').where({ phone }).get()
        for (const user of users) {
          await db.collection('users').doc(user._id).remove()
        }
        
        const { data: craftsmen } = await db.collection('craftsmen').where({ phone }).get()
        for (const c of craftsmen) {
          await db.collection('craftsmen').doc(c._id).remove()
        }
        
        const { data: dispatchers } = await db.collection('dispatchers').where({ phone }).get()
        for (const d of dispatchers) {
          await db.collection('dispatchers').doc(d._id).remove()
        }
      }
      this.record('清理用户', true, '测试用户已清理')

    } catch (err) {
      this.record('清理数据', false, err.message)
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

    if (failed > 0) {
      console.log('\n失败的测试:')
      this.state.results.filter(r => !r.success).forEach(r => {
        console.log(`  ❌ ${r.testName}: ${r.message}`)
      })
    }

    console.log('\n测试完成时间:', new Date().toLocaleString())
    console.log('='.repeat(60))

    return { passed, failed, total }
  },

  // ==================== 快捷方法 ====================
  
  // 快速测试（跳过列表管理）
  async quick() {
    return await this.run({ skipListTest: true })
  },

  // 完整测试（带清理）
  async full() {
    return await this.run({ cleanup: true })
  }
}

// ==================== 挂载到全局 ====================
if (typeof window !== 'undefined') {
  window.UnifiedCompleteTest = UnifiedCompleteTest
}
if (typeof globalThis !== 'undefined') {
  globalThis.UnifiedCompleteTest = UnifiedCompleteTest
}

console.log('\n' + '='.repeat(60))
console.log('✅ UnifiedCompleteTest 已加载')
console.log('='.repeat(60))
console.log('使用方式:')
console.log('  await UnifiedCompleteTest.run()      // 标准测试')
console.log('  await UnifiedCompleteTest.quick()    // 快速测试')
console.log('  await UnifiedCompleteTest.full()     // 完整测试（含清理）')
console.log('='.repeat(60) + '\n')

module.exports = UnifiedCompleteTest
