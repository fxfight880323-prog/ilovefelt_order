const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    orderId: '',
    orderInfo: null,
    from: '', // 来源：admin或craftsman
    loading: false,
    isAdmin: false,
    craftsmanInfo: null,
    // 付款相关权限
    canConfirmPayment: false,
    canConfirmReceipt: false,
    // 运单号相关
    showTrackingInput: false,
    trackingNumber: '',
    trackingCompany: '顺丰速运',
    trackingCompanies: ['顺丰速运', '中通快递', '圆通速递', '申通快递', '韵达快递', 'EMS', '京东物流', '其他快递'],
    companyIndex: 0,
    // 完成订单照片相关
    showCompleteSection: false,
    completePhotos: [],
    // 调试模式（已关闭）
    showDebugInfo: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.id,
      from: options.from || '',
      isAdmin: app.globalData.isAdmin
    })
    
    // 确保手艺人信息已加载
    if (app.globalData.craftsmanInfo) {
      this.setData({
        craftsmanInfo: app.globalData.craftsmanInfo
      })
      this.getOrderDetail()
    } else {
      // 如果没有缓存，先获取手艺人信息
      this.loadCraftsmanInfo()
    }
  },

  // 加载手艺人信息
  async loadCraftsmanInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'checkUserRole' }
      })
      
      if (res.result.code === 0 && res.result.data.craftsmanInfo) {
        const craftsmanInfo = res.result.data.craftsmanInfo
        this.setData({ craftsmanInfo })
        app.globalData.craftsmanInfo = craftsmanInfo
      }
      
      // 无论是否获取到信息，都继续加载订单详情
      // 因为待接单订单不需要手艺人信息
      this.getOrderDetail()
    } catch (err) {
      console.error('获取手艺人信息失败:', err)
      // 即使失败也尝试加载订单详情
      this.getOrderDetail()
    }
  },

  // 获取订单详情
  async getOrderDetail() {
    if (!this.data.orderId) return

    this.setData({ loading: true })
    try {
      console.log('获取订单详情:', this.data.orderId)
      
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId: this.data.orderId
        }
      })

      console.log('订单详情结果:', res.result)

      if (res.result.code === 0) {
        const order = res.result.data
        
        // 检查权限：待接单订单任何人可看，已接订单只有接单人可看
        const craftsmanInfo = this.data.craftsmanInfo
        console.log('权限检查:', {
          craftsmanInfo: craftsmanInfo ? craftsmanInfo._id : null,
          orderCraftsmanId: order.craftsmanId,
          orderStatus: order.status
        })
        
        // 如果订单已被接（有craftsmanId），且当前用户不是接单人，则无权查看
        if (order.craftsmanId && craftsmanInfo && order.craftsmanId !== craftsmanInfo._id) {
          util.showToast('无权查看此订单')
          wx.navigateBack()
          return
        }
        
        // 判断付款相关权限（使用已获取的 craftsmanInfo 变量，避免时序问题）
        const canConfirmPayment = this.checkCanConfirmPayment(order)
        const canConfirmReceipt = this.checkCanConfirmReceipt(order, craftsmanInfo)
        
        console.log('权限判断结果:', {
          canConfirmPayment,
          canConfirmReceipt,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
          craftsmanInfo: craftsmanInfo ? { id: craftsmanInfo._id, name: craftsmanInfo.name } : null
        })
        
        // 转换完成照片 fileID 为临时 URL
        let completePhotoUrls = []
        if (order.completePhotos && order.completePhotos.length > 0) {
          try {
            const tempRes = await wx.cloud.getTempFileURL({
              fileList: order.completePhotos
            })
            completePhotoUrls = tempRes.fileList.map(item => item.tempFileURL || item.fileID)
          } catch (err) {
            console.error('获取图片临时链接失败:', err)
            completePhotoUrls = order.completePhotos
          }
        }
        
        this.setData({
          orderInfo: {
            ...order,
            totalPrice: (order.quantity || 1) * (order.price || 0),
            dispatchDate: util.formatDate(order.dispatchDate),
            receiveDate: util.formatDate(order.receiveDate),
            acceptDate: order.acceptDate ? util.formatDate(order.acceptDate, 'YYYY-MM-DD HH:mm') : '',
            shipDate: order.shipDate ? util.formatDate(order.shipDate, 'YYYY-MM-DD HH:mm') : '',
            completeDate: order.completeDate ? util.formatDate(order.completeDate, 'YYYY-MM-DD HH:mm') : '',
            paymentConfirmedAt: order.paymentConfirmedAt ? util.formatDate(order.paymentConfirmedAt, 'YYYY-MM-DD HH:mm') : '',
            receiptConfirmedAt: order.receiptConfirmedAt ? util.formatDate(order.receiptConfirmedAt, 'YYYY-MM-DD HH:mm') : '',
            createTime: util.formatDate(order.createTime, 'YYYY-MM-DD HH:mm'),
            completePhotoUrls: completePhotoUrls
          },
          canConfirmPayment: canConfirmPayment,
          canConfirmReceipt: canConfirmReceipt,
          loading: false
        })
      } else {
        console.error('获取订单详情失败:', res.result.message)
        util.showToast(res.result.message || '获取订单详情失败')
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('获取订单详情失败:', err)
      this.setData({ loading: false })
      util.showToast('获取订单详情失败')
    }
  },
  
  // 检查是否可以确认付款（派单人或管理员）
  checkCanConfirmPayment(order) {
    // 只有已完成的订单可以确认付款
    if (order.status !== 'completed') return false
    // 只有未付款的订单可以确认付款
    if (order.paymentStatus !== 'unpaid') return false
    
    // 派单人或管理员可以确认付款
    // 这里需要知道当前用户的角色，简化处理，由云函数判断权限
    return true
  },
  
  // 检查是否可以确认收款（手艺人）- 新流程：已发货订单可以确认收款
  checkCanConfirmReceipt(order, craftsmanInfo) {
    // 新流程：已发货的订单可以确认收款
    if (order.status !== 'shipped') return false
    // 只有接单人才可以确认收款
    const craftsman = craftsmanInfo || this.data.craftsmanInfo
    console.log('确认收款权限检查:', {
      orderStatus: order.status,
      craftsmanInfoId: craftsman ? craftsman._id : null,
      orderCraftsmanId: order.craftsmanId,
      isMatch: craftsman ? order.craftsmanId === craftsman._id : false
    })
    if (!craftsman) return false
    return order.craftsmanId === craftsman._id
  },

  // 接单
  async acceptOrder() {
    const craftsmanInfo = this.data.craftsmanInfo
    if (!craftsmanInfo) {
      util.showToast('您还未注册成为手工艺人')
      return
    }

    const confirmed = await util.showConfirm('确认接单', '确定要接这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'accept',
          orderId: this.data.orderId,
          craftsmanId: craftsmanInfo._id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('接单成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '接单失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('接单失败:', err)
      util.showToast('接单失败')
    }
  },

  // 显示运单号输入框
  showTrackingInput() {
    this.setData({
      showTrackingInput: true
    })
  },

  // 隐藏运单号输入框
  hideTrackingInput() {
    this.setData({
      showTrackingInput: false,
      trackingNumber: ''
    })
  },

  // 选择物流公司
  onCompanyChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      companyIndex: index,
      trackingCompany: this.data.trackingCompanies[index]
    })
  },

  // 输入运单号
  onTrackingInput(e) {
    this.setData({
      trackingNumber: e.detail.value
    })
  },

  // 提交运单号
  async submitTracking() {
    const { trackingNumber, trackingCompany, craftsmanInfo, orderId, orderInfo } = this.data
    
    if (!trackingNumber || !trackingNumber.trim()) {
      util.showToast('请输入运单号')
      return
    }

    const confirmed = await util.showConfirm('确认提交', '提交后订单状态将变更为已发货，确定要提交吗？')
    if (!confirmed) return

    util.showLoading('提交中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'addTracking',
          orderId: orderId,
          trackingNumber: trackingNumber.trim(),
          trackingCompany: trackingCompany,
          craftsmanId: craftsmanInfo._id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('运单号提交成功', 'success')
        
        // 发送通知给管理员
        this.notifyAdmin(orderInfo.name, trackingNumber, trackingCompany)
        
        this.setData({
          showTrackingInput: false,
          trackingNumber: ''
        })
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '提交失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('提交运单号失败:', err)
      util.showToast('提交失败')
    }
  },

  // 通知管理员运单信息
  async notifyAdmin(orderName, trackingNumber, trackingCompany) {
    try {
      await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'notifyAdmin',
          type: 'tracking_added',
          orderName,
          trackingNumber,
          trackingCompany,
          craftsmanName: this.data.craftsmanInfo.name
        }
      })
    } catch (err) {
      console.error('通知管理员失败:', err)
    }
  },

  // 通知管理员订单完成
  async notifyAdminComplete(orderName) {
    try {
      await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'notifyAdmin',
          type: 'order_completed',
          orderName,
          craftsmanName: this.data.craftsmanInfo.name
        }
      })
    } catch (err) {
      console.error('通知管理员失败:', err)
    }
  },

  // 复制运单号
  copyTrackingNumber() {
    const trackingNumber = this.data.orderInfo.trackingNumber
    wx.setClipboardData({
      data: trackingNumber,
      success: () => {
        util.showToast('已复制运单号', 'success')
      }
    })
  },

  // 显示完成订单区域
  showCompleteSection() {
    this.setData({
      showCompleteSection: true
    })
  },

  // 隐藏完成订单区域
  hideCompleteSection() {
    this.setData({
      showCompleteSection: false,
      completePhotos: []
    })
  },

  // 选择照片
  async choosePhoto() {
    if (this.data.completePhotos.length >= 3) {
      util.showToast('最多只能上传3张照片')
      return
    }

    try {
      const res = await wx.chooseMedia({
        count: 3 - this.data.completePhotos.length,
        mediaType: ['image'],
        sourceType: ['camera', 'album']
      })

      util.showLoading('上传中...')
      
      const uploadTasks = res.tempFiles.map(async (file, index) => {
        const cloudPath = `order-complete/${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}.jpg`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath
        })
        return uploadRes.fileID
      })

      const fileIDs = await Promise.all(uploadTasks)
      
      this.setData({
        completePhotos: [...this.data.completePhotos, ...fileIDs]
      })
      
      util.hideLoading()
      util.showToast('上传成功', 'success')
    } catch (err) {
      util.hideLoading()
      console.error('上传照片失败:', err)
      util.showToast('上传失败')
    }
  },

  // 删除照片
  deletePhoto(e) {
    const index = e.currentTarget.dataset.index
    const photos = this.data.completePhotos
    photos.splice(index, 1)
    this.setData({
      completePhotos: photos
    })
  },

  // 预览照片
  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      urls: this.data.orderInfo.completePhotoUrls || [url],
      current: url
    })
  },

  // 撤回订单（已完成→进行中）
  async revertOrder() {
    const confirmed = await util.showConfirm('确认撤回', '确定要将该订单撤回到进行中状态吗？')
    if (!confirmed) return

    util.showLoading('撤回中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'revert',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('撤回成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '撤回失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('撤回订单失败:', err)
      util.showToast('撤回失败')
    }
  },

  // 提交完成订单
  async submitComplete() {
    const { completePhotos, orderId } = this.data
    
    if (completePhotos.length === 0) {
      util.showToast('请至少上传一张照片')
      return
    }

    const confirmed = await util.showConfirm('确认完成', '确定要完成这个订单吗？提交后不可更改。')
    if (!confirmed) return

    util.showLoading('提交中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'complete',
          orderId: orderId,
          completePhotos: completePhotos
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        // 显示时间履约分提示
        const timeScoreResult = res.result.data && res.result.data.timeScoreResult
        if (timeScoreResult && timeScoreResult.timeScore) {
          let content = `本次时间履约分：${timeScoreResult.timeScore.toFixed(1)}分\n`
          if (timeScoreResult.message) {
            content += timeScoreResult.message
          } else if (timeScoreResult.score) {
            content += `您的综合履约分已更新为：${timeScoreResult.score.toFixed(1)}分（${timeScoreResult.level}）`
          }
          
          wx.showModal({
            title: '订单已完成',
            content: content,
            showCancel: false,
            success: () => {
              this.getOrderDetail()
            }
          })
        } else {
          util.showToast('订单已完成', 'success')
          this.getOrderDetail()
        }
        
        // 发送通知给管理员
        this.notifyAdminComplete(this.data.orderInfo.name)
        
        this.setData({
          showCompleteSection: false,
          completePhotos: []
        })
      } else {
        util.showToast(res.result.message || '提交失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('完成订单失败:', err)
      util.showToast('提交失败')
    }
  },

  // 取消订单
  async cancelOrder() {
    const confirmed = await util.showConfirm('确认取消', '确定要取消这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'cancel',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('已取消', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '取消失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('取消订单失败:', err)
      util.showToast('取消失败')
    }
  },

  // 确认付款（派单人/管理员）
  async confirmPayment() {
    const confirmed = await util.showConfirm('确认付款', '确定已向对方付款吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmPayment',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        wx.showModal({
          title: '付款确认成功',
          content: '已通知手艺人确认收款',
          showCancel: false,
          success: () => {
            this.getOrderDetail()
          }
        })
      } else {
        util.showToast(res.result.message || '确认付款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('确认付款失败:', err)
      util.showToast('确认付款失败')
    }
  },

  // 确认收款（手艺人）
  async confirmReceipt() {
    const confirmed = await util.showConfirm('确认收款', '确定已收到款项吗？确认后订单将结束。')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmReceipt',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        wx.showModal({
          title: '收款确认成功',
          content: '订单已正式结束',
          showCancel: false,
          success: () => {
            this.getOrderDetail()
          }
        })
      } else {
        util.showToast(res.result.message || '确认收款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('确认收款失败:', err)
      util.showToast('确认收款失败')
    }
  },

  // ============ 测试功能（开发调试用） ============
  
  // 切换调试信息显示
  toggleDebugInfo() {
    this.setData({
      showDebugInfo: !this.data.showDebugInfo
    })
  },

  // 测试：模拟派单人确认付款（用于测试确认收款流程）
  async testConfirmPayment() {
    const confirmed = await util.showConfirm('测试功能', '确定要模拟派单人确认付款吗？\n这将把 paymentStatus 改为 pending_receipt')
    if (!confirmed) return

    util.showLoading('测试中...')
    try {
      // 通过云函数修改，避免权限问题
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'testConfirmPayment',
          orderId: this.data.orderId
        }
      })
      
      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('模拟付款成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '模拟付款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('模拟付款失败:', err)
      util.showToast('模拟付款失败: ' + err.message)
    }
  },

  // 测试：直接确认收款（无需派单人确认付款）
  async testConfirmReceipt() {
    const confirmed = await util.showConfirm('测试功能', '确定要直接确认收款吗？\n这将跳过派单人确认付款步骤，直接结束订单。')
    if (!confirmed) return

    util.showLoading('测试中...')
    try {
      // 通过云函数修改，避免权限问题
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'testConfirmReceipt',
          orderId: this.data.orderId
        }
      })
      
      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('测试收款成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '测试收款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('测试收款失败:', err)
      util.showToast('测试收款失败: ' + err.message)
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
})
