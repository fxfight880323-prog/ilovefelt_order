const subscribeConfig = require('../../config/subscribe.js')
const app = getApp()

Page({
  data: {
    userRole: 'guest',
    roleInfo: null,
    stats: {
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalIncome: 0,
      reliabilityScore: '5.0',
      reliabilityLevel: '优秀',
      reliabilityColor: '#52c41a',
      ratedOrders: 0,
      avgTimeScore: '5.0',
      avgRatingScore: '5.0'
    },
    reliabilityInfo: {
      showDetail: false,
      score: 5.0,
      level: '优秀',
      color: '#52c41a',
      nextLevel: null,
      progress: 0,
      avgTimeScore: 5.0,
      avgRatingScore: 5.0
    },
    loading: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
    
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3
      })
    }
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  // 加载数据
  async loadData() {
    try {
      // 获取用户角色信息
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'login' }
      })

      if (res.result.code === 0) {
        const { role, rolesInfo, currentRole } = res.result.data
        const activeRole = currentRole || role
        let roleInfo = rolesInfo ? rolesInfo[activeRole] : null
        
        // 如果有头像 fileID，转换为临时 URL
        if (roleInfo && roleInfo.avatarUrl) {
          roleInfo = await this.refreshAvatarUrl(roleInfo)
        }
        
        this.setData({
          userRole: activeRole,
          roleInfo: roleInfo
        })
        
        app.globalData.userRole = activeRole
        app.globalData.roleInfo = roleInfo

        // 获取统计数据
        if (roleInfo) {
          if (activeRole === 'craftsman') {
            this.getStats()
          } else if (activeRole === 'dispatcher') {
            this.getDispatcherStats()
          }
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  },

  // 刷新头像临时链接
  async refreshAvatarUrl(roleInfo) {
    if (!roleInfo || !roleInfo.avatarUrl) return roleInfo
    
    const avatarUrl = roleInfo.avatarUrl
    let fileID = null
    
    // 如果是 fileID，直接使用
    if (avatarUrl.startsWith('cloud://')) {
      fileID = avatarUrl
    } else if (avatarUrl.includes('tcb.qcloud.la')) {
      // 如果是临时链接（可能已过期），需要从数据库获取 fileID
      // 这里直接返回，等待图片加载失败时重新获取
      return roleInfo
    } else {
      // 其他类型链接（如网络图片），不需要处理
      return roleInfo
    }
    
    try {
      const tempRes = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      })
      return {
        ...roleInfo,
        avatarUrl: tempRes.fileList[0].tempFileURL || fileID
      }
    } catch (err) {
      console.error('获取头像临时链接失败:', err)
      return roleInfo
    }
  },

  // 头像加载失败时重新获取
  async onAvatarError() {
    console.log('头像加载失败，尝试重新获取')
    const roleInfo = this.data.roleInfo
    if (roleInfo && roleInfo.avatarUrl) {
      // 标记需要刷新，下次加载时会重新获取
      this.setData({
        'roleInfo.avatarUrl': ''
      })
      // 重新加载数据获取新的临时链接
      this.loadData()
    }
  },

  // 上传头像
  async uploadAvatar() {
    try {
      // 使用 wx.chooseMedia 替代已废弃的 wx.chooseImage
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      const tempFilePath = res.tempFiles[0].tempFilePath
      
      wx.showLoading({ title: '上传中...' })
      
      // 上传到云存储
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`
      
      console.log('开始上传图片:', tempFilePath, '->', cloudPath)
      
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })
      
      console.log('云存储上传结果:', uploadRes)
      
      if (!uploadRes.fileID) {
        wx.hideLoading()
        wx.showToast({ title: '上传失败：未获取文件ID', icon: 'none' })
        return
      }
      
      const fileID = uploadRes.fileID
      
      // 获取临时 URL 用于显示
      const tempUrlRes = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      })
      
      const avatarUrl = tempUrlRes.fileList[0].tempFileURL || fileID
      
      // 更新数据库
      console.log('更新数据库:', { fileID, avatarUrl, role: this.data.userRole })
      
      const updateRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateAvatar',
          data: {
            avatarUrl: fileID,  // 存储 fileID 到数据库
            role: this.data.userRole
          }
        }
      })
      
      console.log('数据库更新结果:', updateRes)
      wx.hideLoading()
      
      if (updateRes.result && updateRes.result.code === 0) {
        // 更新本地数据（使用临时 URL 显示）
        const roleInfo = { ...this.data.roleInfo, avatarUrl: avatarUrl }
        this.setData({ roleInfo })
        
        // 更新全局数据
        app.globalData.roleInfo = roleInfo
        
        wx.showToast({ title: '上传成功', icon: 'success' })
      } else {
        wx.showToast({ 
          title: (updateRes.result && updateRes.result.message) || '更新失败', 
          icon: 'none' 
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('上传头像失败:', err)
      
      // 用户取消选择时不显示错误
      if (err.errMsg && (err.errMsg.includes('cancel') || err.errMsg.includes('fail cancel'))) {
        return
      }
      
      wx.showToast({ title: '上传失败：' + (err.message || err.errMsg || '未知错误'), icon: 'none' })
    }
  },

  // 跳转到我的订单页面，带状态筛选
  goToMyOrders(e) {
    const status = e.currentTarget.dataset.status
    console.log('跳转到我的订单，状态:', status)
    
    // 先设置全局参数，再跳转
    app.globalData.myOrdersFilter = status
    
    // 跳转到 tabBar 页面
    wx.switchTab({
      url: '/pages/craftsman/myOrders'
    })
  },

  // 获取统计数据（手艺人）
  async getStats() {
    if (!this.data.roleInfo || this.data.userRole !== 'craftsman') return
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: {
          action: 'getStats',
          craftsmanId: this.data.roleInfo._id
        }
      })

      if (res.result.code === 0) {
        this.setData({
          stats: res.result.data
        })
        
        // 计算履约分进度和下一等级
        this.calculateReliabilityProgress(res.result.data.reliabilityScore)
      }
    } catch (err) {
      console.error('获取统计数据失败:', err)
    }
  },
  
  // 计算履约分进度
  calculateReliabilityProgress(score) {
    score = parseFloat(score) || 5.0
    let progress = 0
    let nextLevel = null
    
    // 计算进度条（满分6分）
    progress = (score / 6) * 100
    
    // 计算下一等级
    if (score >= 6.0) {
      nextLevel = null // 已满级
    } else if (score >= 4.0) {
      nextLevel = { target: 6.0, label: '满分' }
    } else if (score >= 2.0) {
      nextLevel = { target: 4.0, label: '优秀' }
    } else if (score >= 0.4) {
      nextLevel = { target: 2.0, label: '中等' }
    } else {
      nextLevel = { target: 0.4, label: '警告' }
    }
    
    this.setData({
      reliabilityInfo: {
        ...this.data.reliabilityInfo,
        score: score,
        level: this.data.stats.reliabilityLevel,
        color: this.data.stats.reliabilityColor,
        nextLevel: nextLevel,
        progress: Math.min(progress, 100),
        avgTimeScore: parseFloat(this.data.stats.avgTimeScore || 5.0),
        avgRatingScore: parseFloat(this.data.stats.avgRatingScore || 5.0)
      }
    })
  },
  
  // 显示/隐藏履约分详情
  toggleReliabilityDetail() {
    this.setData({
      'reliabilityInfo.showDetail': !this.data.reliabilityInfo.showDetail
    })
  },
  
  // 显示履约分规则说明
  showReliabilityRules() {
    const stats = this.data.stats
    const content = `综合履约分：${stats.reliabilityScore || '5.0'}分（${stats.reliabilityLevel || '优秀'}）

计算方式：
• 时间履约分 × 50% + 派单评分 × 50%

您的明细：
• 平均时间履约分：${stats.avgTimeScore || '5.0'}分
• 平均派单评分：${stats.avgRatingScore || '5.0'}分
• 已评价订单数：${stats.ratedOrders || 0}单

时间履约分计算：
• 按时或提前完成：5分
• 延迟1天内：4.5分
• 延迟2天内：4分
• 延迟3天内：3.5分
• 延迟5天内：3分
• 延迟7天内：2.5分
• 延迟10天内：2分
• 延迟15天内：1.5分
• 延迟超过15天：1分

等级划分：
• 优秀：4分及以上
• 中等：2分至4分
• 警告：0.4分至2分
• 危险：0.4分及以下`

    wx.showModal({
      title: '履约分规则',
      content: content,
      showCancel: false
    })
  },

  // 获取统计数据（派单人）
  async getDispatcherStats() {
    if (!this.data.roleInfo || this.data.userRole !== 'dispatcher') return
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getOrderStats'
        }
      })

      if (res.result.code === 0) {
        this.setData({
          stats: res.result.data
        })
      }
    } catch (err) {
      console.error('获取派单人统计失败:', err)
    }
  },

  // 更新订阅设置
  async updateSubscribe() {
    const tmplIds = [
      subscribeConfig.NEW_ORDER,
      subscribeConfig.ORDER_STATUS_CHANGE
    ].filter(id => id && id.trim() !== '')
    
    if (tmplIds.length === 0) {
      wx.showToast({ title: '订阅功能暂未配置', icon: 'none' })
      return
    }

    try {
      const res = await wx.requestSubscribeMessage({
        tmplIds: tmplIds
      })
      
      // 保存订阅记录到数据库
      const acceptIds = tmplIds.filter(id => res[id] === 'accept')
      if (acceptIds.length > 0) {
        await wx.cloud.callFunction({
          name: 'subscribe',
          data: {
            action: 'saveSubscribe',
            tmplIds: acceptIds
          }
        })
        wx.showToast({ title: '订阅成功', icon: 'success' })
      }
    } catch (err) {
      console.error('订阅失败:', err)
    }
  },

  // 联系管理员
  contactAdmin() {
    wx.navigateTo({
      url: '/pages/common/contactAdmin'
    })
  },

  // 旧联系管理员函数保留备用
  contactAdminOld() {
    wx.showModal({
      title: '联系管理员',
      content: '管理员电话：13810062394\n微信号同手机号',
      confirmText: '复制电话',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: 'craft_admin',
            success: () => {
              wx.showToast({ title: '已复制', icon: 'success' })
            }
          })
        }
      }
    })
  },

  // 查看使用帮助
  viewHelp() {
    const helpContent = this.data.userRole === 'craftsman' 
      ? '1. 在"接单大厅"浏览可接订单\n2. 点击"立即接单"抢单\n3. 在"我的订单"查看已接订单\n4. 制作完成后点击"完成订单"\n\n如有问题请联系管理员'
      : '1. 在"首页"点击"发布订单"\n2. 填写订单详情并提交\n3. 等待手艺人接单\n4. 在"订单管理"查看进度\n\n如有问题请联系管理员'
    
    wx.showModal({
      title: '使用帮助',
      content: helpContent,
      showCancel: false
    })
  },

  // 编辑个人信息
  editProfile() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 切换角色
  switchRole() {
    wx.showActionSheet({
      itemList: ['切换为手艺人', '切换为派单人', '退出登录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doSwitchRole('craftsman')
        } else if (res.tapIndex === 1) {
          this.doSwitchRole('dispatcher')
        } else if (res.tapIndex === 2) {
          this.logout()
        }
      }
    })
  },

  // 执行角色切换
  async doSwitchRole(role) {
    try {
      wx.showLoading({ title: '切换中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'switchRole',
          data: { role }
        }
      })
      
      if (res.result.code === 0) {
        // 获取新角色的完整信息
        const userRes = await wx.cloud.callFunction({
          name: 'user',
          data: { action: 'getUserInfo' }
        })
        
        wx.hideLoading()
        
        if (userRes.result.code === 0) {
          const { rolesInfo, roles } = userRes.result.data
          const newRoleInfo = rolesInfo ? rolesInfo[role] : null
          
          // 完全更新全局数据 - 角色隔离
          app.globalData.userRole = role
          app.globalData.roleInfo = newRoleInfo
          app.globalData.isAdmin = roles.includes('admin')
          
          // 更新本地缓存
          wx.setStorageSync('userRole', role)
          wx.setStorageSync('userInfo', newRoleInfo || {})
          
          wx.showToast({ title: '切换成功', icon: 'success' })
          
          // 根据角色跳转到对应首页
          setTimeout(() => {
            if (role === 'craftsman') {
              wx.switchTab({ url: '/pages/craftsman/orderList' })
            } else if (role === 'dispatcher') {
              wx.switchTab({ url: '/pages/common/index' })
            } else if (role === 'admin') {
              wx.navigateTo({ url: '/pages/admin/console' })
            }
          }, 1000)
        }
      } else {
        wx.hideLoading()
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('切换角色失败:', err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userRole = 'guest'
          app.globalData.roleInfo = null
          // 清除缓存并设置退出标记，防止自动登录
          wx.removeStorageSync('userRole')
          wx.removeStorageSync('userInfo')
          wx.setStorageSync('logoutFlag', true)
          wx.reLaunch({
            url: '/pages/login/index'
          })
        }
      }
    })
  }
})
