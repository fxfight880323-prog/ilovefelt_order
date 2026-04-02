const app = getApp()

Page({
  data: {
    isAdmin: false,
    activeTab: 'craftsman', // craftsman, dispatcher, verify
    craftsmanList: [],
    dispatcherList: [],
    pendingList: [],
    filteredPendingList: [],
    pendingFilter: 'all', // all, craftsman, dispatcher
    pendingCraftsmanCount: 0,
    pendingDispatcherCount: 0,
    loading: false,
    stats: {
      craftsmanCount: 0,
      dispatcherCount: 0,
      pendingCount: 0
    },
    // 编辑相关
    showEditModal: false,
    editType: '', // craftsman, dispatcher
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
    
    // 设置自定义 tabBar 选中状态（控制台是第2个，索引1）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  // 检查是否为管理员
  async checkAdmin() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'isAdmin' }
      })

      if (res.result.code === 0 && res.result.isAdmin) {
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
    }
  },

  // 跳转到数据库初始化页面
  goToInitDb() {
    wx.navigateTo({
      url: '/pages/admin/initDb'
    })
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.loadCraftsmanList(),
        this.loadDispatcherList(),
        this.loadPendingList()
      ])
      
      this.updateStats()
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载手艺人列表
  async loadCraftsmanList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'getList' }
      })

      if (res.result.code === 0) {
        this.setData({ craftsmanList: res.result.data })
      }
    } catch (err) {
      console.error('加载手艺人列表失败:', err)
    }
  },

  // 加载派单人列表
  async loadDispatcherList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getDispatcherList' }
      })

      if (res.result.code === 0) {
        this.setData({ dispatcherList: res.result.data })
      }
    } catch (err) {
      console.error('加载派单人列表失败:', err)
    }
  },

  // 加载待审核列表（使用新的角色申请系统）
  async loadPendingList() {
    try {
      // 查询角色申请表
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getRoleApplications',
          data: { status: 'pending' }
        }
      })

      const pendingList = res.result.data || []
      
      // 统计数量
      const craftsmanList = pendingList.filter(item => item.role === 'craftsman')
      const dispatcherList = pendingList.filter(item => item.role === 'dispatcher')
      
      this.setData({ 
        pendingList,
        pendingCraftsmanCount: craftsmanList.length,
        pendingDispatcherCount: dispatcherList.length
      })
      
      // 更新筛选后的列表
      this.updateFilteredPendingList()
    } catch (err) {
      console.error('加载待审核列表失败:', err)
    }
  },

  // 切换待审核筛选
  switchPendingFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ pendingFilter: filter }, () => {
      this.updateFilteredPendingList()
    })
  },

  // 更新筛选后的待审核列表
  updateFilteredPendingList() {
    const { pendingList, pendingFilter } = this.data
    let filteredList = pendingList
    
    if (pendingFilter !== 'all') {
      filteredList = pendingList.filter(item => item.role === pendingFilter)
    }
    
    this.setData({ filteredPendingList: filteredList })
  },

  // 更新统计
  updateStats() {
    const { craftsmanList, dispatcherList, pendingList } = this.data
    this.setData({
      stats: {
        craftsmanCount: craftsmanList.length,
        dispatcherCount: dispatcherList.length,
        pendingCount: pendingList.length
      }
    })
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 审核手艺人
  // 审核申请（使用新的角色申请系统）
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
            
            // 使用新的角色申请审批接口
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'reviewRoleApplication',
                data: {
                  applicationId: id,
                  approved: action === 'approve',
                  reason: res.content || ''
                }
              }
            })

            wx.hideLoading()

            if (result.result.code === 0) {
              wx.showToast({ title: '处理成功', icon: 'success' })
              this.loadData()
            } else {
              wx.showToast({ title: result.result.message, icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('审核失败:', err)
            wx.showToast({ title: '处理失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 保留旧函数以兼容
  async reviewCraftsman(e) {
    return this.reviewApplication(e)
  },

  // 删除手艺人
  async deleteCraftsman(e) {
    const { id, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除手艺人 "${name}" 吗？此操作不可恢复。`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'deleteCraftsman',
                data: { craftsmanId: id }
              }
            })

            wx.hideLoading()

            if (result.result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadData()
            } else {
              wx.showToast({ title: result.result.message, icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 删除派单人
  async deleteDispatcher(e) {
    const { id, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除派单人 "${name}" 吗？此操作不可恢复。`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            
            const result = await wx.cloud.callFunction({
              name: 'admin',
              data: {
                action: 'deleteDispatcher',
                data: { dispatcherId: id }
              }
            })

            wx.hideLoading()

            if (result.result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadData()
            } else {
              wx.showToast({ title: result.result.message, icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 查看详情
  viewDetail(e) {
    const { id, type } = e.currentTarget.dataset
    // 可以跳转到详情页面
    wx.navigateTo({
      url: `/pages/admin/userDetail?id=${id}&type=${type}`
    })
  },

  // 搜索用户
  onSearch(e) {
    const keyword = e.detail.value
    // 实现搜索功能
    console.log('搜索:', keyword)
  },

  // 显示编辑弹窗
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

  // 关闭编辑弹窗
  closeEditModal() {
    this.setData({ showEditModal: false })
  },

  // 阻止冒泡
  preventClose() {},

  // 编辑表单输入
  onEditInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`editForm.${field}`]: e.detail.value
    })
  },

  // 选择星级
  selectStar(e) {
    const level = e.currentTarget.dataset.level
    this.setData({
      'editForm.starLevel': level
    })
  },

  // 选择履约情况
  selectPerformance(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'editForm.performance': value
    })
  },

  // 保存编辑
  async saveEdit() {
    const { editType, editId, editForm } = this.data

    if (!editForm.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const cloudFunc = editType === 'craftsman' ? 'craftsman' : 'admin'
      const action = editType === 'craftsman' ? 'update' : 'updateDispatcher'
      
      const result = await wx.cloud.callFunction({
        name: cloudFunc,
        data: {
          action,
          data: {
            id: editId,
            ...editForm
          }
        }
      })

      wx.hideLoading()

      if (result.result.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ showEditModal: false })
        this.loadData()
      } else {
        wx.showToast({ title: result.result.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('保存失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
