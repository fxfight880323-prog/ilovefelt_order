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
    password: '',
    showBindPhone: false,
    bindPhone: '',
    bindPassword: ''
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
    // 检查退出标记
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到退出标记，保持登录页面，不自动刷新')
      this.setData({
        isLoading: false,
        showLogin: true
      })
      // 不清除标记，等用户成功登录后再清除
    }
  },

  // 检查登录状态并跳转 - 使用新API
  async checkLoginAndNavigate() {
    console.log('开始检查登录状态')
    
    // 检查退出标记
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到退出标记，取消自动登录')
      this.showLoginButtons()
      return
    }
    
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
        const { roles, currentRole, isSuperAdmin } = checkRes.data
        
        // 优先判断是否是管理员
        if (isSuperAdmin || roles?.includes('admin')) {
          console.log('自动登录: 检测到管理员')
          app.globalData.userRole = 'admin'
          app.globalData.isLoggedIn = true
          app.globalData.isAdmin = true
          wx.setStorageSync('userRole', 'admin')
          
          // 清除退出标记
          wx.removeStorageSync('logoutFlag')
          
          this.setData({ loadingText: '正在进入管理后台...' })
          setTimeout(() => {
            this.navigateToHome('admin')
          }, 500)
          return
        }
        
        const role = currentRole || roles[0]
        
        // 更新全局数据
        app.globalData.userRole = role
        app.globalData.isLoggedIn = true
        app.globalData.isAdmin = false
        
        wx.setStorageSync('userRole', role)
        
        console.log('自动登录成功:', role)
        
        // 清除退出标记，允许下次正常登录
        wx.removeStorageSync('logoutFlag')
        
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
    console.log('跳转到首页, role:', role)
    
    // 超级管理员跳转到管理后台
    if (role === 'admin') {
      // 使用 redirectTo 避免页面栈问题
      wx.redirectTo({
        url: '/pages/admin/console',
        success: () => {
          console.log('跳转到管理后台成功')
        },
        fail: (err) => {
          console.error('跳转失败:', err)
          // 如果跳转失败，显示登录按钮
          this.showLoginButtons()
        }
      })
      return
    }
    
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

  // 微信一键登录
  async onWechatLogin() {
    if (!this.data.agreeProtocol) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }

    this.setData({ isLoading: true, loadingText: '微信登录中...' })

    try {
      // 调用微信登录API
      const res = await API.auth.wechatLogin()
      console.log('微信登录结果:', res)

      if (res.success) {
        if (res.data.bound) {
          // 已绑定，直接登录
          const { phone, name, roles, currentRole, isSuperAdmin } = res.data
          
          app.globalData.isLoggedIn = true
          app.globalData.isAdmin = isSuperAdmin || roles.includes('admin')
          app.globalData.userRole = currentRole
          app.globalData.userInfo = { name, phone }
          
          wx.setStorageSync('userRole', currentRole)
          wx.setStorageSync('userInfo', { name, phone })
          wx.removeStorageSync('logoutFlag')
          
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            success: () => {
              setTimeout(() => {
                this.navigateToHome(currentRole)
              }, 1000)
            }
          })
        } else {
          // 未绑定，跳转到绑定页面
          this.setData({ 
            isLoading: false, 
            showLogin: true,
            showBindPhone: true // 显示绑定手机号弹窗
          })
          wx.showToast({ title: '请先绑定手机号', icon: 'none' })
        }
      } else {
        this.setData({ isLoading: false, showLogin: true })
        wx.showToast({ title: res.msg || '登录失败', icon: 'none' })
      }
    } catch (err) {
      console.error('微信登录失败:', err)
      this.setData({ isLoading: false, showLogin: true })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // 绑定手机号
  async onBindPhone() {
    const { bindPhone, bindPassword } = this.data

    if (!bindPhone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(bindPhone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' })
      return
    }
    if (!bindPassword) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    this.setData({ isLoading: true })

    try {
      const res = await API.auth.bindPhone({
        phone: bindPhone,
        password: bindPassword
      })

      if (res.success) {
        const { phone, name, roles, currentRole, isSuperAdmin } = res.data
        
        app.globalData.isLoggedIn = true
        app.globalData.isAdmin = isSuperAdmin || roles.includes('admin')
        app.globalData.userRole = currentRole
        app.globalData.userInfo = { name, phone }
        
        wx.setStorageSync('userRole', currentRole)
        wx.setStorageSync('userInfo', { name, phone })
        wx.removeStorageSync('logoutFlag')
        
        wx.showToast({
          title: '绑定成功',
          icon: 'success',
          success: () => {
            setTimeout(() => {
              this.setData({ showBindPhone: false })
              this.navigateToHome(currentRole)
            }, 1000)
          }
        })
      } else {
        this.setData({ isLoading: false })
        wx.showToast({ title: res.msg || '绑定失败', icon: 'none' })
      }
    } catch (err) {
      console.error('绑定失败:', err)
      this.setData({ isLoading: false })
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
  },

  // 关闭绑定弹窗
  closeBindModal() {
    this.setData({ showBindPhone: false })
  },

  // 绑定手机号输入
  onBindPhoneInput(e) {
    this.setData({ bindPhone: e.detail.value })
  },

  // 绑定密码输入
  onBindPasswordInput(e) {
    this.setData({ bindPassword: e.detail.value })
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

      // 超级管理员直接跳转
      if (res.data.isSuperAdmin || roles.includes('admin')) {
        app.globalData.userRole = 'admin'
        app.globalData.isAdmin = true
        wx.setStorageSync('userRole', 'admin')
        
        wx.showToast({
          title: '管理员登录成功',
          icon: 'success',
          success: () => {
            setTimeout(() => {
              this.navigateToHome('admin')
            }, 1000)
          }
        })
        return
      }
      
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
