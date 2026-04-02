const app = getApp()

Page({
  data: {
    form: {
      phone: '',
      name: '',
      company: '',
      verifyCode: '',
      password: '',
      confirmPassword: ''
    },
    loading: false,
    agreeProtocol: false,
    showTip: true,
    countdown: 0,
    canSendCode: false
  },

  onLoad() {
    // 3秒后隐藏提示
    setTimeout(() => {
      this.setData({ showTip: false })
    }, 5000)
  },

  // 输入框变化
  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`form.${field}`]: e.detail.value
    })
    
    // 检查是否可以发送验证码
    if (field === 'phone') {
      this.checkCanSendCode(e.detail.value)
    }
  },

  // 检查是否可以发送验证码
  checkCanSendCode(phone) {
    const canSend = /^1[3-9]\d{9}$/.test(phone) && this.data.countdown === 0
    this.setData({ canSendCode: canSend })
  },

  // 同意协议
  onAgreeChange(e) {
    this.setData({
      agreeProtocol: e.detail.value.length > 0
    })
  },

  // 发送验证码
  async sendVerifyCode() {
    const { phone } = this.data.form
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    
    if (this.data.countdown > 0) return
    
    try {
      wx.showLoading({ title: '发送中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'sms',
        data: {
          action: 'sendVerifyCode',
          data: {
            phone,
            type: 'dispatcher'
          }
        }
      })
      
      wx.hideLoading()
      
      if (res.result.code === 0) {
        wx.showToast({ title: '验证码已发送', icon: 'success' })
        
        // 开始倒计时
        this.startCountdown()
        
        // 测试环境显示验证码
        if (res.result.data && res.result.data.code) {
          console.log('测试验证码：', res.result.data.code)
        }
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('发送验证码失败:', err)
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
    }
  },

  // 倒计时
  startCountdown() {
    let countdown = 60
    this.setData({ countdown, canSendCode: false })
    
    this.timer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(this.timer)
        this.setData({ countdown: 0 })
        this.checkCanSendCode(this.data.form.phone)
      } else {
        this.setData({ countdown })
      }
    }, 1000)
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  },

  // 验证表单
  validateForm() {
    const { form } = this.data

    if (!form.phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return false
    }
    if (!/^1[3-9]\d{9}$/.test(form.phone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' })
      return false
    }
    if (!form.verifyCode.trim()) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return false
    }
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return false
    }
    if (!form.password) {
      wx.showToast({ title: '请设置登录密码', icon: 'none' })
      return false
    }
    if (form.password.length < 6 || form.password.length > 20) {
      wx.showToast({ title: '密码长度需为6-20位', icon: 'none' })
      return false
    }
    if (form.password !== form.confirmPassword) {
      wx.showToast({ title: '两次密码输入不一致', icon: 'none' })
      return false
    }
    if (!this.data.agreeProtocol) {
      wx.showToast({ title: '请同意服务协议', icon: 'none' })
      return false
    }

    return true
  },

  // 提交认证
  async submitAuth() {
    console.log('=== 开始派单人注册 ===')
    
    if (!this.validateForm()) {
      console.log('表单验证失败')
      return
    }
    if (this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '提交中...' })

    try {
      console.log('调用云函数 applyRole')
      console.log('提交数据:', this.data.form)
      
      // 使用新的角色申请接口
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'applyRole',
          data: {
            role: 'dispatcher',
            applyData: this.data.form
          }
        }
      })
      
      console.log('云函数返回:', res.result)
      wx.hideLoading()

      if (res.result.code === 0) {
        const { status, isAdmin } = res.result.data
        
        if (status === 'active') {
          // 直接通过（管理员）
          wx.showModal({
            title: '申请通过',
            content: '恭喜您，您的派单人申请已通过！',
            showCancel: false,
            success: () => {
              wx.switchTab({ url: '/pages/common/index' })
            }
          })
        } else {
          // 需要审核，显示提示并返回登录页
          wx.showModal({
            title: '申请已提交',
            content: '您的派单人注册申请已提交，需要管理员审批后才能登录使用。\n\n请耐心等待审批结果，审批通过后请重新登录。',
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              // 返回登录页，不直接进入等待页面
              wx.reLaunch({
                url: '/pages/login/index'
              })
            }
          })
        }
      } else {
        console.error('申请失败:', res.result.message)
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('申请失败:', err)
      wx.showModal({
        title: '错误',
        content: '申请失败: ' + (err.message || JSON.stringify(err)),
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 查看协议
  viewProtocol() {
    wx.navigateTo({
      url: '/pages/auth/protocol?type=dispatcher'
    })
  },

  // 返回角色选择
  goBack() {
    wx.navigateBack()
  },

  // 跳转到联系管理员页面
  goToContactAdmin() {
    wx.navigateTo({ url: '/pages/common/contactAdmin' })
  }
})
