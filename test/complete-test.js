/**
 * 完整系统测试脚本
 * 从头到尾测试所有功能
 * 
 * 使用方法：
 * 1. 在微信开发者工具控制台运行此脚本
 * 2. 运行：await CompleteTest.run()
 */

const CompleteTest = {
  // 测试配置
  config: {
    admin: {
      phone: '13810062394',
      name: '系统管理员',
      password: '123456'
    },
    craftsman: {
      phone: '13800138001',
      name: '测试手艺人A',
      password: '123456',
      specialty: '木工',
      experience: '3-5年'
    },
    dispatcher: {
      phone: '13800138002',
      name: '测试派单人B',
      password: '123456',
      company: '测试公司'
    },
    newUser: {
      phone: '13800999999',
      name: '新测试用户',
      password: '123456'
    }
  },
  
  results: [],
  
  // 记录测试结果
  log(testName, success, message = '') {
    this.results.push({ testName, success, message, time: new Date().toLocaleTimeString() })
    const icon = success ? '✅' : '❌'
    console.log(`${icon} [${testName}] ${message}`)
  },
  
  // 显示测试报告
  report() {
    console.log('\n========== 完整测试报告 ==========')
    console.log(`测试时间: ${new Date().toLocaleString()}`)
    
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length
    const total = this.results.length
    
    console.log(`\n通过: ${passed}/${total} | 失败: ${failed}/${total}`)
    
    if (failed > 0) {
      console.log('\n失败的测试:')
      this.results.filter(r => !r.success).forEach(f => {
        console.log(`  ❌ ${f.testName}: ${f.message}`)
      })
    }
    
    console.log('\n通过的测试:')
    this.results.filter(r => r.success).forEach(p => {
      console.log(`  ✅ ${p.testName}: ${p.message}`)
    })
    
    console.log('\n==================================\n')
    return { passed, failed, total }
  },

  // ========== 第1阶段：环境检查 ==========
  async phase1_checkEnvironment() {
    console.log('\n========== 阶段1: 环境检查 ==========')
    
    // 1.1 检查数据库连接
    try {
      const db = wx.cloud.database()
      const testRes = await db.collection('users').limit(1).get()
      this.log('数据库连接', true, `可正常访问, 当前有 ${testRes.data.length} 条用户记录`)
    } catch (err) {
      this.log('数据库连接', false, err.message)
      return false
    }
    
    // 1.2 检查云函数
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'auth', action: 'checkStatus' }
      })
      if (res.result && res.result.hasOwnProperty('success')) {
        this.log('云函数API', true, '调用正常')
      } else {
        this.log('云函数API', false, '返回格式异常')
      }
    } catch (err) {
      this.log('云函数API', false, err.message)
      return false
    }
    
    // 1.3 检查集合
    const collections = ['users', 'craftsmen', 'dispatchers', 'orders']
    for (const coll of collections) {
      try {
        const db = wx.cloud.database()
        await db.collection(coll).limit(1).get()
        this.log(`集合 ${coll}`, true, '存在且可访问')
      } catch (err) {
        if (err.errCode === -502005) {
          this.log(`集合 ${coll}`, false, '不存在! 请先在云开发控制台创建')
        } else {
          this.log(`集合 ${coll}`, true, '存在')
        }
      }
    }
    
    return true
  },

  // ========== 第2阶段：数据清理 ==========
  async phase2_cleanData() {
    console.log('\n========== 阶段2: 数据清理 ==========')
    
    const db = wx.cloud.database()
    const phones = [
      this.config.craftsman.phone,
      this.config.dispatcher.phone,
      this.config.newUser.phone
    ]
    
    for (const phone of phones) {
      try {
        // 清理 users
        const users = await db.collection('users').where({ phone }).get()
        for (const u of users.data) {
          await db.collection('users').doc(u._id).remove()
        }
        if (users.data.length > 0) {
          this.log(`清理用户 ${phone}`, true, `删除 ${users.data.length} 条记录`)
        }
        
        // 清理 craftsmen
        const craftsmen = await db.collection('craftsmen').where({ phone }).get()
        for (const c of craftsmen.data) {
          await db.collection('craftsmen').doc(c._id).remove()
        }
        
        // 清理 dispatchers
        const dispatchers = await db.collection('dispatchers').where({ phone }).get()
        for (const d of dispatchers.data) {
          await db.collection('dispatchers').doc(d._id).remove()
        }
      } catch (err) {
        this.log(`清理 ${phone}`, false, err.message)
      }
    }
    
    // 清理测试订单
    try {
      const orders = await db.collection('orders').where({
        name: db.RegExp({ regexp: '测试', options: 'i' })
      }).get()
      for (const o of orders.data) {
        await db.collection('orders').doc(o._id).remove()
      }
      if (orders.data.length > 0) {
        this.log('清理测试订单', true, `删除 ${orders.data.length} 条订单`)
      }
    } catch (err) {
      this.log('清理测试订单', false, err.message)
    }
    
    return true
  },

  // ========== 第3阶段：初始化数据 ==========
  async phase3_initData() {
    console.log('\n========== 阶段3: 初始化测试数据 ==========')
    
    const db = wx.cloud.database()
    
    // 3.1 创建/检查管理员
    try {
      const adminExist = await db.collection('users').where({
        phone: this.config.admin.phone
      }).get()
      
      if (adminExist.data.length === 0) {
        await db.collection('users').add({
          data: {
            openid: 'admin_' + Date.now(),
            phone: this.config.admin.phone,
            name: this.config.admin.name,
            roles: ['admin'],
            currentRole: 'admin',
            roleApplications: [{
              role: 'admin',
              status: 'active',
              applyTime: db.serverDate()
            }],
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
        this.log('创建管理员', true, this.config.admin.phone)
      } else {
        // 确保是管理员
        const user = adminExist.data[0]
        if (!user.roles || !user.roles.includes('admin')) {
          await db.collection('users').doc(user._id).update({
            data: {
              roles: ['admin'],
              updateTime: db.serverDate()
            }
          })
        }
        this.log('检查管理员', true, '已存在且权限正确')
      }
    } catch (err) {
      this.log('管理员初始化', false, err.message)
    }
    
    // 3.2 创建已审批的手艺人
    try {
      const craftsmanOpenid = 'test_craftsman_' + Date.now()
      
      const userRes = await db.collection('users').add({
        data: {
          openid: craftsmanOpenid,
          phone: this.config.craftsman.phone,
          name: this.config.craftsman.name,
          roles: ['craftsman'],
          currentRole: 'craftsman',
          roleApplications: [{
            role: 'craftsman',
            status: 'active',
            applyTime: db.serverDate(),
            approveTime: db.serverDate()
          }],
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      await db.collection('craftsmen').add({
        data: {
          userId: userRes._id,
          openid: craftsmanOpenid,
          name: this.config.craftsman.name,
          phone: this.config.craftsman.phone,
          specialty: this.config.craftsman.specialty,
          experience: this.config.craftsman.experience,
          starLevel: 3,
          status: 'active',
          totalOrders: 0,
          completedOrders: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      this.log('创建手艺人', true, `${this.config.craftsman.name} (${this.config.craftsman.phone})`)
    } catch (err) {
      this.log('创建手艺人', false, err.message)
    }
    
    // 3.3 创建已审批的派单人
    try {
      const dispatcherOpenid = 'test_dispatcher_' + Date.now()
      
      const userRes = await db.collection('users').add({
        data: {
          openid: dispatcherOpenid,
          phone: this.config.dispatcher.phone,
          name: this.config.dispatcher.name,
          roles: ['dispatcher'],
          currentRole: 'dispatcher',
          roleApplications: [{
            role: 'dispatcher',
            status: 'active',
            applyTime: db.serverDate(),
            approveTime: db.serverDate()
          }],
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      await db.collection('dispatchers').add({
        data: {
          userId: userRes._id,
          openid: dispatcherOpenid,
          name: this.config.dispatcher.name,
          phone: this.config.dispatcher.phone,
          company: this.config.dispatcher.company,
          status: 'active',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      this.log('创建派单人', true, `${this.config.dispatcher.name} (${this.config.dispatcher.phone})`)
    } catch (err) {
      this.log('创建派单人', false, err.message)
    }
    
    // 3.4 创建测试订单
    try {
      const dispatcher = await db.collection('dispatchers')
        .where({ phone: this.config.dispatcher.phone }).get()
      
      if (dispatcher.data.length > 0) {
        const d = dispatcher.data[0]
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        const orderCode = letters[Math.floor(Math.random() * 24)] + 
                         letters[Math.floor(Math.random() * 24)] +
                         String(Date.now()).slice(-8)
        
        await db.collection('orders').add({
          data: {
            orderCode,
            name: '测试订单-' + Date.now(),
            styleName: '测试样式',
            quantity: 10,
            price: 50,
            totalPrice: 500,
            receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            dispatcherId: d.openid,
            dispatcherName: d.name,
            craftsmanId: '',
            craftsmanName: '',
            status: 'pending',
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
        
        this.log('创建测试订单', true, `订单号: ${orderCode}`)
      }
    } catch (err) {
      this.log('创建测试订单', false, err.message)
    }
    
    return true
  },

  // ========== 第4阶段：API测试 ==========
  async phase4_apiTest() {
    console.log('\n========== 阶段4: API功能测试 ==========')
    
    // 4.1 检查状态 - 未注册
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'auth', action: 'checkStatus' }
      })
      
      if (res.result.success && res.result.data.registered === false) {
        this.log('checkStatus-未注册', true, '返回未注册状态')
      } else {
        this.log('checkStatus-未注册', false, '返回格式不正确')
      }
    } catch (err) {
      this.log('checkStatus-未注册', false, err.message)
    }
    
    // 4.2 新用户注册
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'register',
          data: {
            name: this.config.newUser.name,
            phone: this.config.newUser.phone,
            requestRole: 'craftsman',
            password: this.config.newUser.password,
            specialty: '木工',
            experience: '1-3年'
          }
        }
      })
      
      if (res.result.success) {
        this.log('用户注册', true, res.result.msg)
      } else {
        this.log('用户注册', false, res.result.msg)
      }
    } catch (err) {
      this.log('用户注册', false, err.message)
    }
    
    // 4.3 重复注册检测
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'register',
          data: {
            name: this.config.newUser.name,
            phone: this.config.newUser.phone,
            requestRole: 'craftsman'
          }
        }
      })
      
      if (!res.result.success && res.result.code === -1002) {
        this.log('重复注册拦截', true, '正确拦截并提示审核中')
      } else {
        this.log('重复注册拦截', false, '未正确拦截')
      }
    } catch (err) {
      this.log('重复注册拦截', true, '返回错误信息')
    }
    
    // 4.4 管理员获取待审批列表
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'admin', action: 'getPendingRequests' }
      })
      
      if (res.result.success && Array.isArray(res.result.data)) {
        this.log('获取待审批列表', true, `${res.result.data.length} 条待审批`)
        
        // 保存第一条用于审批测试
        if (res.result.data.length > 0) {
          this.pendingApplicationId = res.result.data[0].id
        }
      } else {
        this.log('获取待审批列表', false, '返回格式不正确')
      }
    } catch (err) {
      this.log('获取待审批列表', false, err.message)
    }
    
    // 4.5 管理员审批
    if (this.pendingApplicationId) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'api',
          data: {
            module: 'admin',
            action: 'approve',
            data: {
              applicationId: this.pendingApplicationId,
              approved: true
            }
          }
        })
        
        if (res.result.success) {
          this.log('管理员审批', true, '审批通过成功')
        } else {
          this.log('管理员审批', false, res.result.msg)
        }
      } catch (err) {
        this.log('管理员审批', false, err.message)
      }
    }
    
    // 4.6 已审批用户登录
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'loginByPhone',
          data: {
            phone: this.config.newUser.phone,
            password: this.config.newUser.password
          }
        }
      })
      
      if (res.result.success && res.result.data.roles.length > 0) {
        this.log('已审批用户登录', true, `角色: ${res.result.data.roles.join(',')}`)
      } else {
        this.log('已审批用户登录', false, '登录失败或角色为空')
      }
    } catch (err) {
      this.log('已审批用户登录', false, err.message)
    }
    
    // 4.7 创建订单
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'order',
          action: 'create',
          data: {
            name: 'API测试订单',
            quantity: 5,
            price: 100,
            receiveDate: '2026-04-15'
          }
        }
      })
      
      if (res.result.success) {
        this.log('创建订单', true, `订单号: ${res.result.data.orderCode}`)
        this.createdOrderId = res.result.data.orderId
      } else {
        this.log('创建订单', false, res.result.msg)
      }
    } catch (err) {
      this.log('创建订单', false, err.message)
    }
    
    // 4.8 获取订单列表
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'order', action: 'list' }
      })
      
      if (res.result.success && Array.isArray(res.result.data)) {
        this.log('获取订单列表', true, `${res.result.data.length} 条订单`)
      } else {
        this.log('获取订单列表', false, '返回格式不正确')
      }
    } catch (err) {
      this.log('获取订单列表', false, err.message)
    }
    
    return true
  },

  // ========== 第5阶段：业务流程测试 ==========
  async phase5_businessFlow() {
    console.log('\n========== 阶段5: 业务流程测试 ==========')
    
    const db = wx.cloud.database()
    
    // 5.1 手艺人查看待接单
    try {
      const orders = await db.collection('orders')
        .where({ status: 'pending' })
        .get()
      
      if (orders.data.length > 0) {
        this.log('查看待接单', true, `${orders.data.length} 个待接单`)
        this.testOrderId = orders.data[0]._id
      } else {
        this.log('查看待接单', false, '没有待接单')
      }
    } catch (err) {
      this.log('查看待接单', false, err.message)
    }
    
    // 5.2 手艺人接单
    if (this.testOrderId) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'api',
          data: {
            module: 'order',
            action: 'accept',
            data: { orderId: this.testOrderId }
          }
        })
        
        if (res.result.success) {
          this.log('手艺人接单', true, '接单成功')
        } else {
          this.log('手艺人接单', false, res.result.msg)
        }
      } catch (err) {
        this.log('手艺人接单', false, err.message)
      }
    }
    
    // 5.3 验证订单状态
    if (this.testOrderId) {
      try {
        const order = await db.collection('orders').doc(this.testOrderId).get()
        
        if (order.data.status === 'accepted') {
          this.log('订单状态验证', true, '状态为已接单')
        } else {
          this.log('订单状态验证', false, `状态为 ${order.data.status}`)
        }
      } catch (err) {
        this.log('订单状态验证', false, err.message)
      }
    }
    
    // 5.4 取消订单
    if (this.testOrderId) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'api',
          data: {
            module: 'order',
            action: 'cancel',
            data: { orderId: this.testOrderId, reason: '测试取消' }
          }
        })
        
        if (res.result.success) {
          this.log('取消订单', true, '取消成功')
        } else {
          this.log('取消订单', false, res.result.msg)
        }
      } catch (err) {
        this.log('取消订单', false, err.message)
      }
    }
    
    return true
  },

  // ========== 第6阶段：统计数据验证 ==========
  async phase6_verifyData() {
    console.log('\n========== 阶段6: 数据统计验证 ==========')
    
    const db = wx.cloud.database()
    
    try {
      const users = await db.collection('users').count()
      this.log('统计-用户', true, `${users.total} 人`)
      
      const craftsmen = await db.collection('craftsmen').count()
      this.log('统计-手艺人', true, `${craftsmen.total} 人`)
      
      const dispatchers = await db.collection('dispatchers').count()
      this.log('统计-派单人', true, `${dispatchers.total} 人`)
      
      const orders = await db.collection('orders').count()
      this.log('统计-订单', true, `${orders.total} 个`)
      
      // 显示用户详情
      const userList = await db.collection('users').limit(10).get()
      console.log('\n用户详情:')
      userList.data.forEach(u => {
        const roles = u.roles || []
        const pending = (u.roleApplications || [])
          .filter(a => a.status === 'pending').length
        console.log(`  - ${u.name} (${u.phone}): roles=[${roles.join(',')}], pending=${pending}`)
      })
      
    } catch (err) {
      this.log('数据统计', false, err.message)
    }
    
    return true
  },

  // ========== 运行所有测试 ==========
  async run() {
    console.log('====================================')
    console.log('      完整系统测试开始')
    console.log('====================================')
    console.log('时间:', new Date().toLocaleString())
    
    this.results = []
    
    // 依次执行各阶段
    const envOk = await this.phase1_checkEnvironment()
    if (!envOk) {
      console.error('\n❌ 环境检查失败，停止测试')
      this.report()
      return
    }
    
    await this.phase2_cleanData()
    await this.phase3_initData()
    await this.phase4_apiTest()
    await this.phase5_businessFlow()
    await this.phase6_verifyData()
    
    // 生成报告
    const report = this.report()
    
    // 返回结果
    return {
      success: report.failed === 0,
      passed: report.passed,
      failed: report.failed,
      total: report.total,
      details: this.results
    }
  },
  
  // 快速测试（跳过清理和初始化）
  async quickTest() {
    console.log('========== 快速测试 ==========')
    this.results = []
    
    await this.phase4_apiTest()
    await this.phase6_verifyData()
    
    return this.report()
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = CompleteTest
}
if (typeof window !== 'undefined') {
  window.CompleteTest = CompleteTest
}
if (typeof global !== 'undefined') {
  global.CompleteTest = CompleteTest
}

console.log('完整测试脚本已加载')
console.log('运行: await CompleteTest.run()')
console.log('快速测试: await CompleteTest.quickTest()')
