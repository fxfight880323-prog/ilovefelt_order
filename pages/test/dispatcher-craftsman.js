/**
 * 派单人和手艺人测试页面（含注册）
 */
const TestDispatcherCraftsman = require('../../test/test-dispatcher-craftsman.js')

Page({
  data: {
    isRunning: false,
    results: [],
    summary: null,
    logs: [],
    config: {
      dispatcher: { phone: '13800138001', password: '123456' },
      craftsman: { phone: '13800138002', password: '123456' },
      superAdmin: { phone: '13810062394', password: '880323' }
    }
  },

  onLoad() {
    console.log('测试页面加载')
  },

  // 运行测试
  async runTest() {
    if (this.data.isRunning) {
      wx.showToast({ title: '测试正在运行', icon: 'none' })
      return
    }

    this.setData({ 
      isRunning: true, 
      results: [],
      logs: [],
      summary: null
    })

    try {
      // 重写 console.log 捕获日志
      const originalLog = console.log
      const logs = []
      console.log = (...args) => {
        originalLog(...args)
        const logText = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
        logs.push(logText)
        this.setData({ logs: [...logs] })
      }

      const results = await TestDispatcherCraftsman.run()
      
      // 恢复 console.log
      console.log = originalLog

      const passed = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      
      this.setData({
        results: results,
        summary: { passed, failed, total: results.length },
        isRunning: false
      })

      wx.showToast({
        title: `测试完成 ${passed}/${results.length}`,
        icon: failed > 0 ? 'error' : 'success'
      })

    } catch (err) {
      console.error('测试执行失败:', err)
      this.setData({ isRunning: false })
      wx.showToast({ title: '测试失败', icon: 'error' })
    }
  },

  // 复制日志
  copyLogs() {
    const text = this.data.logs.join('\n')
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制日志' })
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack()
  }
})
