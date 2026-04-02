const app = getApp()

Page({
  data: {
    isAdmin: false,
    currentRole: 'admin',
    subtitle: '全局数据概览',
    
    // 统计数据
    statsCards: [],
    
    // 图表数据
    chartTypes: ['订单数量', '订单金额'],
    chartTypeIndex: 0,
    chartData: [],
    
    // 排行榜
    craftsmanRank: [],
    
    // 我的评分（手艺人）
    myRating: null
  },

  onLoad() {
    const { isAdmin, userRole } = app.globalData
    this.setData({ 
      isAdmin,
      currentRole: isAdmin ? 'admin' : userRole
    })
    
    this.updateSubtitle()
    this.loadData()
  },

  // 更新副标题
  updateSubtitle() {
    const { currentRole } = this.data
    const subtitles = {
      admin: '全局数据概览',
      dispatcher: '我的派单统计',
      craftsman: '我的接单统计'
    }
    this.setData({ subtitle: subtitles[currentRole] })
  },

  // 切换角色（管理员）
  switchRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ currentRole: role })
    this.updateSubtitle()
    this.loadData()
  },

  // 加载数据
  async loadData() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      await Promise.all([
        this.loadStats(),
        this.loadChartData(),
        this.loadRankData()
      ])
    } catch (err) {
      console.error('加载数据失败:', err)
    }
    
    wx.hideLoading()
  },

  // 加载统计数据
  async loadStats() {
    const { currentRole } = this.data
    
    try {
      let res
      
      if (currentRole === 'craftsman') {
        // 手艺人统计
        res = await wx.cloud.callFunction({
          name: 'order',
          data: { action: 'getCraftsmanStats' }
        })
        
        if (res.result.code === 0) {
          const data = res.result.data
          this.setData({
            statsCards: [
              { key: 'accepted', label: '进行中', value: data.accepted, icon: '🔄', color: '#1890ff' },
              { key: 'shipped', label: '已发货', value: data.shipped, icon: '🚚', color: '#722ed1' },
              { key: 'completed', label: '已完成', value: data.completed, icon: '✅', color: '#52c41a' },
              { key: 'rating', label: '平均评分', value: data.avgRating, icon: '⭐', color: '#faad14' }
            ]
          })
          
          // 加载评分详情
          this.loadMyRating()
        }
      } else if (currentRole === 'dispatcher') {
        // 派单人统计
        res = await wx.cloud.callFunction({
          name: 'order',
          data: { action: 'getDispatcherStats' }
        })
        
        if (res.result.code === 0) {
          const data = res.result.data
          this.setData({
            statsCards: [
              { key: 'pending', label: '待接单', value: data.pending, icon: '⏳', color: '#faad14' },
              { key: 'accepted', label: '进行中', value: data.accepted, icon: '🔄', color: '#1890ff' },
              { key: 'completed', label: '已完成', value: data.completed, icon: '✅', color: '#52c41a' },
              { key: 'monthAmount', label: '本月金额', value: `¥${data.monthAmount}`, icon: '💰', color: '#f5222d' }
            ]
          })
        }
      } else {
        // 管理员全局统计
        res = await wx.cloud.callFunction({
          name: 'order',
          data: { action: 'getOrderStats' }
        })
        
        if (res.result.code === 0) {
          const data = res.result.data
          this.setData({
            statsCards: [
              { key: 'pending', label: '待接单', value: data.pending, icon: '⏳', color: '#faad14' },
              { key: 'accepted', label: '进行中', value: data.accepted + data.shipped, icon: '🔄', color: '#1890ff' },
              { key: 'completed', label: '已完成', value: data.completed, icon: '✅', color: '#52c41a' },
              { key: 'total', label: '总订单', value: data.total, icon: '📊', color: '#722ed1' }
            ]
          })
        }
      }
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
  },

  // 加载图表数据
  async loadChartData() {
    const { currentRole } = this.data
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getChartData',
          role: currentRole
        }
      })
      
      if (res.result.code === 0) {
        this.setData({
          chartData: res.result.data
        })
        this.drawChart()
      }
    } catch (err) {
      console.error('加载图表数据失败:', err)
    }
  },

  // 绘制图表
  drawChart() {
    const { chartData } = this.data
    if (!chartData || chartData.length === 0) return
    
    // 使用 canvas 绘制简单折线图
    const query = wx.createSelectorQuery()
    query.select('#trendChart').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return
      
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const width = res[0].width
      const height = res[0].height
      
      // 设置canvas尺寸
      canvas.width = width * wx.getSystemInfoSync().pixelRatio
      canvas.height = height * wx.getSystemInfoSync().pixelRatio
      ctx.scale(wx.getSystemInfoSync().pixelRatio, wx.getSystemInfoSync().pixelRatio)
      
      // 清空画布
      ctx.clearRect(0, 0, width, height)
      
      // 找出最大值
      const maxValue = Math.max(...chartData.map(item => item.count)) || 1
      
      // 绘制折线
      const padding = 40
      const chartWidth = width - padding * 2
      const chartHeight = height - padding * 2
      const stepX = chartWidth / (chartData.length - 1)
      
      // 绘制网格线
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1
      for (let i = 0; i <= 5; i++) {
        const y = padding + chartHeight * i / 5
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(width - padding, y)
        ctx.stroke()
      }
      
      // 绘制折线
      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      
      chartData.forEach((item, index) => {
        const x = padding + stepX * index
        const y = padding + chartHeight * (1 - item.count / maxValue)
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        
        // 绘制数据点
        ctx.fillStyle = '#1890ff'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      })
      
      ctx.stroke()
      
      // 绘制日期标签（只显示部分）
      ctx.fillStyle = '#999'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      
      chartData.forEach((item, index) => {
        if (index % 5 === 0 || index === chartData.length - 1) {
          const x = padding + stepX * index
          ctx.fillText(item.date, x, height - 10)
        }
      })
    })
  },

  // 图表类型切换
  onChartTypeChange(e) {
    this.setData({
      chartTypeIndex: e.detail.value
    })
    this.loadChartData()
  },

  // 加载排行榜数据
  async loadRankData() {
    const { currentRole } = this.data
    
    if (currentRole === 'craftsman') return
    
    try {
      // 调用 order 云函数获取排行榜（按完成金额和评价排序）
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: { 
          action: 'getRanking',
          type: 'craftsman',
          limit: 10
        }
      })
      
      if (res.result.code === 0) {
        this.setData({
          craftsmanRank: res.result.data || []
        })
      }
    } catch (err) {
      console.error('加载排行榜失败:', err)
    }
  },

  // 加载我的评分
  async loadMyRating() {
    try {
      const craftsmanRes = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'checkUserRole' }
      })
      
      if (craftsmanRes.result.code === 0 && craftsmanRes.result.data.craftsmanInfo) {
        const craftsmanId = craftsmanRes.result.data.craftsmanInfo._id
        
        const res = await wx.cloud.callFunction({
          name: 'order',
          data: {
            action: 'getCraftsmanRating',
            craftsmanId
          }
        })
        
        if (res.result.code === 0) {
          this.setData({
            myRating: res.result.data
          })
        }
      }
    } catch (err) {
      console.error('加载评分失败:', err)
    }
  }
})
