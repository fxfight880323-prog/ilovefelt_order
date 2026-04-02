/**
 * 完整系统测试脚本 - 微信小程序控制台专用
 * 运行方式：复制全部代码 → 粘贴到控制台 → 按回车 → 输入 await FullTest.run()
 */

const FullTest = {
  // 测试结果
  results: {
    passed: 0,
    failed: 0,
    tests: []
  },

  // 测试数据
  testData: {
    admin: { phone: '13810062394', password: '123456', name: '管理员' },
    craftsman: { phone: '13800138001', password: '123456', name: '测试手艺人A' },
    dispatcher: { phone: '13800138002', password: '123456', name: '测试派单人B' },
    order: { name: '测试订单', quantity: 10, price: 100, receiveDate: new Date().toISOString().split('T')[0] }
  },

  // 日志颜色（小程序控制台可能不支持，用表情符号代替）
  icons: {
    success: '✅',
    failed: '❌',
    info: '📋',
    warning: '⚠️',
    star: '🌟'
  },

  // 主入口
  async run() {
    console.log('\n========================================')
    console.log('🚀 派单系统完整测试')
    console.log('测试时间:', new Date().toLocaleString())
    console.log('========================================\n')

    this.results = { passed: 0, failed: 0, tests: [] }

    try {
      // Phase 1: 环境检查
      await this.phase1Environment()

      // Phase 2: 数据清理
      await this.phase2Cleanup()

      // Phase 3: 数据初始化
      await this.phase3Init()

      // Phase 4: API功能测试
      await this.phase4APITests()

      // Phase 5: 业务流程测试
      await this.phase5BusinessFlow()

      // Phase 6: 数据验证
      await this.phase6Validation()

    } catch (err) {
      console.error('测试执行异常:', err)
    }

    // 输出结果
    this.printResults()
    return this.results
  },

  // Phase 1: 环境检查
  async phase1Environment() {
    console.log(this.icons.info + ' Phase 1: 环境检查')

    // 1.1 数据库连接
    await this.test('数据库连接', async () => {
      const db = wx.cloud.database()
      const { data } = await db.collection('users').limit(1).get()
      return { success: true, msg: `可正常访问，当前有 ${data.length} 条用户记录` }
    })

    // 1.2 云函数可调用
    await this.test('云函数API', async () => {
      const { result } = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'auth', action: 'checkStatus' }
      })
      return { success: true, msg: '调用正常' }
    })

    // 1.3 检查集合
    const collections = ['users', 'craftsmen', 'dispatchers', 'orders']
    for (const coll of collections) {
      await this.test(`集合 ${coll}`, async () => {
        const db = wx.cloud.database()
        await db.collection(coll).limit(1).get()
        return { success: true, msg: '存在且可访问' }
      })
    }
  },

  // Phase 2: 数据清理
  async phase2Cleanup() {
    console.log('\n' + this.icons.info + ' Phase 2: 数据清理')

    const db = wx.cloud.database()
    const phones = [this.testData.craftsman.phone, this.testData.dispatcher.phone]

    // 清理测试订单
    await this.test('清理测试订单', async () => {
      const { data } = await db.collection('orders').where({
        name: db.RegExp({ regexp: '测试', options: 'i' })
      }).get()
      
      let count = 0
      for (const item of data) {
        await db.collection('orders').doc(item._id).remove()
        count++
      }
      return { success: true, msg: `删除 ${count} 条订单` }
    })

    // 清理测试用户
    for (const phone of phones) {
      await this.test(`清理 ${phone}`, async () => {
        const { data } = await db.collection('users').where({ phone }).get()
        if (data.length > 0) {
          await db.collection('users').doc(data[0]._id).remove()
          return { success: true, msg: '已删除' }
        }
        return { success: true, msg: '不存在' }
      })
    }

    // 清理手艺人/派单人记录
    for (const phone of phones) {
      await this.test(`清理手艺人/派单人 ${phone}`, async () => {
        const { data: c } = await db.collection('craftsmen').where({ phone }).get()
        for (const item of c) {
          await db.collection('craftsmen').doc(item._id).remove()
        }
        const { data: d } = await db.collection('dispatchers').where({ phone }).get()
        for (const item of d) {
          await db.collection('dispatchers').doc(item._id).remove()
        }
        return { success: true, msg: '已清理' }
      })
    }
  },

  // Phase 3: 数据初始化
  async phase3Init() {
    console.log('\n' + this.icons.info + ' Phase 3: 数据初始化')

    const db = wx.cloud.database()

    // 检查管理员
    await this.test('检查管理员', async () => {
      const { data } = await db.collection('users').where({ 
        phone: this.testData.admin.phone 
      }).get()
      if (data.length === 0) {
        return { success: false, msg: '管理员不存在，请先创建' }
      }
      if (!data[0].roles?.includes('admin')) {
        return { success: false, msg: '用户存在但不是管理员角色' }
      }
      return { success: true, msg: '已存在且权限正确' }
    })

    // 创建手艺人
    await this.test('创建手艺人', async () => {
      const res = await this.callAPI('auth', 'register', {
        name: this.testData.craftsman.name,
        phone: this.testData.craftsman.phone,
        password: this.testData.craftsman.password,
        requestRole: 'craftsman'
      })
      if (res.success || res.code === -1002 || res.msg?.includes('审核中')) {
        return { success: true, msg: `${this.testData.craftsman.name} (${this.testData.craftsman.phone})` }
      }
      return { success: false, msg: res.msg || '创建失败' }
    })

    // 创建派单人
    await this.test('创建派单人', async () => {
      const res = await this.callAPI('auth', 'register', {
        name: this.testData.dispatcher.name,
        phone: this.testData.dispatcher.phone,
        password: this.testData.dispatcher.password,
        requestRole: 'dispatcher'
      })
      if (res.success || res.code === -1002 || res.msg?.includes('审核中')) {
        return { success: true, msg: `${this.testData.dispatcher.name} (${this.testData.dispatcher.phone})` }
      }
      return { success: false, msg: res.msg || '创建失败' }
    })

    // 审批手艺人
    await this.test('审批手艺人', async () => {
      return await this.approveUser(this.testData.craftsman.phone, 'craftsman')
    })

    // 审批派单人
    await this.test('审批派单人', async () => {
      return await this.approveUser(this.testData.dispatcher.phone, 'dispatcher')
    })
  },

  // Phase 4: API功能测试
  async phase4APITests() {
    console.log('\n' + this.icons.info + ' Phase 4: API功能测试')

    // 检查状态 - 未注册用户
    await this.test('checkStatus-未注册', async () => {
      const res = await this.callAPI('auth', 'checkStatus')
      if (res.success && res.data && 'registered' in res.data) {
        return { success: true, msg: `registered=${res.data.registered}` }
      }
      return { success: false, msg: '返回格式不正确' }
    })

    // 用户注册
    const testPhone = '13900000000'
    await this.test('用户注册', async () => {
      const res = await this.callAPI('auth', 'register', {
        name: '临时测试用户',
        phone: testPhone,
        password: '123456',
        requestRole: 'craftsman'
      })
      if (res.success || res.code === -1002) {
        return { success: true, msg: res.msg || '注册成功' }
      }
      return { success: false, msg: res.msg || '注册失败' }
    })

    // 重复注册
    await this.test('重复注册拦截', async () => {
      const res = await this.callAPI('auth', 'register', {
        name: '临时测试用户',
        phone: testPhone,
        password: '123456',
        requestRole: 'craftsman'
      })
      if (res.code === -1002 || res.msg?.includes('审核中')) {
        return { success: true, msg: '正确拦截并提示审核中' }
      }
      return { success: false, msg: '未正确拦截重复注册' }
    })

    // 清理临时用户
    await this.test('清理临时用户', async () => {
      const db = wx.cloud.database()
      const { data } = await db.collection('users').where({ phone: testPhone }).get()
      for (const item of data) {
        await db.collection('users').doc(item._id).remove()
      }
      return { success: true, msg: '已清理' }
    })

    // 获取待审批列表
    await this.test('获取待审批列表', async () => {
      const res = await this.callAPI('admin', 'getPendingRequests')
      if (res.success && Array.isArray(res.data?.list)) {
        return { success: true, msg: `返回 ${res.data.list.length} 条记录` }
      }
      return { success: false, msg: '返回格式不正确' }
    })

    // 管理员登录
    await this.test('管理员登录', async () => {
      const res = await this.callAPI('auth', 'loginByPhone', {
        phone: this.testData.admin.phone,
        password: this.testData.admin.password
      })
      if (res.success && res.data?.roles?.includes('admin')) {
        return { success: true, msg: '登录成功，角色正确' }
      }
      return { success: false, msg: '登录失败或角色不正确' }
    })

    // 手艺人登录
    await this.test('手艺人登录', async () => {
      const res = await this.callAPI('auth', 'loginByPhone', {
        phone: this.testData.craftsman.phone,
        password: this.testData.craftsman.password
      })
      if (res.success && res.data?.roles?.includes('craftsman')) {
        return { success: true, msg: '登录成功，角色正确' }
      }
      return { success: false, msg: '登录失败或角色不正确' }
    })

    // 派单人登录
    await this.test('派单人登录', async () => {
      const res = await this.callAPI('auth', 'loginByPhone', {
        phone: this.testData.dispatcher.phone,
        password: this.testData.dispatcher.password
      })
      if (res.success && res.data?.roles?.includes('dispatcher')) {
        return { success: true, msg: '登录成功，角色正确' }
      }
      return { success: false, msg: '登录失败或角色不正确' }
    })
  },

  // Phase 5: 业务流程测试
  async phase5BusinessFlow() {
    console.log('\n' + this.icons.info + ' Phase 5: 业务流程测试')

    let orderId = null
    let orderNo = null

    // 派单人创建订单
    await this.test('创建订单', async () => {
      // 先登录派单人
      await this.callAPI('auth', 'loginByPhone', {
        phone: this.testData.dispatcher.phone,
        password: this.testData.dispatcher.password
      })

      const res = await this.callAPI('order', 'create', {
        name: this.testData.order.name,
        quantity: this.testData.order.quantity,
        price: this.testData.order.price,
        receiveDate: this.testData.order.receiveDate
      })
      if (res.success && res.data?.orderId) {
        orderId = res.data.orderId
        orderNo = res.data.orderNo
        return { success: true, msg: `订单号: ${orderNo}` }
      }
      return { success: false, msg: res.msg || '创建失败' }
    })

    // 获取订单列表
    await this.test('获取订单列表', async () => {
      const res = await this.callAPI('order', 'list', { status: 'pending' })
      if (res.success && Array.isArray(res.data?.list)) {
        return { success: true, msg: `返回 ${res.data.list.length} 条订单` }
      }
      return { success: false, msg: '返回格式不正确' }
    })

    // 手艺人接单
    await this.test('手艺人接单', async () => {
      if (!orderId) return { success: false, msg: '无订单可接' }
      
      // 登录手艺人
      await this.callAPI('auth', 'loginByPhone', {
        phone: this.testData.craftsman.phone,
        password: this.testData.craftsman.password
      })

      const res = await this.callAPI('order', 'accept', { orderId })
      if (res.success) {
        return { success: true, msg: '接单成功' }
      }
      return { success: false, msg: res.msg || '接单失败' }
    })

    // 验证订单状态
    await this.test('订单状态验证', async () => {
      if (!orderId) return { success: false, msg: '无订单' }
      
      const db = wx.cloud.database()
      const { data } = await db.collection('orders').doc(orderId).get()
      if (data.status === 'accepted') {
        return { success: true, msg: '状态为 accepted' }
      }
      return { success: false, msg: `状态为 ${data.status}` }
    })

    // 手艺人取消订单
    await this.test('取消订单', async () => {
      if (!orderId) return { success: false, msg: '无订单' }
      
      const res = await this.callAPI('order', 'cancel', { orderId })
      if (res.success) {
        return { success: true, msg: '取消成功' }
      }
      return { success: false, msg: res.msg || '取消失败' }
    })

    // 验证订单已取消
    await this.test('验证订单已取消', async () => {
      if (!orderId) return { success: false, msg: '无订单' }
      
      const db = wx.cloud.database()
      const { data } = await db.collection('orders').doc(orderId).get()
      if (data.status === 'cancelled') {
        return { success: true, msg: '状态为 cancelled' }
      }
      return { success: false, msg: `状态为 ${data.status}` }
    })
  },

  // Phase 6: 数据验证
  async phase6Validation() {
    console.log('\n' + this.icons.info + ' Phase 6: 数据验证')

    const db = wx.cloud.database()

    // 统计用户
    await this.test('用户统计', async () => {
      const { total } = await db.collection('users').count()
      return { success: true, msg: `共 ${total} 位用户` }
    })

    // 统计手艺人
    await this.test('手艺人统计', async () => {
      const { total } = await db.collection('craftsmen').count()
      return { success: true, msg: `共 ${total} 位手艺人` }
    })

    // 统计派单人
    await this.test('派单人统计', async () => {
      const { total } = await db.collection('dispatchers').count()
      return { success: true, msg: `共 ${total} 位派单人` }
    })

    // 统计订单
    await this.test('订单统计', async () => {
      const { total } = await db.collection('orders').count()
      return { success: true, msg: `共 ${total} 条订单` }
    })
  },

  // 辅助方法：调用API
  async callAPI(module, action, data = {}) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'api',
        data: { module, action, ...data }
      })
      return result
    } catch (err) {
      return { success: false, msg: err.message }
    }
  },

  // 辅助方法：审批用户
  async approveUser(phone, role) {
    const db = wx.cloud.database()
    
    // 查找用户
    const { data: users } = await db.collection('users').where({ phone }).get()
    if (users.length === 0) {
      return { success: false, msg: '用户不存在' }
    }
    
    const user = users[0]
    
    // 检查是否已审批
    if (user.roles?.includes(role)) {
      return { success: true, msg: '已审批通过' }
    }
    
    // 更新用户角色
    const roleApps = user.roleApplications || []
    const appIndex = roleApps.findIndex(app => app.role === role)
    
    if (appIndex >= 0) {
      roleApps[appIndex].status = 'active'
    }
    
    const updateData = {
      roles: db.command.push([role]),
      currentRole: role,
      roleApplications: roleApps
    }
    
    await db.collection('users').doc(user._id).update({ data: updateData })
    
    // 更新对应集合
    if (role === 'craftsman') {
      const { data: c } = await db.collection('craftsmen').where({ phone }).get()
      if (c.length > 0) {
        await db.collection('craftsmen').doc(c[0]._id).update({
          data: { status: 'active' }
        })
      }
    } else if (role === 'dispatcher') {
      const { data: d } = await db.collection('dispatchers').where({ phone }).get()
      if (d.length > 0) {
        await db.collection('dispatchers').doc(d[0]._id).update({
          data: { status: 'active' }
        })
      }
    }
    
    return { success: true, msg: '审批通过' }
  },

  // 辅助方法：执行单个测试
  async test(name, fn) {
    try {
      const result = await fn()
      if (result.success) {
        this.results.passed++
        this.results.tests.push({ name, status: 'passed', msg: result.msg })
        console.log(`${this.icons.success} ${name}: ${result.msg}`)
      } else {
        this.results.failed++
        this.results.tests.push({ name, status: 'failed', msg: result.msg })
        console.log(`${this.icons.failed} ${name}: ${result.msg}`)
      }
    } catch (err) {
      this.results.failed++
      this.results.tests.push({ name, status: 'failed', msg: err.message })
      console.log(`${this.icons.failed} ${name}: ${err.message}`)
    }
  },

  // 输出结果
  printResults() {
    console.log('\n========================================')
    console.log('📊 测试结果汇总')
    console.log('========================================')
    console.log(`✅ 通过: ${this.results.passed}/${this.results.tests.length}`)
    console.log(`❌ 失败: ${this.results.failed}/${this.results.tests.length}`)
    
    if (this.results.failed > 0) {
      console.log('\n❌ 失败的测试:')
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => console.log(`  - ${t.name}: ${t.msg}`))
    }
    
    console.log('========================================')
    
    if (this.results.failed === 0) {
      console.log(this.icons.star + ' 所有测试通过！')
    } else {
      console.log(this.icons.warning + ' 部分测试失败，请检查')
    }
  }
}

// 挂载到全局（微信小程序环境）
if (typeof globalThis !== 'undefined') {
  globalThis.FullTest = FullTest
}
if (typeof window !== 'undefined') {
  window.FullTest = FullTest
}

// 输出提示
console.log('✅ FullTest 已加载，运行: await FullTest.run()')
