const app = getApp()

Page({
  data: {
    userRole: 'guest',
    loading: true,
    isAutoLogin: false
  },

  onLoad() {
    // 页面加载时检查登录状态
    this.checkLoginStatus()
  },

  onShow() {
    // 每次显示页面时检查
    this.checkLoginStatus()
  },

  // 检查登录状态
  async checkLoginStatus() {
    this.setData({ loading: true })
    
    // 检查是否是用户主动退出的，如果是则不自动登录
    const logoutFlag = wx.getStorageSync('logoutFlag')
    if (logoutFlag) {
      console.log('检测到用户主动退出，不自动登录')
      this.setData({ 
        userRole: 'guest',
        loading: false,
        isAutoLogin: false 
      })
      return
    }
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'login' }
      })

      if (res.result.code === 0) {
        const { role, status, roleInfo, isAdmin } = res.result.data
        
        // 更新全局数据
        app.globalData.userRole = role
        app.globalData.roleInfo = roleInfo
        app.globalData.isAdmin = isAdmin
        app.globalData.isLoggedIn = role !== 'guest'
        
        // 缓存到本地
        wx.setStorageSync('userRole', role)
        wx.setStorageSync('userInfo', roleInfo || {})

        if (role !== 'guest') {
          // 已注册用户，自动跳转到首页
          this.setData({ 
            isAutoLogin: true,
            userRole: role 
          })
          
          wx.showToast({
            title: '欢迎回来',
            icon: 'success',
            duration: 1000
          })
          
          // 延迟跳转
          setTimeout(() => {
            if (role === 'craftsman' && status === 'pending') {
              // 待审核状态，显示提示
              wx.showModal({
                title: '审核中',
                content: '您的手艺人注册申请正在审核中，请耐心等待审核通过后再操作',
                showCancel: false,
                success: () => {
                  wx.switchTab({ url: '/pages/common/index' })
                }
              })
            } else {
              wx.switchTab({ url: '/pages/common/index' })
            }
          }, 1000)
        } else {
          // 新用户，显示角色选择
          this.setData({ 
            userRole: 'guest',
            loading: false,
            isAutoLogin: false 
          })
        }
      }
    } catch (err) {
      console.error('检查登录状态失败:', err)
      
      // 尝试使用本地缓存
      const cachedRole = wx.getStorageSync('userRole')
      if (cachedRole && cachedRole !== 'guest') {
        this.setData({ 
          isAutoLogin: true,
          userRole: cachedRole 
        })
        
        setTimeout(() => {
          wx.switchTab({ url: '/pages/common/index' })
        }, 500)
      } else {
        this.setData({ 
          userRole: 'guest',
          loading: false,
          isAutoLogin: false 
        })
      }
    }
  },

  // 选择手艺人角色
  async selectCraftsman() {
    await this.checkRoleAccess('craftsman')
  },

  // 选择派单人角色
  async selectDispatcher() {
    await this.checkRoleAccess('dispatcher')
  },

  // 检查角色访问权限
  async checkRoleAccess(role) {
    try {
      wx.showLoading({ title: '检查中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'checkRoleAccess',
          data: { role }
        }
      })

      wx.hideLoading()

      const { hasAccess, status, message } = res.result.data

      if (hasAccess) {
        // 有权限，切换到该角色
        const switchRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'switchRole',
            data: { role }
          }
        })

        if (switchRes.result.code === 0) {
          // 获取新角色的完整信息
          const userRes = await wx.cloud.callFunction({
            name: 'user',
            data: { action: 'getUserInfo' }
          })
          
          if (userRes.result.code === 0) {
            const { rolesInfo, roles } = userRes.result.data
            const newRoleInfo = rolesInfo ? rolesInfo[role] : null
            
            // 完全更新全局数据 - 角色隔离
            app.globalData.userRole = role
            app.globalData.roleInfo = newRoleInfo
            app.globalData.isAdmin = roles.includes('admin')
            
            // 更新本地缓存
            wx.setStorageSync('userRole', role)
            wx.setStorageSync('userInfo', newRoleInfo || {})
          }
          
          wx.showToast({ title: '切换成功', icon: 'success' })
          // 切换成功后清除退出标记
          wx.removeStorageSync('logoutFlag')
          setTimeout(() => {
            // 根据角色跳转到对应首页
            if (role === 'craftsman') {
              wx.switchTab({ url: '/pages/craftsman/orderList' })
            } else if (role === 'dispatcher') {
              wx.switchTab({ url: '/pages/common/index' })
            } else if (role === 'admin') {
              wx.navigateTo({ url: '/pages/admin/console' })
            }
          }, 1000)
        }
      } else {
        // 没有权限，根据状态处理
        if (status === 'pending') {
          // 审核中，跳转到等待页面
          wx.navigateTo({
            url: `/pages/common/pendingApproval?role=${role}`
          })
        } else if (status === 'rejected') {
          // 被拒绝，询问是否重新申请
          wx.showModal({
            title: '申请被拒绝',
            content: '您的申请已被拒绝，是否重新申请？',
            confirmText: '重新申请',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.navigateTo({
                  url: role === 'craftsman' 
                    ? '/pages/auth/craftsmanRegister'
                    : '/pages/auth/dispatcherAuth'
                })
              }
            }
          })
        } else {
          // 未申请，引导注册
          wx.navigateTo({
            url: role === 'craftsman' 
              ? '/pages/auth/craftsmanRegister'
              : '/pages/auth/dispatcherAuth'
          })
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('检查角色权限失败:', err)
      wx.showToast({ title: '检查失败', icon: 'none' })
    }
  },

  // 查看帮助
  viewHelp() {
    wx.showModal({
      title: '角色说明',
      content: '【手艺人】可以接单制作手工艺品，需要填写个人信息并等待审核\n\n【派单人】可以发布订单，需要手机号验证码验证',
      showCancel: false
    })
  }
})
