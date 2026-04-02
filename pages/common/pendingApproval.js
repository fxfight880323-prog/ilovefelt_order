const app = getApp()

Page({
  data: {
    role: '',
    roleName: '',
    status: '',
    applyTime: '',
    approveTime: '',
    rejectReason: '',
    loading: true
  },

  onLoad(options) {
    console.log('[pendingApproval] 页面参数:', options)
    
    // 从参数获取角色
    const { role } = options
    if (role) {
      this.setData({
        role,
        roleName: role === 'craftsman' ? '手艺人' : '派单人'
      })
    } else {
      console.error('[pendingApproval] 缺少 role 参数')
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
    
    // 加载申请状态
    this.loadApplicationStatus()
  },

  onShow() {
    // 每次显示都刷新状态
    if (!this.data.loading) {
      this.loadApplicationStatus()
    }
  },

  // 加载申请状态
  async loadApplicationStatus() {
    this.setData({ loading: true })
    
    try {
      console.log('[loadApplicationStatus] 查询角色:', this.data.role)
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getRoleApplicationStatus',
          data: { role: this.data.role }
        }
      })
      console.log('[loadApplicationStatus] 查询结果:', res.result)

      if (res.result.code === 0) {
        const data = res.result.data
        
        // 如果没有申请记录，默认显示审核中
        const status = data.status || 'pending'
        
        this.setData({
          status: status,
          applyTime: data.applyTime ? this.formatTime(data.applyTime) : '',
          approveTime: data.approveTime ? this.formatTime(data.approveTime) : '',
          rejectReason: data.rejectReason || '',
          loading: false
        })

        // 如果已通过，显示通知但不自动跳转
        // 用户需要点击"进入首页"手动进入
        if (data.status === 'active' && data.hasRole) {
          wx.showToast({
            title: '您的申请已通过！',
            icon: 'success',
            duration: 2000
          })
        }
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('加载状态失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 切换到该角色
  async switchToRole() {
    try {
      wx.showLoading({ title: '切换中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'switchRole',
          data: { role: this.data.role }
        }
      })

      wx.hideLoading()

      if (res.result.code === 0) {
        wx.showToast({
          title: '切换成功',
          icon: 'success'
        })
        
        // 更新全局数据
        app.globalData.currentRole = this.data.role
        
        // 根据角色跳转到对应首页
        setTimeout(() => {
          const role = this.data.role
          if (role === 'craftsman') {
            wx.switchTab({ url: '/pages/craftsman/orderList' })
          } else if (role === 'dispatcher') {
            wx.switchTab({ url: '/pages/common/index' })
          } else if (role === 'admin') {
            wx.navigateTo({ url: '/pages/admin/console' })
          }
        }, 1000)
      } else {
        wx.showToast({
          title: res.result.message || '切换失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('切换失败:', err)
      wx.showToast({
        title: '切换失败',
        icon: 'none'
      })
    }
  },

  // 联系管理员
  contactAdmin() {
    wx.navigateTo({
      url: '/pages/common/contactAdmin'
    })
  },

  // 重新申请
  reapply() {
    wx.showModal({
      title: '重新申请',
      content: '确定要重新申请吗？之前的申请记录将被清除。',
      success: (res) => {
        if (res.confirm) {
          // 跳转到注册页面
          const url = this.data.role === 'craftsman' 
            ? '/pages/auth/craftsmanRegister'
            : '/pages/auth/dispatcherAuth'
          wx.redirectTo({ url })
        }
      }
    })
  },

  // 进入首页
  goToHome() {
    wx.switchTab({
      url: '/pages/common/index'
    })
  },

  // 返回登录页
  goToLogin() {
    wx.reLaunch({
      url: '/pages/login/index'
    })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const hour = d.getHours().toString().padStart(2, '0')
    const minute = d.getMinutes().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})
