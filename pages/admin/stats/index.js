const app = getApp();

Page({
  data: {
    currentRole: '',
    isAdmin: false,
    userInfo: null,
    craftsmanInfo: null,
    // 时间筛选
    dateRange: 'month', // week, month, quarter, year, all
    startDate: '',
    endDate: '',
    // 订单统计数据
    orderStats: {
      total: 0,
      pending: 0,
      accepted: 0,
      shipped: 0,
      completed: 0
    },
    // 金额统计
    revenue: {
      total: 0,
      avgOrderValue: 0,
      monthGrowth: 0
    },
    // 月度趋势
    monthlyTrend: [],
    // 状态分布（饼图数据）
    statusDistribution: [],
    // 排行数据
    craftsmanRanking: [],
    // 派单人排行
    dispatcherRanking: [],
    // 个人业绩（手艺人/派单人）
    personalStats: {
      totalOrders: 0,
      completedOrders: 0,
      inProgressOrders: 0,
      totalAmount: 0,
      completedAmount: 0,
      rating: 0,
      rank: 0
    },
    // 样式统计
    styleStats: [],
    // 加载状态
    loading: false,
    // 图表配置
    pieChartConfig: {
      canvasId: 'statusPieChart',
      type: 'pie',
      width: 300,
      height: 300,
      dataLabel: true,
      legend: true,
      background: '#ffffff',
      series: []
    },
    lineChartConfig: {
      canvasId: 'trendLineChart',
      type: 'line',
      width: 650,
      height: 300,
      dataLabel: true,
      legend: true,
      background: '#ffffff',
      categories: [],
      series: []
    }
  },

  onLoad() {
    this.initDateRange();
    this.loadUserInfo();
  },

  onShow() {
    this.loadStatistics();
  },

  onPullDownRefresh() {
    this.loadStatistics();
    wx.stopPullDownRefresh();
  },

  // 初始化日期范围
  initDateRange() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    
    this.setData({
      endDate: this.formatDate(end),
      startDate: this.formatDate(start)
    });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'login' }
      });

      if (res.result.code === 0) {
        const { currentRole, roles, isAdmin, rolesInfo } = res.result.data;
        
        this.setData({
          currentRole: currentRole || 'guest',
          isAdmin: isAdmin || false,
          userInfo: res.result.data,
          craftsmanInfo: rolesInfo?.craftsman || null
        });

        app.globalData.currentRole = currentRole;
        app.globalData.isAdmin = isAdmin;
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  },

  // 加载统计数据
  async loadStatistics() {
    this.setData({ loading: true });

    try {
      // 并行加载各类数据
      await Promise.all([
        this.loadOrderStats(),
        this.loadMonthlyTrend(),
        this.loadStatusDistribution(),
        this.loadRankingData(),
        this.loadPersonalStats(),
        this.loadStyleStats()
      ]);
    } catch (err) {
      console.error('加载统计数据失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载订单统计
  async loadOrderStats() {
    try {
      const { startDate, endDate } = this.data;
      
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getOrderStats',
          data: {
            startDate,
            endDate,
            role: this.data.currentRole
          }
        }
      });

      if (res.result.code === 0) {
        const stats = res.result.data;
        
        // 计算平均值和增长率
        const total = stats.totalCount || 0;
        const completed = stats.completedCount || 0;
        const avgOrderValue = completed > 0 ? (stats.totalAmount || 0) / completed : 0;
        const totalAmount = stats.totalAmount || 0;
        
        this.setData({
          orderStats: {
            total: total,
            pending: stats.pendingCount || 0,
            accepted: stats.acceptedCount || 0,
            shipped: stats.shippedCount || 0,
            completed: completed
          },
          revenue: {
            total: totalAmount,
            totalStr: totalAmount.toFixed(2),
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,
            avgOrderValueStr: avgOrderValue.toFixed(2),
            monthGrowth: stats.monthGrowth || 0
          }
        });
      }
    } catch (err) {
      console.error('加载订单统计失败:', err);
    }
  },

  // 加载月度趋势
  async loadMonthlyTrend() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getMonthlyTrend',
          data: {
            months: 6,
            role: this.data.currentRole
          }
        }
      });

      if (res.result.code === 0) {
        const trend = res.result.data || [];
        
        const categories = trend.map(item => item.month);
        const orderData = trend.map(item => item.orderCount || 0);
        const amountData = trend.map(item => (item.amount || 0) / 100); // 转换为百元单位

        this.setData({
          monthlyTrend: trend,
          lineChartConfig: {
            ...this.data.lineChartConfig,
            categories,
            series: [
              {
                name: '订单数',
                data: orderData,
                color: '#1890ff'
              },
              {
                name: '金额(百元)',
                data: amountData,
                color: '#52c41a'
              }
            ]
          }
        });
      }
    } catch (err) {
      console.error('加载月度趋势失败:', err);
    }
  },

  // 加载状态分布
  async loadStatusDistribution() {
    const { orderStats } = this.data;
    
    const distribution = [
      { name: '待接单', value: orderStats.pending, color: '#faad14' },
      { name: '进行中', value: orderStats.accepted, color: '#1890ff' },
      { name: '已发货', value: orderStats.shipped, color: '#722ed1' },
      { name: '已完成', value: orderStats.completed, color: '#52c41a' }
    ].filter(item => item.value > 0);

    this.setData({
      statusDistribution: distribution,
      pieChartConfig: {
        ...this.data.pieChartConfig,
        series: distribution.map(item => ({
          name: item.name,
          data: item.value,
          color: item.color
        }))
      }
    });
  },

  // 加载排行数据
  async loadRankingData() {
    if (!this.data.isAdmin && this.data.currentRole !== 'dispatcher') {
      return; // 只有管理员和派单人能看到排行
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getRanking',
          data: {
            type: 'craftsman',
            limit: 10
          }
        }
      });

      if (res.result.code === 0) {
        this.setData({
          craftsmanRanking: res.result.data || []
        });
      }
    } catch (err) {
      console.error('加载排行失败:', err);
    }
  },

  // 加载个人统计
  async loadPersonalStats() {
    if (this.data.isAdmin) return; // 管理员不需要个人统计

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getPersonalStats',
          data: {
            role: this.data.currentRole
          }
        }
      });

      if (res.result.code === 0) {
        const data = res.result.data;
        const totalAmount = data.totalAmount || 0;
        const completedAmount = data.completedAmount || 0;
        
        this.setData({
          personalStats: {
            ...data,
            totalAmount: totalAmount,
            totalAmountStr: totalAmount.toFixed(2),
            completedAmount: completedAmount,
            completedAmountStr: completedAmount.toFixed(2),
            pendingAmount: (totalAmount - completedAmount).toFixed(2)
          }
        });
      }
    } catch (err) {
      console.error('加载个人统计失败:', err);
    }
  },

  // 加载样式统计
  async loadStyleStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getStyleStats',
          data: {
            role: this.data.currentRole
          }
        }
      });

      if (res.result.code === 0) {
        this.setData({
          styleStats: res.result.data || []
        });
      }
    } catch (err) {
      console.error('加载样式统计失败:', err);
    }
  },

  // 切换日期范围
  onDateRangeChange(e) {
    const range = e.currentTarget.dataset.range;
    const end = new Date();
    const start = new Date();

    switch (range) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
    }

    this.setData({
      dateRange: range,
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    });

    this.loadStatistics();
  },

  // 日期选择器变化
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value,
      dateRange: 'custom'
    });
    this.loadStatistics();
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      dateRange: 'custom'
    });
    this.loadStatistics();
  },

  // 刷新数据
  onRefresh() {
    this.loadStatistics();
    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  // 导出数据
  onExport() {
    wx.showModal({
      title: '导出数据',
      content: '确定要导出统计数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '导出功能开发中', icon: 'none' });
        }
      }
    });
  },

  // 跳转到订单详情
  goToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/craftsman/orderDetail?id=${orderId}`
    });
  },

  // 跳转到手艺人详情
  goToCraftsmanDetail(e) {
    const craftsmanId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/userDetail?id=${craftsmanId}&type=craftsman`
    });
  }
});
