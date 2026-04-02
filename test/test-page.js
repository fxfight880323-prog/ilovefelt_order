// 测试页面逻辑 - 复制到任意页面使用

// 引入测试脚本（需要将 full-test.js 内容复制到这里，或下面的简化版本）

const FullTest = {
  results: { passed: 0, failed: 0, tests: [] },
  
  testData: {
    admin: { phone: '13810062394', password: '123456' },
    craftsman: { phone: '13800138001', password: '123456', name: '测试手艺人A' },
    dispatcher: { phone: '13800138002', password: '123456', name: '测试派单人B' }
  },

  async run(progressCallback) {
    this.results = { passed: 0, failed: 0, tests: [] }
    
    // Phase 1: 环境检查
    progressCallback && progressCallback('阶段 1/6: 环境检查...')
    await this.phase1Environment()
    
    // Phase 2: 数据清理
    progressCallback && progressCallback('阶段 2/6: 数据清理...')
    await this.phase2Cleanup()
    
    // Phase 3: 数据初始化
    progressCallback && progressCallback('阶段 3/6: 数据初始化...')
    await this.phase3Init()
    
    // Phase 4: API测试
    progressCallback && progressCallback('阶段 4/6: API功能测试...')
    await this.phase4APITests()
    
    // Phase 5: 业务流程
    progressCallback && progressCallback('阶段 5/6: 业务流程测试...')
    await this.phase5BusinessFlow()
    
    // Phase 6: 数据验证
    progressCallback && progressCallback('阶段 6/6: 数据验证...')
    await this.phase6Validation()
    
    return this.results
  },

  async phase1Environment() {
    await this.test('数据库连接', async () => {
      const db = wx.cloud.database()
      const { data } = await db.collection('users').limit(1).get()
      return { success: true, msg: `可访问，${data.length} 条用户记录` }
    })

    await this.test('云函数API', async () => {
      const { result } = await wx.cloud.callFunction({
        name: 'api', data: { module: 'auth', action: 'checkStatus' }
      })
      return result.success !== undefined ? { success: true, msg: '返回格式正确' } : { success: false, msg: '返回格式错误' }
    })
  },

  async phase2Cleanup() {
    const db = wx.cloud.database()
    const phones = [this.testData.craftsman.phone, this.testData.dispatcher.phone]
    
    await this.test('清理测试订单', async () => {
      const { data } = await db.collection('orders').where({ name: db.RegExp({ regexp: '测试' }) }).get()
      for (const item of data) await db.collection('orders').doc(item._id).remove()
      return { success: true, msg: `删除 ${data.length} 条` }
    })

    for (const phone of phones) {
      await this.test(`清理 ${phone}`, async () => {
        const { data } = await db.collection('users').where({ phone }).get()
        if (data[0]) await db.collection('users').doc(data[0]._id).remove()
        return { success: true, msg: '已清理' }
      })
    }
  },

  async phase3Init() {
    const db = wx.cloud.database()
    
    await this.test('检查管理员', async () => {
      const { data } = await db.collection('users').where({ phone: this.testData.admin.phone }).get()
      return data[0]?.roles?.includes('admin') ? { success: true, msg: '存在' } : { success: false, msg: '不存在' }
    })

    await this.test('创建手艺人', async () => {
      const res = await this.callAPI('auth', 'register', { ...this.testData.craftsman, requestRole: 'craftsman' })
      return res.success || res.code === -1002 ? { success: true, msg: '已创建' } : { success: false, msg: res.msg }
    })

    await this.test('创建派单人', async () => {
      const res = await this.callAPI('auth', 'register', { ...this.testData.dispatcher, requestRole: 'dispatcher' })
      return res.success || res.code === -1002 ? { success: true, msg: '已创建' } : { success: false, msg: res.msg }
    })
  },

  async phase4APITests() {
    await this.test('checkStatus格式', async () => {
      const res = await this.callAPI('auth', 'checkStatus')
      return 'success' in res && 'data' in res ? { success: true, msg: '格式正确' } : { success: false, msg: '格式错误' }
    })

    await this.test('管理员登录', async () => {
      const res = await this.callAPI('auth', 'loginByPhone', this.testData.admin)
      return res.success ? { success: true, msg: '登录成功' } : { success: false, msg: res.msg }
    })

    await this.test('手艺人登录', async () => {
      const res = await this.callAPI('auth', 'loginByPhone', this.testData.craftsman)
      return res.success ? { success: true, msg: '登录成功' } : { success: false, msg: res.msg }
    })
  },

  async phase5BusinessFlow() {
    let orderId = null
    
    await this.test('创建订单', async () => {
      await this.callAPI('auth', 'loginByPhone', this.testData.dispatcher)
      const res = await this.callAPI('order', 'create', { name: '测试订单', quantity: 10, price: 100 })
      if (res.success) { orderId = res.data.orderId; return { success: true, msg: orderId } }
      return { success: false, msg: res.msg }
    })

    await this.test('手艺人接单', async () => {
      if (!orderId) return { success: false, msg: '无订单' }
      await this.callAPI('auth', 'loginByPhone', this.testData.craftsman)
      const res = await this.callAPI('order', 'accept', { orderId })
      return res.success ? { success: true, msg: '接单成功' } : { success: false, msg: res.msg }
    })

    await this.test('取消订单', async () => {
      if (!orderId) return { success: false, msg: '无订单' }
      const res = await this.callAPI('order', 'cancel', { orderId })
      return res.success ? { success: true, msg: '取消成功' } : { success: false, msg: res.msg }
    })
  },

  async phase6Validation() {
    const db = wx.cloud.database()
    const { total: users } = await db.collection('users').count()
    const { total: orders } = await db.collection('orders').count()
    this.test('数据统计', () => ({ success: true, msg: `${users}用户/${orders}订单` }))
  },

  async callAPI(module, action, data = {}) {
    try {
      const { result } = await wx.cloud.callFunction({ name: 'api', data: { module, action, ...data } })
      return result
    } catch (err) {
      return { success: false, msg: err.message }
    }
  },

  async test(name, fn) {
    try {
      const result = await fn()
      if (result.success) {
        this.results.passed++
        this.results.tests.push({ name, status: 'passed', msg: result.msg })
      } else {
        this.results.failed++
        this.results.tests.push({ name, status: 'failed', msg: result.msg })
      }
    } catch (err) {
      this.results.failed++
      this.results.tests.push({ name, status: 'failed', msg: err.message })
    }
  }
}

Page({
  data: {
    testing: false,
    testResults: null
  },

  async runFullTest() {
    this.setData({ testing: true, testResults: null })
    
    const results = await FullTest.run((msg) => {
      console.log(msg)
    })
    
    this.setData({ 
      testing: false,
      testResults: results
    })
    
    wx.showModal({
      title: '测试完成',
      content: `通过: ${results.passed}, 失败: ${results.failed}`,
      showCancel: false
    })
  }
})
