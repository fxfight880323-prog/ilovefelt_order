const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    isLoading: true,
    showLogin: false,
    showRetry: false,
    loadingText: '正在加载...',
    agreeProtocol: false,
    loginMode: 'wechat',
    phone: '',
    password: ''
  },

  onLoad(options) {
    console.log('登录页 onLoad')
    this.setData({
      isLoading: true,
      showLogin: false,
      loadingText: '正在检查登录状态...'
    })
    
    if (!wx.cloud) {
      console.error('云开发未初始化')
      this.showLoginButtons()
      return
    }
    
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到退出标记，不自动登录')
      this.showLoginButtons()
      return
    }
    
    setTimeout(() => {
      this.checkLoginAndNavigate()
    }, 1500)
  },

  onShow() {
    console.log('登录页 onShow')
  },

  // 检查登录状态并跳转 - 使用新API
  async checkLoginAndNavigate() {
    console.log('开始检查登录状态')
    
    try {
      const cachedRole = wx.getStorageSync('userRole')
      if (cachedRole && cachedRole !== 'guest') {
        console.log('使用本地缓存登录:', cachedRole)
        this.setData({ loadingText: '正在进入...' })
        setTimeout(() => {
          this.navigateToHome(cachedRole)
        }, 500)
        return
      }
      
      // 使用新API检查状态
      let checkRes
      try {
        checkRes = await API.auth.checkStatus()
      } catch (err) {
        // 用户不存在或其他错误，显示登录按钮
        console.log('用户未注册或检查失败:', err)
        this.showLoginButtons()
        return
      }
      
      console.log('获取用户信息结果:', checkRes)

      if (checkRes.data.registered && checkRes.data.approved) {
        const { roles, currentRole } = checkRes.data
        const role = currentRole || roles[0]
        
        // 获取用户详细信息
        const userRes = await API.user.getInfo()
        const roleInfo = userRes.data.rolesInfo ? userRes.data.rolesInfo[role] : null
        
        // 更新全局数据
        app.globalData.userRole = role
        app.globalData.roleInfo = roleInfo
        app.globalData.isLoggedIn = true
        app.globalData.isAdmin = roles.includes('admin')
        
        wx.setStorageSync('userRole', role)
        wx.setStorageSync('userInfo', roleInfo || {})
        
        console.log('自动登录成功:', role)
        
        this.setData({ loadingText: '正在进入...' })
        setTimeout(() => {
          this.navigateToHome(role)
        }, 500)
        return
        
      } else if (checkRes.data.registered && !checkRes.data.approved) {
        // 已注册但未审批
        console.log('用户未审批')
        this.setData({ isLoading: false, showLogin: true })
        
        if (checkRes.data.pendingRoles.length > 0) {
          wx.showModal({
            title: '等待审批',
            content: '您的申请正在审核中，请耐心等待',
            confirmText: '查看状态',
            cancelText: '知道了',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.navigateTo({
                  url: `/pages/common/pendingApproval?role=${checkRes.data.pendingRoles[0]}`
                })
              }
            }
          })
        }
        return
      }
      
      // 未注册
      console.log('用户未注册，显示登录按钮')
      this.showLoginButtons()
      
    } catch (err) {
      console.error('检查登录状态失败:', err)
      this.showLoginButtons()
    }
  },

  showLoginButtons() {
    this.setData({
      isLoading: false,
      showLogin: true
    })
  },

  navigateToHome(role) {
    console.log('跳转到首页')
    wx.switchTab({
      url: '/pages/common/index',
      success: () => {
        console.log('跳转到首页成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        this.showLoginButtons()
      }
    })
  },

  // 微信登录
  async onWechatLogin() {
    if (!this.data.agreeProtocol) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }

    this.setData({ isLoading: true, loadingText: '登录中...' })

    try {
      // 微信登录凭证
      const loginRes = await wx.login()
      console.log('微信登录凭证:', loginRes.code)

      // TODO: 如果需要微信登录，需要先在API中添加 wechatLogin 方法
      // 目前使用手机号登录
      this.setData({ isLoading: false, showLogin: true })
      wx.showToast({ title: '请使用手机号登录', icon: 'none' })
      
    } catch (err) {
      console.error('登录失败:', err)
      this.setData({ isLoading: false, showLogin: true })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // 切换登录模式
  switchLoginMode() {
    this.setData({
      loginMode: this.data.loginMode === 'wechat' ? 'phone' : 'wechat',
      phone: '',
      password: ''
    })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  // 手机号密码登录 - 使用新API
  async onPhoneLogin() {
    const { phone, password } = this.data

    if (!phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    this.setData({ isLoading: true, showLogin: false, loadingText: '登录中...' })

    try {
      // 使用新API登录
      const res = await API.auth.loginByPhone(phone, password)
      console.log('手机号登录结果:', res)

      const { roles, currentRole, rolesInfo } = res.data
      
      app.globalData.isLoggedIn = true
      app.globalData.isAdmin = roles.includes('admin')
      wx.removeStorageSync('logoutFlag')

      // 多角色选择
      if (roles.length > 1) {
        const roleItems = roles.map(r => {
          const labels = { craftsman: '手艺人', dispatcher: '派单人', admin: '管理员' }
          return labels[r] || r
        })
        
        this.setData({ isLoading: false, showLogin: true })
        wx.showActionSheet({
          itemList: roleItems,
          success: (sheetRes) => {
            const selectedRole = roles[sheetRes.tapIndex]
            const selectedRoleInfo = rolesInfo ? rolesInfo[selectedRole] : null
            
            app.globalData.userRole = selectedRole
            app.globalData.roleInfo = selectedRoleInfo
            wx.setStorageSync('userRole', selectedRole)
            wx.setStorageSync('userInfo', selectedRoleInfo || {})
            
            this.navigateToHome(selectedRole)
          }
        })
      } else if (roles.length === 1) {
        const role = roles[0]
        const roleInfo = rolesInfo ? rolesInfo[role] : null
        
        app.globalData.userRole = role
        app.globalData.roleInfo = roleInfo
        wx.setStorageSync('userRole', role)
        wx.setStorageSync('userInfo', roleInfo || {})
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          success: () => {
            setTimeout(() => {
              this.navigateToHome(role)
            }, 1500)
          }
        })
      }
      
    } catch (err) {
      console.error('登录失败:', err)
      this.setData({ isLoading: false, showLogin: true })
      
      // 处理特定错误码
      if (err.message.includes('未注册')) {
        wx.showModal({
          title: '未注册',
          content: '该手机号未注册，请先注册账号',
          confirmText: '去注册',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.goToRegister()
            }
          }
        })
      } else if (err.message.includes('审核中')) {
        wx.showModal({
          title: '等待审批',
          content: err.message,
          confirmText: '查看状态',
          cancelText: '知道了',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.navigateTo({ url: '/pages/common/pendingApproval' })
            }
          }
        })
      } else {
        wx.showToast({ title: err.message || '登录失败', icon: 'none' })
      }
    }
  },

  goToRegister() {
    wx.showActionSheet({
      itemList: ['注册为手艺人', '注册为派单人'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/auth/craftsmanRegister' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/auth/dispatcherAuth' })
        }
      }
    })
  },

  toggleProtocol() {
    this.setData({ agreeProtocol: !this.data.agreeProtocol })
  },

  viewProtocol() {
    wx.navigateTo({ url: '/pages/auth/protocol?type=service' })
  },

  viewPrivacy() {
    wx.navigateTo({ url: '/pages/auth/protocol?type=privacy' })
  }
})
