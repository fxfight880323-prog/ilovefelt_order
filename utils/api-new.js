/**
 * API 调用封装 - 使用新的云函数 api-new
 * 当 api 云函数无法更新时使用
 */

const API = {
  async call(module, action, data = {}) {
    try {
      console.log(`[API] ${module}.${action}`, data)
      
      const result = await wx.cloud.callFunction({
        name: 'api-new',  // 使用新的云函数
        data: {
          module,
          action,
          ...data
        }
      })
      
      console.log(`[API] ${module}.${action} 返回:`, result.result)
      
      // 统一错误处理
      if (!result.result.success && result.result.code !== -1002) {
        console.warn(`[API] ${module}.${action} 业务错误:`, result.result.msg)
      }
      
      return result.result
    } catch (err) {
      console.error(`[API] ${module}.${action} 调用失败:`, err)
      return {
        success: false,
        msg: err.message || '网络错误'
      }
    }
  }
}

// 认证相关
API.auth = {
  checkStatus() {
    return API.call('auth', 'checkStatus')
  },
  
  register(data) {
    return API.call('auth', 'register', data)
  },
  
  loginByPhone(data) {
    return API.call('auth', 'loginByPhone', data)
  }
}

// 管理员相关
API.admin = {
  getPendingRequests() {
    return API.call('admin', 'getPendingRequests')
  },
  
  approve(data) {
    return API.call('admin', 'approve', data)
  },
  
  getStats() {
    return API.call('admin', 'getStats')
  }
}

// 订单相关
API.order = {
  create(data) {
    return API.call('order', 'create', data)
  },
  
  list(params = {}) {
    return API.call('order', 'list', params)
  },
  
  accept(data) {
    return API.call('order', 'accept', data)
  },
  
  cancel(data) {
    return API.call('order', 'cancel', data)
  },
  
  complete(data) {
    return API.call('order', 'complete', data)
  }
}

// 用户相关
API.user = {
  getProfile() {
    return API.call('user', 'getProfile')
  },
  
  updateProfile(data) {
    return API.call('user', 'updateProfile', data)
  }
}

module.exports = API
