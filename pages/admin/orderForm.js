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
      remark: '',
      imageUrl: ''
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

  onLoad(options) {
    this.getStyleList()
    
    // 检查是否为编辑模式
    if (options.id) {
      // 编辑模式
      this.setData({
        isEditMode: true,
        editOrderId: options.id
      })
      this.loadOrderDetail(options.id)
    } else {
      // 新建模式
      this.setDefaultDates()
    }
  },

  // 加载订单详情（编辑模式）
  async loadOrderDetail(orderId) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId
        }
      })

      wx.hideLoading()

      if (res.result.code === 0) {
        const order = res.result.data
        
        // 填充表单
        this.setData({
          form: {
            name: order.name,
            styleId: order.styleId,
            styleName: order.styleName,
            quantity: order.quantity,
            price: order.price,
            dispatchDate: util.formatDate(order.dispatchDate),
            receiveDate: util.formatDate(order.receiveDate),
            remark: order.remark || '',
            imageUrl: order.imageUrl || ''
          }
        })

        // 设置样式选择器索引
        const styleIndex = this.data.styleList.findIndex(s => s._id === order.styleId)
        if (styleIndex >= 0) {
          this.setData({ styleIndex })
        }
      } else {
        util.showToast('加载订单失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('加载订单失败:', err)
      util.showToast('加载失败')
    }
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

  // 选择图片
  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      
      const tempFilePath = res.tempFiles[0].tempFilePath
      
      // 上传图片到云存储
      util.showLoading('上传中...')
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `order-images/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`,
        filePath: tempFilePath
      })
      util.hideLoading()
      
      this.setData({
        'form.imageUrl': uploadRes.fileID
      })
      
      util.showToast('上传成功', 'success')
    } catch (err) {
      util.hideLoading()
      console.error('上传图片失败:', err)
      util.showToast('上传失败')
    }
  },

  // 输入订单名称
  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value
    })
  },

  // 选择样式（从picker）
  onStyleChange(e) {
    const index = e.detail.value
    const style = this.data.styleList[index]
    this.setData({
      styleIndex: index,
      'form.styleId': style._id,
      'form.styleName': style.name
    })
  },

  // 选择样式（从标签）
  selectStyle(e) {
    const index = e.currentTarget.dataset.index
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

    util.showLoading('添加中...')
    try {
      console.log('调用 style 云函数添加样式:', name)
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: {
          action: 'add',
          data: { name }
        }
      })

      console.log('添加样式结果:', res.result)
      util.hideLoading()

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
      } else {
        util.showToast(res.result.message || '添加失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('添加样式失败:', err)
      if (err.message && err.message.includes('FunctionName')) {
        util.showToast('请先部署 style 云函数')
      } else {
        util.showToast('添加失败: ' + (err.message || ''))
      }
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
      const formData = {
        ...this.data.form,
        price: parseFloat(this.data.form.price),
        quantity: parseInt(this.data.form.quantity)
      }
      
      // 判断是编辑模式还是新建模式
      const isEditMode = this.data.isEditMode
      const orderId = this.data.editOrderId
      
      console.log(isEditMode ? '更新订单数据:' : '创建订单数据:', formData)

      let res
      if (isEditMode) {
        // 编辑模式 - 更新订单
        res = await wx.cloud.callFunction({
          name: 'order',
          data: {
            action: 'update',
            orderId: orderId,
            data: formData
          }
        })
      } else {
        // 新建模式 - 创建订单
        res = await wx.cloud.callFunction({
          name: 'order',
          data: {
            action: 'create',
            data: formData
          }
        })
      }

      console.log(isEditMode ? '更新订单结果:' : '创建订单结果:', res.result)

      util.hideLoading()
      this.setData({ submitting: false })

      if (res.result.code === 0) {
        util.showToast(isEditMode ? '更新成功' : '创建成功', 'success')
        
        // 新建模式才发送通知
        if (!isEditMode) {
          this.sendNewOrderNotification(res.result.data._id)
        }
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showToast(res.result.message || (isEditMode ? '更新失败' : '创建失败'))
      }
    } catch (err) {
      util.hideLoading()
      this.setData({ submitting: false })
      console.error(isEditMode ? '更新订单失败:' : '创建订单失败:', err)
      if (err.message && err.message.includes('FunctionName')) {
        util.showToast('请先部署 order 云函数')
      } else {
        util.showToast((this.data.isEditMode ? '更新' : '创建') + '失败: ' + (err.message || ''))
      }
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
