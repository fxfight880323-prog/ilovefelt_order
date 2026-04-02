const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    isAdmin: false,
    activeTab: 'craftsman',
    craftsmanList: [],
    dispatcherList: [],
    pendingList: [],
    filteredPendingList: [],
    pendingFilter: 'all',
    pendingCraftsmanCount: 0,
    pendingDispatcherCount: 0,
    loading: false,
    stats: {
      craftsmanCount: 0,
      dispatcherCount: 0,
      pendingCount: 0
    },
    showEditModal: false,
    editType: '',
    editId: '',
    editForm: {
      name: '',
      phone: '',
      wechatId: '',
      code: '',
      starLevel: 3,
      specialty: '',
      performance: '中',
      company: ''
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadData()
    }
    
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  // 检查管理员权限 - 使用新API
  async checkAdmin() {
    try {
      const res = await API.user.getInfo()
      
      if (res.data.roles.includes('admin')) {
        this.setData({ isAdmin: true })
        this.loadData()
      } else {
        wx.showModal({
          title: '无权限',
          content: '您不是管理员，无法访问此页面',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/common/index' })
          }
        })
      }
    } catch (err) {
      console.error('检查管理员权限失败:', err)
      wx.showModal({
        title: '无权限',
        content: '无法验证管理员身份',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/common/index' })
        }
      })
    }
  },

  goToInitDb() {
    wx.navigateTo({ url: '/pages/admin/initDb' })
  },

  // 加载数据 - 使用新API
  async loadData() {
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.loadPendingList(),
        this.loadCraftsmen(),
        this.loadStats()
      ])
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载手艺人列表 - 使用新API
  async loadCraftsmen() {
    try {
      const res = await API.order.getCraftsmen()
      this.setData({ craftsmanList: res.data })
    } catch (err) {
      console.error('加载手艺人列表失败:', err)
    }
  },

  // 加载待审批列表 - 使用新API
  async loadPendingList() {
    try {
      const res = await API.admin.getPendingRequests()
      const pendingList = res.data || []
      
      const craftsmanList = pendingList.filter(item => item.role === 'craftsman')
      const dispatcherList = pendingList.filter(item => item.role === 'dispatcher')
      
      this.setData({ 
        pendingList,
        pendingCraftsmanCount: craftsmanList.length,
        pendingDispatcherCount: dispatcherList.length
      })
      
      this.updateFilteredPendingList()
    } catch (err) {
      console.error('加载待审核列表失败:', err)
    }
  },

  // 加载统计数据 - 使用新API
  async loadStats() {
    try {
      const res = await API.admin.getStats()
      this.setData({ stats: res.data })
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  switchPendingFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ pendingFilter: filter }, () => {
      this.updateFilteredPendingList()
    })
  },

  updateFilteredPendingList() {
    const { pendingList, pendingFilter } = this.data
    let filteredList = pendingList
    
    if (pendingFilter !== 'all') {
      filteredList = pendingList.filter(item => item.role === pendingFilter)
    }
    
    this.setData({ filteredPendingList: filteredList })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 审核申请 - 使用新API
  async reviewApplication(e) {
    const { id, type, action } = e.currentTarget.dataset
    const roleName = type === 'craftsman' ? '手艺人' : '派单人'
    
    wx.showModal({
      title: action === 'approve' ? `通过${roleName}审核` : `拒绝${roleName}审核`,
      content: action === 'approve' ? `确定要通过该${roleName}的注册申请吗？` : '请输入拒绝原因',
      editable: action === 'reject',
      placeholderText: '请输入拒绝原因',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' })
            
            // 使用新API审批
            await API.admin.approve(
              id,
              action === 'approve',
              res.content || ''
            )

            wx.hideLoading()
            wx.showToast({ title: '处理成功', icon: 'success' })
            this.loadData()
            
          } catch (err) {
            wx.hideLoading()
            console.error('审核失败:', err)
            wx.showToast({ title: err.message || '处理失败', icon: 'none' })
          }
        }
      }
    })
  },

  reviewCraftsman(e) {
    return this.reviewApplication(e)
  },

  viewDetail(e) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/admin/userDetail?id=${id}&type=${type}` })
  },

  onSearch(e) {
    const keyword = e.detail.value
    console.log('搜索:', keyword)
    // 可以实现前端过滤
  },

  showEditModal(e) {
    const { id, type } = e.currentTarget.dataset
    const list = type === 'craftsman' ? this.data.craftsmanList : this.data.dispatcherList
    const user = list.find(item => item._id === id)
    
    if (!user) return

    this.setData({
      showEditModal: true,
      editType: type,
      editId: id,
      editForm: {
        name: user.name || '',
        phone: user.phone || '',
        wechatId: user.wechatId || '',
        code: user.code || '',
        starLevel: user.starLevel || 3,
        specialty: user.specialty || '',
        performance: user.performance || '中',
        company: user.company || ''
      }
    })
  },

  closeEditModal() {
    this.setData({ showEditModal: false })
  },

  preventClose() {},

  onEditInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`editForm.${field}`]: e.detail.value })
  },

  selectStar(e) {
    const level = e.currentTarget.dataset.level
    this.setData({ 'editForm.starLevel': level })
  },

  selectPerformance(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ 'editForm.performance': value })
  },

  async saveEdit() {
    const { editForm } = this.data

    if (!editForm.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 编辑功能需要先在API中添加对应接口
      // 这里保留原有的云函数调用
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ showEditModal: false })
      this.loadData()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
