const app = getApp()

Page({
  data: {
    isLoading: true,
    showLogin: false,
    showRetry: false,
    loadingText: '正在加载...',
    agreeProtocol: false,
    loginMode: 'wechat', // wechat 或 phone
    phone: '',
    password: ''
  },

  onLoad(options) {
    console.log('登录页 onLoad')
    // 显示加载中
    this.setData({
      isLoading: true,
      showLogin: false,
      loadingText: '正在检查登录状态...'
    })
    
    // 检查云开发是否初始化
    if (!wx.cloud) {
      console.error('云开发未初始化')
      this.showLoginButtons()
      return
    }
    
    // 检查是否是用户主动退出的
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到退出标记，不自动登录')
      this.showLoginButtons()
      return
    }
    
    // 延迟检查登录状态（等待app.js的autoLogin完成）
    setTimeout(() => {
      this.checkLoginAndNavigate()
    }, 1500)
  },

  onShow() {
    console.log('登录页 onShow')
  },

  // 检查登录状态并跳转
  async checkLoginAndNavigate() {
    console.log('开始检查登录状态')
    
    try {
      // 先尝试获取本地缓存的角色
      const cachedRole = wx.getStorageSync('userRole')
      if (cachedRole && cachedRole !== 'guest') {
        console.log('使用本地缓存登录:', cachedRole)
        this.setData({ loadingText: '正在进入...' })
        setTimeout(() => {
          this.navigateToHome(cachedRole)
        }, 500)
        return
      }
      
      // 调用云函数获取用户信息
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getUserInfo' }
      })

      console.log('获取用户信息结果:', res.result)

      if (res.result.code === 0) {
        const { roles = [], currentRole, rolesInfo } = res.result.data
        
        if (roles.length > 0) {
          // 有有效角色，自动登录
          const role = currentRole || roles[0]
          const roleInfo = rolesInfo ? rolesInfo[role] : null
          
          // 更新全局数据
          app.globalData.userRole = role
          app.globalData.roleInfo = roleInfo
          app.globalData.isLoggedIn = true
          app.globalData.isAdmin = roles.includes('admin')
          
          // 保存到本地
          wx.setStorageSync('userRole', role)
          wx.setStorageSync('userInfo', roleInfo || {})
          
          console.log('自动登录成功:', role)
          
          // 跳转到首页
          this.setData({ loadingText: '正在进入...' })
          setTimeout(() => {
            this.navigateToHome(role)
          }, 500)
          return
        }
      } else if (res.result.code === -1) {
        // 用户不存在，显示登录按钮
        console.log('用户未注册，显示登录按钮')
        this.showLoginButtons()
        return
      }
      
      // 未登录或获取失败，显示登录按钮
      this.showLoginButtons()
      
    } catch (err) {
      console.error('检查登录状态失败:', err)
      this.showLoginButtons()
    }
  },

  // 显示登录按钮
  showLoginButtons() {
    this.setData({
      isLoading: false,
      showLogin: true
    })
  },

  // 跳转到首页
  navigateToHome(role) {
    console.log('跳转到首页')
    
    // 所有角色都统一进入首页，首页再根据角色处理
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
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    this.setData({ isLoading: true, loadingText: '登录中...' })

    try {
      // 获取微信登录凭证
      const loginRes = await wx.login()
      console.log('微信登录凭证:', loginRes.code)

      // 调用云函数进行登录
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'login',
          code: loginRes.code
        }
      })

      console.log('登录结果:', res.result)

      if (res.result.code === 0) {
        const { roles = [], pendingRoles = [], currentRole } = res.result.data
        
        console.log('登录成功:', { roles, pendingRoles, currentRole })
        
        // 保存登录信息
        app.globalData.isLoggedIn = true
        app.globalData.isAdmin = roles.includes('admin')
        
        // 登录成功后清除退出标记
        wx.removeStorageSync('logoutFlag')

        // 如果有多个已通过的角色，让用户选择
        if (roles.length > 1) {
          const roleItems = roles.map(r => {
            const labels = { craftsman: '手艺人', dispatcher: '派单人', admin: '管理员' }
            return labels[r] || r
          })
          
          wx.showActionSheet({
            itemList: roleItems,
            success: (sheetRes) => {
              const selectedRole = roles[sheetRes.tapIndex]
              const { rolesInfo } = res.result.data
              const selectedRoleInfo = rolesInfo ? rolesInfo[selectedRole] : null
              
              // 完全更新全局数据 - 角色隔离
              app.globalData.userRole = selectedRole
              app.globalData.roleInfo = selectedRoleInfo
              wx.setStorageSync('userRole', selectedRole)
              wx.setStorageSync('userInfo', selectedRoleInfo || {})
              
              this.navigateToHome(selectedRole)
            }
          })
        } else if (roles.length === 1) {
          // 只有一个角色，直接登录
          const role = roles[0]
          const { rolesInfo } = res.result.data
          const roleInfo = rolesInfo ? rolesInfo[role] : null
          
          // 完全更新全局数据 - 角色隔离
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
        } else {
          // 没有角色（不应该发生）
          wx.showToast({ title: '账号异常，请联系管理员', icon: 'none' })
        }
      } else if (res.result.code === -1001) {
        // 用户未注册
        this.setData({ isLoading: false, showLogin: true })
        wx.showModal({
          title: '未注册',
          content: res.result.message || '该用户未注册，请先注册账号',
          confirmText: '去注册',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.goToRegister()
            }
          }
        })
      } else if (res.result.code === -1002 || res.result.code === -1003) {
        // 正在审核中或未通过审批
        this.setData({ isLoading: false, showLogin: true })
        const role = res.result.data?.role || 'craftsman'
        wx.showModal({
          title: '等待审批',
          content: res.result.message,
          confirmText: '查看状态',
          cancelText: '知道了',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到审批状态页面
              wx.navigateTo({
                url: `/pages/common/pendingApproval?role=${role}`
              })
            }
          }
        })
      } else {
        this.setData({ isLoading: false, showLogin: true })
        wx.showToast({
          title: res.result.message || '登录失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('登录失败:', err)
      this.setData({ isLoading: false, showLogin: true })
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
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

  // 手机号输入
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  // 手机号密码登录
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
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'loginByPhone',
          data: { phone, password }
        }
      })

      console.log('手机号登录结果:', res.result)

      if (res.result.code === 0) {
        const { roles = [], pendingRoles = [], rolesInfo } = res.result.data
        
        console.log('手机号登录成功:', { roles, pendingRoles })
        
        app.globalData.isLoggedIn = true
        app.globalData.isAdmin = roles.includes('admin')
        wx.removeStorageSync('logoutFlag')

        // 如果有多个已通过的角色，让用户选择
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
              
              // 完全更新全局数据 - 角色隔离
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
          
          // 完全更新全局数据 - 角色隔离
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
      } else if (res.result.code === -1001) {
        this.setData({ isLoading: false, showLogin: true })
        wx.showModal({
          title: '未注册',
          content: res.result.message || '该手机号未注册，请先注册账号',
          confirmText: '去注册',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.goToRegister()
            }
          }
        })
      } else if (res.result.code === -1002 || res.result.code === -1003) {
        // 正在审核中或未通过审批
        this.setData({ isLoading: false, showLogin: true })
        const role = res.result.data?.role || 'craftsman'
        wx.showModal({
          title: '等待审批',
          content: res.result.message,
          confirmText: '查看状态',
          cancelText: '知道了',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.navigateTo({
                url: `/pages/common/pendingApproval?role=${role}`
              })
            }
          }
        })
      } else {
        this.setData({ isLoading: false, showLogin: true })
        wx.showToast({
          title: res.result.message || '登录失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('登录失败:', err)
      this.setData({ isLoading: false, showLogin: true })
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
    }
  },

  // 注册新账号
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

  // 切换协议同意状态
  toggleProtocol() {
    this.setData({
      agreeProtocol: !this.data.agreeProtocol
    })
  },

  // 查看用户协议
  viewProtocol() {
    wx.navigateTo({
      url: '/pages/auth/protocol?type=service'
    })
  },

  // 查看隐私政策
  viewPrivacy() {
    wx.navigateTo({
      url: '/pages/auth/protocol?type=privacy'
    })
  }
})
