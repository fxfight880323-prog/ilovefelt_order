const app = getApp()

Page({
  data: {
    loading: false,
    result: null,
    collections: []
  },

  onLoad() {
    // 检查是否是管理员
    if (!app.globalData.isAdmin) {
      wx.showModal({
        title: '权限不足',
        content: '仅限管理员使用此功能',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  // 检查数据库状态
  async checkDatabase() {
    this.setData({ loading: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'initDb',
        data: { checkOnly: true }
      })
      
      this.setData({
        result: res.result,
        collections: res.result.data.collections,
        loading: false
      })
      
      wx.showToast({ title: '检查完成', icon: 'success' })
    } catch (err) {
      this.setData({ loading: false })
      console.error('检查失败:', err)
      wx.showToast({ title: '检查失败', icon: 'none' })
    }
  },

  // 初始化数据库
  async initDatabase() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认初始化',
        content: '将创建所有必要的数据库集合，是否继续？',
        success: (res) => resolve(res.confirm)
      })
    })
    
    if (!confirmed) return
    
    this.setData({ loading: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'initDb',
        data: { checkOnly: false }
      })
      
      this.setData({
        result: res.result,
        collections: res.result.data.collections,
        loading: false
      })
      
      const summary = res.result.data.summary
      wx.showModal({
        title: '初始化完成',
        content: `✅ 创建: ${summary.created} 个\n📋 已存在: ${summary.exists} 个\n❌ 失败: ${summary.error} 个`,
        showCancel: false
      })
    } catch (err) {
      this.setData({ loading: false })
      console.error('初始化失败:', err)
      wx.showToast({ title: '初始化失败', icon: 'none' })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
})
