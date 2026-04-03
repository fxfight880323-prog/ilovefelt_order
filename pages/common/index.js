const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    userRole: 'guest',
    isAdmin: false,
    roleInfo: null,
    roles: ['guest'],
    currentRole: 'guest',
    availableRoles: [],
    stats: {
      pendingCount: 0,
      acceptedCount: 0,
      completedCount: 0,
      totalCount: 0
    },
    noticeList: [],
    loading: false
  },

  onLoad() {
    // 检查是否是管理员，如果是则跳转到控制台
    const userRole = wx.getStorageSync('userRole')
    if (userRole === 'admin') {
      console.log('欢迎页检测到管理员，跳转到控制台')
      wx.redirectTo({
        url: '/pages/admin/console'
      })
      return
    }
    this.checkUserRole()
  },

  onShow() {
    this.getOrderStats()
    this.getNoticeList()
    
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  onPullDownRefresh() {
    this.checkUserRole()
    this.getOrderStats()
    this.getNoticeList()
    wx.stopPullDownRefresh()
  },

  // 检查用户角色
  async checkUserRole() {
    try {
      // 使用新的 API
      const res = await API.auth.checkStatus()
      
      if (res.success && res.data.registered) {
        const { role, roles, isSuperAdmin, isAdmin } = res.data
        
        // 如果是管理员，跳转到控制台
        if (isSuperAdmin || isAdmin || roles?.includes('admin')) {
          console.log('欢迎页检测到管理员角色，跳转到控制台')
          wx.redirectTo({
            url: '/pages/admin/console'
          })
          return
        }
        
        const activeRole = role || (roles && roles[0]) || 'guest'
        
        this.setData({
          userRole: activeRole,
          currentRole: activeRole,
          roles: roles || [activeRole],
          isAdmin: isAdmin || isSuperAdmin || false
        })
        
        app.globalData.userRole = activeRole
        app.globalData.roles = roles || [activeRole]
        app.globalData.isAdmin = isAdmin || isSuperAdmin || false

        // 加载用户的可用角色
        this.loadUserRoles()
      } else {
        // 未登录，显示登录按钮
        console.log('用户未登录')
      }
    } catch (err) {
      console.error('检查角色失败:', err)
    }
  },

  // 加载用户可用角色
  async loadUserRoles() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getUserRoles' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          availableRoles: res.result.data.availableRoles
        })
      }
    } catch (err) {
      console.error('获取角色列表失败:', err)
    }
  },

  // 获取订单统计
  async getOrderStats() {
    if (this.data.userRole === 'guest') return
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getOrderStats' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          stats: res.result.data
        })
      }
    } catch (err) {
      console.error('获取统计失败:', err)
    }
  },

  // 获取公告列表
  async getNoticeList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getNoticeList', limit: 5 }
      })
      
      if (res.result.code === 0) {
        this.setData({
          noticeList: res.result.data.list || []
        })
      }
    } catch (err) {
      console.error('获取公告失败:', err)
    }
  },

  // 跳转到订单管理
  goToOrderManage() {
    if (!this.hasRole(['dispatcher', 'admin'])) {
      wx.showToast({ title: '仅限派单人或管理员', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/admin/orderManage'
    })
  },

  // 跳转到我的派单（派单人）
  goToMyDispatchOrders() {
    if (!this.hasRole(['dispatcher'])) {
      wx.showToast({ title: '仅限派单人', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/dispatcher/myOrders'
    })
  },

  // 跳转到样式管理
  goToStyleManage() {
    if (!this.hasRole(['dispatcher', 'admin'])) {
      wx.showToast({ title: '仅限派单人', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/admin/styleManage'
    })
  },

  // 跳转到创建订单
  goToCreateOrder() {
    if (!this.hasRole(['dispatcher', 'admin'])) {
      wx.showToast({ title: '仅限派单人', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/admin/orderForm'
    })
  },

  // 跳转到接单大厅（手艺人）
  goToOrderHall() {
    if (!this.hasRole(['craftsman', 'admin'])) {
      wx.showToast({ title: '仅限手艺人', icon: 'none' })
      return
    }
    wx.switchTab({
      url: '/pages/craftsman/orderList'
    })
  },

  // 跳转到我的订单
  goToMyOrders() {
    if (!this.hasRole(['craftsman', 'admin'])) {
      wx.showToast({ title: '仅限手艺人', icon: 'none' })
      return
    }
    wx.switchTab({
      url: '/pages/craftsman/myOrders'
    })
  },

  // 跳转到个人中心
  goToProfile() {
    wx.switchTab({
      url: '/pages/craftsman/profile'
    })
  },

  // 跳转到管理员控制台
  goToAdminConsole() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅限管理员', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/admin/console'
    })
  },

  // 跳转到统计页面
  goToStatistics() {
    if (this.data.currentRole === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/admin/stats/index'
    })
  },

  // 进入工作台（根据角色跳转到不同页面）
  enterWorkspace() {
    const { currentRole } = this.data
    
    if (currentRole === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    
    if (currentRole === 'craftsman') {
      // 手艺人 - 跳转到接单大厅
      wx.switchTab({
        url: '/pages/craftsman/orderList'
      })
    } else if (currentRole === 'dispatcher') {
      // 派单人 - 跳转到派单页面
      wx.switchTab({
        url: '/pages/dispatcher/myOrders'
      })
    } else if (currentRole === 'admin') {
      // 管理员 - 跳转到控制台
      wx.navigateTo({
        url: '/pages/admin/console'
      })
    }
  },

  // 检查是否有指定角色
  hasRole(roles) {
    const { currentRole, isAdmin } = this.data
    if (isAdmin) return true
    return roles.includes(currentRole)
  },

  // 切换角色
  async switchRole() {
    const { availableRoles, currentRole } = this.data
    
    if (availableRoles.length <= 1) {
      // 只有一个角色，显示注册新角色或退出
      wx.showActionSheet({
        itemList: ['注册为新角色', '退出登录'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.showRegisterOptions()
          } else if (res.tapIndex === 1) {
            this.logout()
          }
        }
      })
      return
    }
    
    // 构建角色切换选项
    const itemList = availableRoles.map(r => 
      `${r.icon} ${r.label}${r.value === currentRole ? ' (当前)' : ''}`
    )
    itemList.push('注册新角色')
    itemList.push('退出登录')
    
    wx.showActionSheet({
      itemList,
      success: async (res) => {
        const index = res.tapIndex
        
        if (index < availableRoles.length) {
          // 切换到选中角色
          const selectedRole = availableRoles[index]
          await this.doSwitchRole(selectedRole.value)
        } else if (index === availableRoles.length) {
          // 注册新角色
          this.showRegisterOptions()
        } else {
          // 退出登录
          this.logout()
        }
      }
    })
  },

  // 显示注册选项
  showRegisterOptions() {
    const { roles, userInfo } = this.data
    const options = []
    
    // 检查是否已有pending状态的角色申请
    const pendingCraftsman = userInfo.rolesInfo?.craftsman?.status === 'pending'
    const pendingDispatcher = userInfo.rolesInfo?.dispatcher?.status === 'pending'
    
    if (!roles.includes('craftsman') && !pendingCraftsman) {
      options.push('注册为手艺人')
    } else if (pendingCraftsman) {
      wx.showModal({
        title: '申请审核中',
        content: '您的手艺人注册申请正在审核中，请耐心等待管理员审批。如有疑问，请联系管理员。',
        confirmText: '联系管理员',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/common/contactAdmin' })
          }
        }
      })
      return
    }
    
    if (!roles.includes('dispatcher') && !pendingDispatcher) {
      options.push('注册为派单人')
    } else if (pendingDispatcher) {
      wx.showModal({
        title: '申请审核中',
        content: '您的派单人注册申请正在审核中，请耐心等待管理员审批。如有疑问，请联系管理员。',
        confirmText: '联系管理员',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/common/contactAdmin' })
          }
        }
      })
      return
    }
    
    if (options.length === 0) {
      wx.showToast({ title: '您已拥有所有角色', icon: 'none' })
      return
    }
    
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        if (options[res.tapIndex].includes('手艺人')) {
          // 检查是否已有其他角色
          if (roles.includes('dispatcher')) {
            wx.showModal({
              title: '注册提示',
              content: '您当前已注册为派单人，一个手机号只能注册一个角色。如需切换角色，请联系管理员。',
              confirmText: '联系管理员',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({ url: '/pages/common/contactAdmin' })
                }
              }
            })
            return
          }
          wx.navigateTo({ url: '/pages/auth/craftsmanRegister' })
        } else {
          // 检查是否已有其他角色
          if (roles.includes('craftsman')) {
            wx.showModal({
              title: '注册提示',
              content: '您当前已注册为手艺人，一个手机号只能注册一个角色。如需切换角色，请联系管理员。',
              confirmText: '联系管理员',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({ url: '/pages/common/contactAdmin' })
                }
              }
            })
            return
          }
          wx.navigateTo({ url: '/pages/auth/dispatcherAuth' })
        }
      }
    })
  },

  // 执行角色切换
  async doSwitchRole(role) {
    try {
      wx.showLoading({ title: '切换中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'switchRole',
          data: { role }
        }
      })
      
      wx.hideLoading()
      
      if (res.result.code === 0) {
        wx.showToast({ title: '切换成功', icon: 'success' })
        
        // 更新本地状态
        this.setData({ currentRole: role })
        app.globalData.userRole = role
        
        // 更新 tabBar
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().updateTabBar()
        }
        
        // 刷新页面
        this.checkUserRole()
        this.getOrderStats()
        
        // 根据角色跳转到对应首页
        if (role === 'craftsman') {
          wx.switchTab({ url: '/pages/craftsman/orderList' })
        } else if (role === 'dispatcher') {
          wx.switchTab({ url: '/pages/common/index' })
        } else if (role === 'admin') {
          wx.navigateTo({ url: '/pages/admin/console' })
        }
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('切换角色失败:', err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userRole = 'guest'
          app.globalData.roleInfo = null
          app.globalData.roles = ['guest']
          app.globalData.isAdmin = false
          // 清除缓存并设置退出标记，防止自动登录
          wx.removeStorageSync('userRole')
          wx.removeStorageSync('userInfo')
          wx.setStorageSync('logoutFlag', true)
          wx.reLaunch({
            url: '/pages/login/index'
          })
        }
      }
    })
  },

  // 头像加载失败时重新加载
  onAvatarError() {
    console.log('头像加载失败，重新加载数据')
    // 清空头像，然后重新加载
    this.setData({
      'roleInfo.avatarUrl': ''
    })
    this.checkUserRole()
  }
})
