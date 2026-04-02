/**
 * 端到端测试辅助脚本
 * 用于初始化测试数据、验证数据库状态
 * 
 * 使用方法：
 * 1. 在微信开发者工具控制台运行
 * 2. 或在云函数测试环境中运行
 */

const cloud = wx.cloud || require('wx-server-sdk')

// 初始化云开发
if (typeof wx === 'undefined') {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
}
const db = cloud.database()
const _ = db.command

// ==================== 测试配置 ====================
const TEST_CONFIG = {
  adminPhone: '13810062394',
  testPhones: {
    craftsmanA: '13800138001',
    craftsmanB: '13800138003',
    dispatcherA: '13800138002',
    dualRole: '13800138004'
  },
  testPassword: '123456'
}

// ==================== 测试数据工厂 ====================
const TestDataFactory = {
  // 创建管理员用户
  async createAdmin() {
    const existRes = await db.collection('users').where({ phone: TEST_CONFIG.adminPhone }).get()
    if (existRes.data.length > 0) {
      console.log('管理员已存在')
      return existRes.data[0]._id
    }

    const result = await db.collection('users').add({
      data: {
        openid: 'admin_openid_' + Date.now(),
        phone: TEST_CONFIG.adminPhone,
        name: '系统管理员',
        roles: ['admin'],
        currentRole: 'admin',
        isAdmin: true,
        status: 'active',
        roleApplications: [{
          role: 'admin',
          status: 'active',
          applyTime: db.serverDate()
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    console.log('管理员创建成功:', result._id)
    return result._id
  },

  // 创建待审批的手艺人
  async createPendingCraftsman(phone, name) {
    // 清理旧数据
    await this.cleanUserData(phone)

    const openid = 'test_craftsman_' + Date.now()
    
    // 创建用户
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone,
        name,
        roles: [],
        currentRole: '',
        roleApplications: [{
          role: 'craftsman',
          status: 'pending',
          applyTime: db.serverDate(),
          applyData: {
            specialty: '木工',
            experience: '3-5年',
            address: '北京市朝阳区'
          }
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    // 创建手艺人记录
    const craftsmanRes = await db.collection('craftsmen').add({
      data: {
        userId: userRes._id,
        openid,
        name,
        phone,
        specialty: '木工',
        experience: '3-5年',
        address: '北京市朝阳区',
        starLevel: 3,
        performance: '良好',
        totalOrders: 0,
        completedOrders: 0,
        rating: 5.0,
        reliabilityScore: 5.0,
        reliabilityLevel: '优秀',
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log(`待审批手艺人创建成功: ${name} (${phone})`)
    return { userId: userRes._id, craftsmanId: craftsmanRes._id }
  },

  // 创建已激活的手艺人
  async createActiveCraftsman(phone, name) {
    await this.cleanUserData(phone)

    const openid = 'test_craftsman_' + Date.now()
    
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone,
        name,
        roles: ['craftsman'],
        currentRole: 'craftsman',
        roleApplications: [{
          role: 'craftsman',
          status: 'active',
          applyTime: db.serverDate(),
          approveTime: db.serverDate(),
          applyData: {
            specialty: '陶艺',
            experience: '5-10年',
            address: '上海市浦东新区'
          }
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    const craftsmanRes = await db.collection('craftsmen').add({
      data: {
        userId: userRes._id,
        openid,
        name,
        phone,
        specialty: '陶艺',
        experience: '5-10年',
        address: '上海市浦东新区',
        starLevel: 4,
        performance: '优秀',
        totalOrders: 0,
        completedOrders: 0,
        rating: 5.0,
        reliabilityScore: 5.0,
        reliabilityLevel: '优秀',
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log(`已激活手艺人创建成功: ${name} (${phone})`)
    return { userId: userRes._id, craftsmanId: craftsmanRes._id, openid }
  },

  // 创建待审批的派单人
  async createPendingDispatcher(phone, name) {
    await this.cleanUserData(phone)

    const openid = 'test_dispatcher_' + Date.now()
    
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone,
        name,
        roles: [],
        currentRole: '',
        roleApplications: [{
          role: 'dispatcher',
          status: 'pending',
          applyTime: db.serverDate(),
          applyData: {
            company: '测试公司'
          }
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    const dispatcherRes = await db.collection('dispatchers').add({
      data: {
        userId: userRes._id,
        openid,
        name,
        phone,
        company: '测试公司',
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log(`待审批派单人创建成功: ${name} (${phone})`)
    return { userId: userRes._id, dispatcherId: dispatcherRes._id }
  },

  // 创建已激活的派单人
  async createActiveDispatcher(phone, name) {
    await this.cleanUserData(phone)

    const openid = 'test_dispatcher_' + Date.now()
    
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone,
        name,
        roles: ['dispatcher'],
        currentRole: 'dispatcher',
        roleApplications: [{
          role: 'dispatcher',
          status: 'active',
          applyTime: db.serverDate(),
          approveTime: db.serverDate(),
          applyData: {
            company: '正式公司'
          }
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    const dispatcherRes = await db.collection('dispatchers').add({
      data: {
        userId: userRes._id,
        openid,
        name,
        phone,
        company: '正式公司',
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log(`已激活派单人创建成功: ${name} (${phone})`)
    return { userId: userRes._id, dispatcherId: dispatcherRes._id, openid }
  },

  // 创建测试订单
  async createTestOrder(dispatcherId, orderName = '测试订单') {
    const orderCode = this.generateOrderCode()
    
    const result = await db.collection('orders').add({
      data: {
        orderCode,
        name: orderName,
        styleId: 'style_test',
        styleName: '测试样式',
        quantity: 10,
        price: 50,
        totalPrice: 500,
        receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        remark: '这是测试订单',
        dispatcherId,
        dispatcherName: '测试派单人',
        craftsmanId: '',
        craftsmanName: '',
        status: 'pending',
        paymentStatus: 'unpaid',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log(`测试订单创建成功: ${orderName} (${orderCode})`)
    return { orderId: result._id, orderCode }
  },

  // 生成订单编码
  generateOrderCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const letter1 = letters[Math.floor(Math.random() * letters.length)]
    const letter2 = letters[Math.floor(Math.random() * letters.length)]
    
    const now = new Date()
    const year = String(now.getFullYear()).slice(2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    
    return letter1 + letter2 + year + month + day + random
  },

  // 清理用户数据
  async cleanUserData(phone) {
    // 删除 users 记录
    const userRes = await db.collection('users').where({ phone }).get()
    for (const user of userRes.data) {
      await db.collection('users').doc(user._id).remove()
    }

    // 删除 craftsmen 记录
    const craftsmanRes = await db.collection('craftsmen').where({ phone }).get()
    for (const c of craftsmanRes.data) {
      await db.collection('craftsmen').doc(c._id).remove()
    }

    // 删除 dispatchers 记录
    const dispatcherRes = await db.collection('dispatchers').where({ phone }).get()
    for (const d of dispatcherRes.data) {
      await db.collection('dispatchers').doc(d._id).remove()
    }

    console.log(`已清理 ${phone} 的旧数据`)
  },

  // 清理所有测试数据
  async cleanAllTestData() {
    const testPhones = Object.values(TEST_CONFIG.testPhones)
    
    for (const phone of testPhones) {
      await this.cleanUserData(phone)
    }

    // 清理测试订单
    const orders = await db.collection('orders').where({
      name: db.RegExp({ regexp: '测试', options: 'i' })
    }).get()
    
    for (const order of orders.data) {
      await db.collection('orders').doc(order._id).remove()
    }

    console.log('所有测试数据已清理')
  }
}

// ==================== 验证工具 ====================
const TestValidator = {
  // 验证用户状态
  async validateUserStatus(phone, expectedStatus) {
    const userRes = await db.collection('users').where({ phone }).get()
    
    if (userRes.data.length === 0) {
      console.error(`❌ 用户 ${phone} 不存在`)
      return false
    }

    const user = userRes.data[0]
    const roleApps = user.roleApplications || []
    const activeRoles = roleApps.filter(app => app.status === 'active').map(app => app.role)
    
    console.log(`用户 ${phone} 状态:`)
    console.log(`  - 角色: ${activeRoles.join(', ') || '无'}`)
    console.log(`  - 申请状态: ${roleApps.map(a => `${a.role}:${a.status}`).join(', ')}`)
    
    return true
  },

  // 验证订单状态
  async validateOrderStatus(orderId, expectedStatus) {
    const orderRes = await db.collection('orders').doc(orderId).get()
    
    if (!orderRes.data) {
      console.error(`❌ 订单 ${orderId} 不存在`)
      return false
    }

    const order = orderRes.data
    const statusMatch = order.status === expectedStatus
    
    console.log(`订单 ${orderId}:`)
    console.log(`  - 名称: ${order.name}`)
    console.log(`  - 状态: ${order.status} ${statusMatch ? '✅' : '❌ (期望: ' + expectedStatus + ')'}`)
    console.log(`  - 手艺人: ${order.craftsmanName || '未分配'}`)
    console.log(`  - 派单人: ${order.dispatcherName}`)
    
    return statusMatch
  },

  // 验证手艺人统计
  async validateCraftsmanStats(craftsmanId) {
    const craftsmanRes = await db.collection('craftsmen').doc(craftsmanId).get()
    
    if (!craftsmanRes.data) {
      console.error(`❌ 手艺人 ${craftsmanId} 不存在`)
      return false
    }

    const c = craftsmanRes.data
    console.log(`手艺人 ${c.name} 统计:`)
    console.log(`  - 总接单数: ${c.totalOrders}`)
    console.log(`  - 已完成数: ${c.completedOrders}`)
    console.log(`  - 履约分: ${c.reliabilityScore}`)
    console.log(`  - 履约等级: ${c.reliabilityLevel}`)
    
    return true
  }
}

// ==================== 模拟审批流程 ====================
const ApprovalSimulator = {
  // 模拟管理员审批通过
  async approveCraftsman(craftsmanId) {
    const adminRes = await db.collection('users').where({ phone: TEST_CONFIG.adminPhone }).get()
    if (adminRes.data.length === 0) {
      console.error('管理员不存在，请先创建管理员')
      return false
    }

    const craftsmanRes = await db.collection('craftsmen').doc(craftsmanId).get()
    if (!craftsmanRes.data) {
      console.error('手艺人不存在')
      return false
    }

    const craftsman = craftsmanRes.data
    const openid = craftsman.openid

    // 更新手艺人状态
    await db.collection('craftsmen').doc(craftsmanId).update({
      data: {
        status: 'active',
        updateTime: db.serverDate()
      }
    })

    // 更新用户角色
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      const roleApps = user.roleApplications || []
      const appIndex = roleApps.findIndex(a => a.role === 'craftsman')
      
      if (appIndex > -1) {
        roleApps[appIndex].status = 'active'
        roleApps[appIndex].approveTime = db.serverDate()
      }

      await db.collection('users').doc(user._id).update({
        data: {
          roles: ['craftsman'],
          currentRole: 'craftsman',
          roleApplications: roleApps,
          updateTime: db.serverDate()
        }
      })
    }

    console.log(`✅ 手艺人 ${craftsman.name} 审批通过`)
    return true
  },

  // 模拟管理员审批派单人
  async approveDispatcher(dispatcherId) {
    const dispatcherRes = await db.collection('dispatchers').doc(dispatcherId).get()
    if (!dispatcherRes.data) {
      console.error('派单人不存在')
      return false
    }

    const dispatcher = dispatcherRes.data
    const openid = dispatcher.openid

    await db.collection('dispatchers').doc(dispatcherId).update({
      data: {
        status: 'active',
        updateTime: db.serverDate()
      }
    })

    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      const roleApps = user.roleApplications || []
      const appIndex = roleApps.findIndex(a => a.role === 'dispatcher')
      
      if (appIndex > -1) {
        roleApps[appIndex].status = 'active'
        roleApps[appIndex].approveTime = db.serverDate()
      }

      await db.collection('users').doc(user._id).update({
        data: {
          roles: ['dispatcher'],
          currentRole: 'dispatcher',
          roleApplications: roleApps,
          updateTime: db.serverDate()
        }
      })
    }

    console.log(`✅ 派单人 ${dispatcher.name} 审批通过`)
    return true
  }
}

// ==================== 一键测试流程 ====================
const E2ETest = {
  // 完整测试：手艺人流程
  async testCraftsmanFlow() {
    console.log('========== 开始手艺人流程测试 ==========')
    
    // 1. 创建管理员
    await TestDataFactory.createAdmin()
    
    // 2. 创建待审批手艺人
    const { userId, craftsmanId } = await TestDataFactory.createPendingCraftsman(
      TEST_CONFIG.testPhones.craftsmanA,
      '测试手艺人A'
    )
    
    // 3. 验证待审批状态
    console.log('\n--- 验证待审批状态 ---')
    await TestValidator.validateUserStatus(TEST_CONFIG.testPhones.craftsmanA)
    
    // 4. 模拟审批通过
    console.log('\n--- 模拟管理员审批 ---')
    await ApprovalSimulator.approveCraftsman(craftsmanId)
    
    // 5. 验证审批后状态
    console.log('\n--- 验证审批后状态 ---')
    await TestValidator.validateUserStatus(TEST_CONFIG.testPhones.craftsmanA)
    
    // 6. 创建派单人和订单
    const { dispatcherId, openid: dispatcherOpenid } = await TestDataFactory.createActiveDispatcher(
      TEST_CONFIG.testPhones.dispatcherA,
      '测试派单人A'
    )
    
    const { orderId, orderCode } = await TestDataFactory.createTestOrder(
      dispatcherId,
      '手艺人测试订单'
    )
    
    console.log('\n--- 验证订单状态 ---')
    await TestValidator.validateOrderStatus(orderId, 'pending')
    
    console.log('\n========== 手艺人流程测试数据准备完成 ==========')
    console.log('测试账号信息：')
    console.log(`  手艺人: ${TEST_CONFIG.testPhones.craftsmanA} / ${TEST_CONFIG.testPassword}`)
    console.log(`  派单人: ${TEST_CONFIG.testPhones.dispatcherA} / ${TEST_CONFIG.testPassword}`)
    console.log(`  订单编号: ${orderCode}`)
    
    return {
      craftsman: { phone: TEST_CONFIG.testPhones.craftsmanA, craftsmanId },
      dispatcher: { phone: TEST_CONFIG.testPhones.dispatcherA, dispatcherId },
      order: { orderId, orderCode }
    }
  },

  // 完整测试：派单人流程
  async testDispatcherFlow() {
    console.log('========== 开始派单人流程测试 ==========')
    
    await TestDataFactory.createAdmin()
    
    const { userId, dispatcherId } = await TestDataFactory.createPendingDispatcher(
      TEST_CONFIG.testPhones.dispatcherA,
      '测试派单人B'
    )
    
    console.log('\n--- 验证待审批状态 ---')
    await TestValidator.validateUserStatus(TEST_CONFIG.testPhones.dispatcherA)
    
    console.log('\n--- 模拟管理员审批 ---')
    await ApprovalSimulator.approveDispatcher(dispatcherId)
    
    console.log('\n--- 验证审批后状态 ---')
    await TestValidator.validateUserStatus(TEST_CONFIG.testPhones.dispatcherA)
    
    // 创建一个已激活的手艺人用于派单
    const { craftsmanId } = await TestDataFactory.createActiveCraftsman(
      TEST_CONFIG.testPhones.craftsmanA,
      '测试手艺人A'
    )
    
    console.log('\n========== 派单人流程测试数据准备完成 ==========')
    
    return {
      dispatcher: { phone: TEST_CONFIG.testPhones.dispatcherA, dispatcherId },
      craftsman: { phone: TEST_CONFIG.testPhones.craftsmanA, craftsmanId }
    }
  },

  // 清理所有测试数据
  async cleanup() {
    console.log('========== 清理测试数据 ==========')
    await TestDataFactory.cleanAllTestData()
    console.log('========== 清理完成 ==========')
  }
}

// ==================== 导出 ====================
module.exports = {
  TEST_CONFIG,
  TestDataFactory,
  TestValidator,
  ApprovalSimulator,
  E2ETest
}

// 如果在浏览器/小程序环境，挂载到全局
if (typeof window !== 'undefined') {
  window.E2ETestHelper = module.exports
}
if (typeof global !== 'undefined') {
  global.E2ETestHelper = module.exports
}
