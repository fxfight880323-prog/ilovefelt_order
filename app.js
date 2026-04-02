const util = require('./utils/util.js')

App({
  globalData: {
    userInfo: null,
    openid: null,
    userRole: 'guest', // guest, craftsman, dispatcher, admin
    roleInfo: null,
    isLoggedIn: false,
    isCheckingLogin: false, // 是否正在检查登录状态
    myOrdersFilter: null // 我的订单页面筛选状态
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-9gg5wxnh64aaabbc', // 云开发环境ID
        traceUser: true,
      })
    }
    
    // 应用启动时检查登录状态（实现自动登录）
    console.log('App onLaunch, 检查登录状态...')
    this.autoLogin()
  },

  // 自动登录
  autoLogin: function () {
    const that = this
    
    // 检查是否用户主动退出
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到退出标记，不自动登录')
      return
    }
    
    // 先检查本地缓存
    const cachedRole = wx.getStorageSync('userRole')
    const cachedUserInfo = wx.getStorageSync('userInfo') || {}
    
    if (cachedRole && cachedRole !== 'guest') {
      console.log('自动登录（缓存）:', cachedRole)
      that.globalData.userRole = cachedRole
      that.globalData.roleInfo = cachedUserInfo
      that.globalData.isLoggedIn = true
      return
    }
    
    // 尝试从服务端获取登录状态
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getUserInfo'
      }
    }).then(res => {
      console.log('自动登录结果:', res.result)
      
      if (res.result && res.result.code === 0) {
        const { roles = [], currentRole, rolesInfo } = res.result.data
        
        if (roles.length > 0) {
          // 有有效角色，自动登录
          const role = currentRole || roles[0]
          const roleInfo = rolesInfo ? rolesInfo[role] : null
          
          that.globalData.userRole = role
          that.globalData.roleInfo = roleInfo
          that.globalData.isLoggedIn = true
          that.globalData.isAdmin = roles.includes('admin')
          
          // 保存到本地
          wx.setStorageSync('userRole', role)
          wx.setStorageSync('userInfo', roleInfo || {})
          
          console.log('自动登录成功:', role)
        }
      }
    }).catch(err => {
      console.log('自动登录失败:', err)
    })
  },

  // 检查登录状态
  checkLoginStatus: function (showLoading = true) {
    if (this.globalData.isCheckingLogin) {
      return Promise.resolve({ role: this.globalData.userRole })
    }

    this.globalData.isCheckingLogin = true
    
    if (showLoading) {
      util.showLoading('登录中...')
    }

    const that = this
    return wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'login'
      }
    }).then(res => {
      util.hideLoading()
      that.globalData.isCheckingLogin = false
      
      if (res.result && res.result.code === 0) {
        const { role, status, roleInfo, isAdmin, userInfo } = res.result.data
        
        // 更新全局数据
        that.globalData.openid = res.result.data.openid || ''
        that.globalData.userRole = role
        that.globalData.roleInfo = roleInfo
        that.globalData.isAdmin = isAdmin
        that.globalData.isLoggedIn = role !== 'guest'
        
        // 缓存登录信息到本地
        wx.setStorageSync('userRole', role)
        wx.setStorageSync('userInfo', userInfo || {})
        
        // 根据角色决定跳转
        that.handleRoleRedirect(role, status)
        
        return { role, status, roleInfo, isAdmin }
      } else if (res.result && res.result.code === -1001) {
        // 用户未注册，返回特定状态
        console.log('用户未注册，需要先注册')
        return { role: 'guest', needRegister: true }
      } else {
        // 登录失败，尝试用缓存
        return that.checkLocalCache()
      }
    }).catch(err => {
      util.hideLoading()
      that.globalData.isCheckingLogin = false
      console.error('检查登录状态失败:', err)
      
      // 网络错误时尝试使用本地缓存
      return that.checkLocalCache()
    })
  },

  // 检查本地缓存
  checkLocalCache: function () {
    // 检查是否是用户主动退出的，如果是则不使用缓存登录
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到用户主动退出，不使用缓存登录')
      return { role: 'guest' }
    }
    
    try {
      const cachedRole = wx.getStorageSync('userRole')
      if (cachedRole && cachedRole !== 'guest') {
        // 有缓存，先使用缓存数据
        this.globalData.userRole = cachedRole
        this.globalData.isLoggedIn = true
        
        const cachedUserInfo = wx.getStorageSync('userInfo') || {}
        this.globalData.roleInfo = cachedUserInfo
        
        console.log('使用本地缓存登录:', cachedRole)
        return { role: cachedRole, fromCache: true }
      }
    } catch (e) {
      console.error('读取本地缓存失败:', e)
    }
    
    return { role: 'guest' }
  },

  // 根据角色跳转
  handleRoleRedirect: function (role, status) {
    const pages = getCurrentPages()
    const currentPage = pages.length > 0 ? pages[pages.length - 1] : null
    const currentRoute = currentPage ? currentPage.route : ''
    
    // 如果已经在认证页面或首页，不跳转
    if (currentRoute.includes('pages/auth/') || currentRoute === 'pages/common/index') {
      return
    }

    if (role === 'guest') {
      // 新用户，跳转到角色选择
      wx.reLaunch({
        url: '/pages/auth/roleSelect'
      })
    } else if (role === 'craftsman' && status === 'pending') {
      // 手艺人待审核
      wx.showModal({
        title: '审核中',
        content: '您的手艺人注册申请正在审核中，请耐心等待',
        showCancel: false
      })
    } else {
      // 已注册用户，跳转到首页
      wx.switchTab({
        url: '/pages/common/index'
      })
    }
  },

  // 退出登录
  logout: function () {
    // 清除全局数据
    this.globalData.userRole = 'guest'
    this.globalData.roleInfo = null
    this.globalData.isLoggedIn = false
    this.globalData.openid = null
    
    // 清除本地缓存并设置退出标记，防止自动登录
    wx.removeStorageSync('userRole')
    wx.removeStorageSync('userInfo')
    wx.setStorageSync('logoutFlag', true)
    
    // 跳转到登录页
    wx.reLaunch({
      url: '/pages/login/index'
    })
  },

  // 更新全局数据
  setGlobalData: function (key, value) {
    this.globalData[key] = value
  },

  // 获取全局数据
  getGlobalData: function (key) {
    return this.globalData[key]
  }
})
