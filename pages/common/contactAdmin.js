Page({
  data: {
    phone: '13810062394',
    wechatId: '13810062394'
  },

  onLoad() {
    // 页面加载
  },

  // 拨打电话
  callPhone() {
    const { phone } = this.data
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => {
        console.log('拨打电话成功')
      },
      fail: (err) => {
        console.error('拨打电话失败:', err)
        wx.showToast({
          title: '拨打失败',
          icon: 'none'
        })
      }
    })
  },

  // 复制微信号
  copyWechat() {
    const { wechatId } = this.data
    wx.setClipboardData({
      data: wechatId,
      success: () => {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  }
})
