const util = require('../../utils/util.js')

Page({
  data: {
    // 表单数据
    form: {
      name: '',
      styleId: '',
      styleName: '',
      quantity: 1,
      price: '',
      dispatchDate: '',
      receiveDate: '',
      remark: ''
    },
    // 样式列表
    styleList: [],
    // 样式选择器显示
    styleIndex: -1,
    // 是否显示新建样式输入框
    showNewStyleInput: false,
    newStyleName: '',
    // 提交中
    submitting: false
  },

  onLoad() {
    this.getStyleList()
    this.setDefaultDates()
  },

  // 设置默认日期
  setDefaultDates() {
    const today = util.formatDate(new Date())
    this.setData({
      'form.dispatchDate': today
    })
  },

  // 获取样式列表
  async getStyleList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: { action: 'getList' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          styleList: res.result.data
        })
      }
    } catch (err) {
      console.error('获取样式列表失败:', err)
      util.showToast('获取样式列表失败')
    }
  },

  // 输入订单名称
  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value
    })
  },

  // 选择样式
  onStyleChange(e) {
    const index = e.detail.value
    const style = this.data.styleList[index]
    this.setData({
      styleIndex: index,
      'form.styleId': style._id,
      'form.styleName': style.name
    })
  },

  // 显示新建样式输入
  showAddStyle() {
    this.setData({
      showNewStyleInput: true
    })
  },

  // 输入新样式名称
  onNewStyleInput(e) {
    this.setData({
      newStyleName: e.detail.value
    })
  },

  // 取消新建样式
  cancelAddStyle() {
    this.setData({
      showNewStyleInput: false,
      newStyleName: ''
    })
  },

  // 确认新建样式
  async confirmAddStyle() {
    const name = this.data.newStyleName.trim()
    if (!name) {
      util.showToast('请输入样式名称')
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: {
          action: 'add',
          data: { name }
        }
      })

      if (res.result.code === 0) {
        util.showToast('添加成功', 'success')
        const newStyle = res.result.data
        const styleList = [...this.data.styleList, newStyle]
        this.setData({
          styleList,
          styleIndex: styleList.length - 1,
          'form.styleId': newStyle._id,
          'form.styleName': newStyle.name,
          showNewStyleInput: false,
          newStyleName: ''
        })
      }
    } catch (err) {
      console.error('添加样式失败:', err)
      util.showToast('添加失败')
    }
  },

  // 输入数量
  onQuantityInput(e) {
    const value = parseInt(e.detail.value) || 1
    this.setData({
      'form.quantity': Math.max(1, value)
    })
  },

  // 输入价格
  onPriceInput(e) {
    this.setData({
      'form.price': e.detail.value
    })
  },

  // 选择派单日期
  onDispatchDateChange(e) {
    this.setData({
      'form.dispatchDate': e.detail.value
    })
  },

  // 选择收货日期
  onReceiveDateChange(e) {
    this.setData({
      'form.receiveDate': e.detail.value
    })
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({
      'form.remark': e.detail.value
    })
  },

  // 验证表单
  validateForm() {
    const { form } = this.data
    if (!form.name.trim()) {
      util.showToast('请输入订单名称')
      return false
    }
    if (!form.styleId) {
      util.showToast('请选择样式')
      return false
    }
    if (!form.quantity || form.quantity < 1) {
      util.showToast('请输入有效的数量')
      return false
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      util.showToast('请输入有效的价格')
      return false
    }
    if (!form.dispatchDate) {
      util.showToast('请选择派单日期')
      return false
    }
    if (!form.receiveDate) {
      util.showToast('请选择收货日期')
      return false
    }
    return true
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) return
    if (this.data.submitting) return

    this.setData({ submitting: true })
    util.showLoading('提交中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'create',
          data: {
            ...this.data.form,
            price: parseFloat(this.data.form.price),
            quantity: parseInt(this.data.form.quantity)
          }
        }
      })

      util.hideLoading()
      this.setData({ submitting: false })

      if (res.result.code === 0) {
        util.showToast('创建成功', 'success')
        // 发送新订单通知
        this.sendNewOrderNotification(res.result.data._id)
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showToast(res.result.message || '创建失败')
      }
    } catch (err) {
      util.hideLoading()
      this.setData({ submitting: false })
      console.error('创建订单失败:', err)
      util.showToast('创建失败')
    }
  },

  // 发送新订单通知
  async sendNewOrderNotification(orderId) {
    try {
      await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'sendNewOrderNotice',
          orderId
        }
      })
    } catch (err) {
      console.error('发送通知失败:', err)
    }
  }
})
