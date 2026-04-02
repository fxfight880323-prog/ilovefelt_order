const app = getApp()

Page({
  data: {
    logs: [],
    testPhone: '13800138002',
    testCode: ''
  },

  onLoad() {
    this.checkStatus()
  },

  // 检查状态
  async checkStatus() {
    const logs = []
    
    logs.push('=== 系统状态检查 ===')
    logs.push(`时间: ${new Date().toLocaleString()}`)
    
    // 检查全局数据
    logs.push('\n【全局数据】')
    logs.push(`userRole: ${app.globalData.userRole}`)
    logs.push(`isAdmin: ${app.globalData.isAdmin}`)
    logs.push(`isLoggedIn: ${app.globalData.isLoggedIn}`)
    logs.push(`roleInfo: ${JSON.stringify(app.globalData.roleInfo)}`)
    
    // 检查本地缓存
    logs.push('\n【本地缓存】')
    logs.push(`userRole: ${wx.getStorageSync('userRole')}`)
    logs.push(`userInfo: ${JSON.stringify(wx.getStorageSync('userInfo'))}`)
    logs.push(`isAdmin: ${wx.getStorageSync('isAdmin')}`)
    
    // 检查数据库连接
    logs.push('\n【数据库检查】')
    try {
      const res = await wx.cloud.callFunction({
        name: 'initDb',
        data: { checkOnly: true }
      })
      
      if (res.result.code === 0) {
        const collections = res.result.data.collections
        collections.forEach(col => {
          logs.push(`${col.name}: ${col.status}`)
        })
      }
    } catch (err) {
      logs.push('数据库检查失败: ' + err.message)
    }
    
    this.setData({ logs })
  },

  // 清空数据
  clearData() {
    wx.showModal({
      title: '确认清空',
      content: '将清空所有本地缓存，确定吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          app.globalData.userRole = 'guest'
          app.globalData.isAdmin = false
          app.globalData.isLoggedIn = false
          app.globalData.roleInfo = null
          
          wx.showToast({ title: '已清空', icon: 'success' })
          this.checkStatus()
        }
      }
    })
  },

  // 测试发送验证码
  async testSendCode() {
    if (!this.data.testPhone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '发送中...' })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'sms',
        data: {
          action: 'sendVerifyCode',
          data: {
            phone: this.data.testPhone,
            type: 'dispatcher'
          }
        }
      })
      
      wx.hideLoading()
      
      if (res.result.code === 0) {
        this.setData({ testCode: res.result.data.code })
        wx.showModal({
          title: '验证码',
          content: `验证码: ${res.result.data.code}`,
          showCancel: false
        })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  // 快速注册派单人
  async quickRegister() {
    if (!this.data.testPhone || !this.data.testCode) {
      wx.showToast({ title: '请填写手机号和验证码', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '注册中...' })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'verifyDispatcher',
          data: {
            phone: this.data.testPhone,
            name: '测试派单人',
            company: '测试公司',
            verifyCode: this.data.testCode
          }
        }
      })
      
      wx.hideLoading()
      
      if (res.result.code === 0) {
        const { isAdmin, status, dispatcherId } = res.result.data
        
        // 更新全局数据
        app.globalData.userRole = isAdmin ? 'admin' : 'dispatcher'
        app.globalData.isAdmin = isAdmin
        app.globalData.isLoggedIn = true
        app.globalData.roleInfo = {
          _id: dispatcherId,
          name: '测试派单人',
          phone: this.data.testPhone,
          company: '测试公司',
          status: status
        }
        
        wx.setStorageSync('userRole', isAdmin ? 'admin' : 'dispatcher')
        wx.setStorageSync('userInfo', app.globalData.roleInfo)
        wx.setStorageSync('isAdmin', isAdmin)
        
        wx.showModal({
          title: '注册成功',
          content: '派单人注册成功！',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/common/index' })
          }
        })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showModal({
        title: '注册失败',
        content: err.message || JSON.stringify(err),
        showCancel: false
      })
    }
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({ testPhone: e.detail.value })
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({ testCode: e.detail.value })
  },

  // 查看云函数日志
  viewCloudLogs() {
    wx.showModal({
      title: '查看日志',
      content: '请在微信开发者工具 → 云开发 → 云函数 → 日志 中查看 user 和 sms 云函数的执行日志',
      showCancel: false
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  }
})
