/**
 * 自动化测试脚本
 * 在微信开发者工具控制台运行
 */

const TEST = {
  // 测试配置
  config: {
    adminPhone: '13810062394',
    craftsmanPhone: '13800138001',
    dispatcherPhone: '13800138002',
    testPassword: '123456'
  },

  results: [],

  // 记录测试结果
  log(testName, success, message = '') {
    this.results.push({ testName, success, message })
    const icon = success ? '✅' : '❌'
    console.log(`${icon} ${testName}${message ? ': ' + message : ''}`)
  },

  // 显示测试报告
  report() {
    console.log('\n========== 测试报告 ==========')
    const passed = this.results.filter(r => r.success).length
    const total = this.results.length
    console.log(`通过: ${passed}/${total}`)
    
    const failed = this.results.filter(r => !r.success)
    if (failed.length > 0) {
      console.log('\n失败的测试:')
      failed.forEach(f => console.log(`  ❌ ${f.testName}: ${f.message}`))
    }
    console.log('==============================\n')
  },

  // ========== 数据库测试 ==========
  async testDatabase() {
    console.log('\n----- 数据库测试 -----')
    
    try {
      // 测试读取
      const readRes = await wx.cloud.database().collection('users').get()
      this.log('数据库读取权限', true, `读取到 ${readRes.data.length} 条记录`)
    } catch (err) {
      this.log('数据库读取权限', false, err.message)
      return
    }

    try {
      // 测试写入
      const writeRes = await wx.cloud.database().collection('users').add({
        data: { test: true, createTime: new Date() }
      })
      this.log('数据库写入权限', true, `记录ID: ${writeRes._id}`)
      
      // 清理
      await wx.cloud.database().collection('users').doc(writeRes._id).remove()
    } catch (err) {
      this.log('数据库写入权限', false, err.message)
    }
  },

  // ========== 云函数测试 ==========
  async testCloudFunction() {
    console.log('\n----- 云函数测试 -----')
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module: 'auth', action: 'checkStatus' }
      })
      
      if (res.result && res.result.hasOwnProperty('success')) {
        this.log('云函数API调用', true, '返回格式正确')
      } else {
        this.log('云函数API调用', false, '返回格式不正确')
      }
    } catch (err) {
      this.log('云函数API调用', false, err.message)
    }
  },

  // ========== 用户注册测试 ==========
  async testRegister() {
    console.log('\n----- 用户注册测试 -----')
    
    // 清理旧数据
    await this.cleanTestUser(this.config.craftsmanPhone)
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'register',
          data: {
            name: '测试手艺人A',
            phone: this.config.craftsmanPhone,
            requestRole: 'craftsman',
            password: this.config.testPassword,
            specialty: '木工',
            experience: '3-5年'
          }
        }
      })
      
      if (res.result.success) {
        this.log('手艺人注册', true, res.result.msg)
        
        // 验证数据库
        const userRes = await wx.cloud.database().collection('users')
          .where({ phone: this.config.craftsmanPhone }).get()
        
        if (userRes.data.length > 0 && userRes.data[0].roleApplications[0].status === 'pending') {
          this.log('手艺人注册数据验证', true, '状态为pending')
        } else {
          this.log('手艺人注册数据验证', false, '数据不正确')
        }
      } else {
        this.log('手艺人注册', false, res.result.msg)
      }
    } catch (err) {
      this.log('手艺人注册', false, err.message)
    }
  },

  // ========== 登录测试 ==========
  async testLogin() {
    console.log('\n----- 登录测试 -----')
    
    // 测试未审批用户登录
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'loginByPhone',
          data: {
            phone: this.config.craftsmanPhone,
            password: this.config.testPassword
          }
        }
      })
      
      if (!res.result.success && res.result.code === -1002) {
        this.log('未审批用户登录拦截', true, '正确拦截并提示')
      } else {
        this.log('未审批用户登录拦截', false, '未正确拦截')
      }
    } catch (err) {
      this.log('未审批用户登录拦截', true, '返回错误信息')
    }
  },

  // ========== 管理员审批测试 ==========
  async testAdminApprove() {
    console.log('\n----- 管理员审批测试 -----')
    
    // 先确保有管理员
    await this.ensureAdmin()
    
    // 获取待审批列表
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'admin',
          action: 'getPendingRequests'
        }
      })
      
      if (res.result.success && Array.isArray(res.result.data)) {
        this.log('获取待审批列表', true, `${res.result.data.length} 条待审批`)
        
        // 如果有待审批，测试通过审批
        if (res.result.data.length > 0) {
          const application = res.result.data[0]
          
          const approveRes = await wx.cloud.callFunction({
            name: 'api',
            data: {
              module: 'admin',
              action: 'approve',
              data: {
                applicationId: application.id,
                approved: true
              }
            }
          })
          
          if (approveRes.result.success) {
            this.log('审批通过', true, `审批了 ${application.name}`)
          } else {
            this.log('审批通过', false, approveRes.result.msg)
          }
        }
      } else {
        this.log('获取待审批列表', false, '返回格式不正确')
      }
    } catch (err) {
      this.log('管理员审批测试', false, err.message)
    }
  },

  // ========== 订单测试 ==========
  async testOrder() {
    console.log('\n----- 订单测试 -----')
    
    // 确保有派单人
    await this.ensureDispatcher()
    
    // 创建订单
    try {
      const createRes = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'order',
          action: 'create',
          data: {
            name: '测试订单-' + Date.now(),
            quantity: 10,
            price: 50,
            receiveDate: '2026-04-15'
          }
        }
      })
      
      if (createRes.result.success) {
        this.log('创建订单', true, `订单号: ${createRes.result.data.orderCode}`)
        
        // 验证订单列表
        const listRes = await wx.cloud.callFunction({
          name: 'api',
          data: { module: 'order', action: 'list' }
        })
        
        if (listRes.result.success && listRes.result.data.length > 0) {
          this.log('获取订单列表', true, `${listRes.result.data.length} 条订单`)
        } else {
          this.log('获取订单列表', false, '列表为空或失败')
        }
      } else {
        this.log('创建订单', false, createRes.result.msg)
      }
    } catch (err) {
      this.log('订单测试', false, err.message)
    }
  },

  // ========== 辅助函数 ==========
  async cleanTestUser(phone) {
    try {
      const users = await wx.cloud.database().collection('users')
        .where({ phone }).get()
      for (const u of users.data) {
        await wx.cloud.database().collection('users').doc(u._id).remove()
      }
      
      const craftsmen = await wx.cloud.database().collection('craftsmen')
        .where({ phone }).get()
      for (const c of craftsmen.data) {
        await wx.cloud.database().collection('craftsmen').doc(c._id).remove()
      }
    } catch (err) {
      console.log('清理测试用户失败:', err)
    }
  },

  async ensureAdmin() {
    try {
      const exist = await wx.cloud.database().collection('users')
        .where({ phone: this.config.adminPhone }).get()
      
      if (exist.data.length === 0) {
        await wx.cloud.database().collection('users').add({
          data: {
            openid: 'admin_' + Date.now(),
            phone: this.config.adminPhone,
            name: '管理员',
            roles: ['admin'],
            currentRole: 'admin',
            roleApplications: [{
              role: 'admin',
              status: 'active',
              applyTime: new Date()
            }],
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        console.log('已创建管理员账号')
      }
    } catch (err) {
      console.log('创建管理员失败:', err)
    }
  },

  async ensureDispatcher() {
    try {
      const exist = await wx.cloud.database().collection('users')
        .where({ phone: this.config.dispatcherPhone }).get()
      
      if (exist.data.length === 0) {
        // 创建派单人
        await wx.cloud.callFunction({
          name: 'api',
          data: {
            module: 'auth',
            action: 'register',
            data: {
              name: '测试派单人B',
              phone: this.config.dispatcherPhone,
              requestRole: 'dispatcher',
              password: this.config.testPassword,
              company: '测试公司'
            }
          }
        })
        
        // 自动审批
        const user = await wx.cloud.database().collection('users')
          .where({ phone: this.config.dispatcherPhone }).get()
        
        if (user.data.length > 0) {
          await wx.cloud.database().collection('users').doc(user.data[0]._id).update({
            data: {
              roles: ['dispatcher'],
              'roleApplications.0.status': 'active'
            }
          })
        }
      }
    } catch (err) {
      console.log('创建派单人失败:', err)
    }
  },

  // ========== 运行所有测试 ==========
  async runAll() {
    console.log('========== 开始自动化测试 ==========')
    console.log('时间:', new Date().toLocaleString())
    
    await this.testDatabase()
    await this.testCloudFunction()
    await this.testRegister()
    await this.testLogin()
    await this.testAdminApprove()
    await this.testOrder()
    
    this.report()
  }
}

// 导出测试对象
if (typeof module !== 'undefined') {
  module.exports = TEST
}

// 全局挂载
if (typeof window !== 'undefined') {
  window.SYSTEM_TEST = TEST
}
if (typeof global !== 'undefined') {
  global.SYSTEM_TEST = TEST
}

console.log('自动化测试脚本已加载')
console.log('运行命令: await SYSTEM_TEST.runAll()')
