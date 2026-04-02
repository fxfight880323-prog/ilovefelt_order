const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    form: {
      name: '',
      phone: '',
      wechatId: '',
      specialty: '',
      experience: '',
      address: '',
      idCard: '',
      verifyCode: '',
      password: '',
      confirmPassword: ''
    },
    specialties: ['木工', '陶艺', '编织', '刺绣', '雕刻', '绘画', '其他'],
    specialtyIndex: -1,
    experiences: ['1年以下', '1-3年', '3-5年', '5-10年', '10年以上'],
    experienceIndex: -1,
    loading: false,
    agreeProtocol: false,
    countdown: 0,
    canSendCode: false
  },

  onLoad() {
    this.getWechatInfo()
  },

  async getWechatInfo() {
    try {
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善手艺人资料'
      })
      this.setData({ 'form.name': userInfo.nickName })
    } catch (err) {
      console.log('用户拒绝授权')
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`form.${field}`]: e.detail.value })
    
    if (field === 'phone') {
      this.checkCanSendCode(e.detail.value)
    }
  },

  checkCanSendCode(phone) {
    const canSend = /^1[3-9]\d{9}$/.test(phone) && this.data.countdown === 0
    this.setData({ canSendCode: canSend })
  },

  onSpecialtyChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      specialtyIndex: index,
      'form.specialty': this.data.specialties[index]
    })
  },

  onExperienceChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      experienceIndex: index,
      'form.experience': this.data.experiences[index]
    })
  },

  onAgreeChange(e) {
    this.setData({ agreeProtocol: e.detail.value.length > 0 })
  },

  // 发送验证码 - 保留原有方式（短信模块）
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
          data: { phone, type: 'craftsman' }
        }
      })
      
      wx.hideLoading()
      
      if (res.result.code === 0) {
        wx.showToast({ title: '验证码已发送', icon: 'success' })
        this.startCountdown()
        
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

  validateForm() {
    const { form } = this.data

    if (!form.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return false
    }
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
    if (!form.specialty) {
      wx.showToast({ title: '请选择擅长工艺', icon: 'none' })
      return false
    }
    if (!form.experience) {
      wx.showToast({ title: '请选择从业经验', icon: 'none' })
      return false
    }
    if (!form.address.trim()) {
      wx.showToast({ title: '请输入所在地区', icon: 'none' })
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

  // 提交注册 - 使用新API
  async submitRegister() {
    if (!this.validateForm()) return
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 使用新API注册
      const res = await API.auth.register({
        name: this.data.form.name,
        phone: this.data.form.phone,
        requestRole: 'craftsman',
        password: this.data.form.password,
        specialty: this.data.form.specialty,
        experience: this.data.form.experience,
        address: this.data.form.address,
        wechatId: this.data.form.wechatId,
        idCard: this.data.form.idCard
      })

      console.log('注册响应:', res)
      
      wx.showModal({
        title: '申请已提交',
        content: '您的手艺人注册申请已提交，需要管理员审批后才能登录使用。\n\n请耐心等待审批结果，审批通过后请重新登录。',
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          wx.reLaunch({ url: '/pages/login/index' })
        }
      })
      
    } catch (err) {
      console.error('申请失败:', err)
      wx.showToast({ title: err.message || '申请失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  viewProtocol() {
    wx.navigateTo({ url: '/pages/auth/protocol' })
  },

  goToContactAdmin() {
    wx.navigateTo({ url: '/pages/common/contactAdmin' })
  }
})
