App({
  globalData: {
    userInfo: null,
    openid: null,
    isAdmin: false,
    craftsmanInfo: null
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'your-env-id', // 请替换为您的云开发环境ID
        traceUser: true,
      })
    }
    
    this.checkUserRole()
  },

  // 检查用户角色（管理员或手工艺人）
  checkUserRole: function () {
    const that = this
    wx.cloud.callFunction({
      name: 'craftsman',
      data: {
        action: 'checkUserRole'
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.globalData.openid = res.result.data.openid
        that.globalData.isAdmin = res.result.data.isAdmin
        that.globalData.craftsmanInfo = res.result.data.craftsmanInfo
      }
    }).catch(err => {
      console.error('检查用户角色失败:', err)
    })
  },

  // 获取全局数据
  getGlobalData: function (key) {
    return this.globalData[key]
  },

  // 设置全局数据
  setGlobalData: function (key, value) {
    this.globalData[key] = value
  }
})
