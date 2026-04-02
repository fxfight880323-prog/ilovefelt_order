/**
 * 统一API调用封装
 * 对应云函数: cloudfunctions/api/index.js
 */

const API = {
  // 基础调用方法
  async call(module, action, data = {}) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { module, action, ...data }
      })
      
      const result = res.result
      
      // 统一错误处理
      if (!result.success) {
        // 未审批状态特殊处理
        if (result.code === -1002) {
          console.log('账号正在审核中')
        }
        throw new Error(result.msg || '操作失败')
      }
      
      return result
    } catch (err) {
      console.error(`[API Error] ${module}.${action}:`, err)
      throw err
    }
  },

  // ========== 认证模块 ==========
  auth: {
    // 检查登录状态
    async checkStatus() {
      return await API.call('auth', 'checkStatus')
    },

    // 用户注册
    async register(userData) {
      return await API.call('auth', 'register', userData)
    },

    // 手机号登录
    async loginByPhone(phone, password) {
      return await API.call('auth', 'loginByPhone', { phone, password })
    },

    // 微信一键登录（如果已实现）
    async wechatLogin() {
      // 先获取微信登录凭证
      const loginRes = await wx.login()
      return await API.call('auth', 'wechatLogin', { code: loginRes.code })
    }
  },

  // ========== 管理员模块 ==========
  admin: {
    // 获取待审批列表
    async getPendingRequests() {
      return await API.call('admin', 'getPendingRequests')
    },

    // 审批通过/拒绝
    async approve(applicationId, approved, reason = '') {
      return await API.call('admin', 'approve', { 
        applicationId, 
        approved, 
        reason 
      })
    },

    // 获取统计数据
    async getStats() {
      return await API.call('admin', 'getStats')
    }
  },

  // ========== 订单模块 ==========
  order: {
    // 创建订单
    async create(orderData) {
      return await API.call('order', 'create', orderData)
    },

    // 获取订单列表
    async list() {
      return await API.call('order', 'list')
    },

    // 获取订单详情
    async getDetail(orderId) {
      return await API.call('order', 'getDetail', { orderId })
    },

    // 接单
    async accept(orderId) {
      return await API.call('order', 'accept', { orderId })
    },

    // 取消订单
    async cancel(orderId, reason = '') {
      return await API.call('order', 'cancel', { orderId, reason })
    },

    // 完成订单
    async complete(orderId, data = {}) {
      return await API.call('order', 'complete', { 
        orderId, 
        trackingNo: data.trackingNo,
        photos: data.photos,
        completionNote: data.completionNote
      })
    },

    // 获取手艺人列表（用于派单）
    async getCraftsmen() {
      return await API.call('order', 'getCraftsmen')
    }
  },

  // ========== 用户模块 ==========
  user: {
    // 获取用户信息
    async getInfo() {
      return await API.call('user', 'getInfo')
    },

    // 切换角色
    async switchRole(role) {
      return await API.call('user', 'switchRole', { role })
    }
  }
}

// 兼容旧版直接调用方式
API.request = API.call

module.exports = API
