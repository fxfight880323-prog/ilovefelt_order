const app = getApp()

Component({
  data: {
    color: '#7f756c',
    selectedColor: '#6c5842',
    selected: 0,
    // 手艺人导航
    craftsmanList: [
      { 
        index: 0, 
        pagePath: "pages/common/index", 
        text: "首页",
        iconPath: "/images/home.png",
        selectedIconPath: "/images/home-active.png"
      },
      { 
        index: 1, 
        pagePath: "pages/craftsman/orderList", 
        text: "接单",
        iconPath: "/images/order.png",
        selectedIconPath: "/images/order-active.png"
      },
      { 
        index: 2, 
        pagePath: "pages/craftsman/myOrders", 
        text: "我的订单",
        iconPath: "/images/my-order.png",
        selectedIconPath: "/images/my-order-active.png"
      },
      { 
        index: 3, 
        pagePath: "pages/craftsman/profile", 
        text: "个人中心",
        iconPath: "/images/profile.png",
        selectedIconPath: "/images/profile-active.png"
      }
    ],
    // 派单人导航
    dispatcherList: [
      { 
        index: 0, 
        pagePath: "pages/common/index", 
        text: "首页",
        iconPath: "/images/home.png",
        selectedIconPath: "/images/home-active.png"
      },
      { 
        index: 1, 
        pagePath: "pages/dispatcher/myOrders", 
        text: "派单",
        iconPath: "/images/order.png",
        selectedIconPath: "/images/order-active.png"
      },
      { 
        index: 2, 
        pagePath: "pages/dispatcher/craftsmen", 
        text: "手艺人",
        iconPath: "/images/my-order.png",
        selectedIconPath: "/images/my-order-active.png"
      },
      { 
        index: 3, 
        pagePath: "pages/craftsman/profile", 
        text: "个人中心",
        iconPath: "/images/profile.png",
        selectedIconPath: "/images/profile-active.png"
      }
    ],
    // 管理员导航 - 控制台和订单管理使用 navigateTo
    adminList: [
      { 
        index: 0, 
        pagePath: "pages/common/index", 
        text: "首页",
        iconPath: "/images/home.png",
        selectedIconPath: "/images/home-active.png"
      },
      { 
        index: 1, 
        pagePath: "pages/admin/console", 
        text: "控制台",
        iconPath: "/images/order.png",
        selectedIconPath: "/images/order-active.png",
        isNavigate: true
      },
      { 
        index: 2, 
        pagePath: "pages/admin/orderManage", 
        text: "订单管理",
        iconPath: "/images/my-order.png",
        selectedIconPath: "/images/my-order-active.png",
        isNavigate: true
      },
      { 
        index: 3, 
        pagePath: "pages/craftsman/profile", 
        text: "个人中心",
        iconPath: "/images/profile.png",
        selectedIconPath: "/images/profile-active.png"
      }
    ],
    list: []
  },

  attached() {
    console.log('custom-tab-bar attached')
    // 延迟更新，确保 app.globalData 已设置
    setTimeout(() => {
      this.updateTabBar()
    }, 100)
  },

  pageLifetimes: {
    show() {
      console.log('custom-tab-bar page show')
      this.updateTabBar()
    }
  },

  methods: {
    updateTabBar() {
      const userRole = app.globalData.userRole || 'guest'
      console.log('updateTabBar, userRole:', userRole)
      console.log('app.globalData:', app.globalData)
      
      let list = this.data.craftsmanList
      let roleName = 'craftsman'
      
      if (userRole === 'dispatcher') {
        list = this.data.dispatcherList
        roleName = 'dispatcher'
      } else if (userRole === 'admin') {
        list = this.data.adminList
        roleName = 'admin'
      }
      
      console.log('使用角色:', roleName, 'list:', list)
      this.setData({ list })
    },

    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      const isNavigate = data.navigate
      const index = data.index
      
      console.log('switchTab clicked:', url, 'isNavigate:', isNavigate, 'index:', index)
      
      // 更新选中状态
      this.setData({ selected: index })
      
      // 确保 url 以 / 开头
      const targetUrl = url.startsWith('/') ? url : '/' + url
      
      if (isNavigate) {
        // 非 tab 页面使用 navigateTo
        wx.navigateTo({ 
          url: targetUrl,
          fail: (err) => {
            console.error('navigateTo failed:', err)
            wx.switchTab({ url: targetUrl })
          }
        })
      } else {
        // tab 页面使用 switchTab
        console.log('calling wx.switchTab with url:', targetUrl)
        wx.switchTab({ 
          url: targetUrl,
          success: (res) => {
            console.log('switchTab success:', res)
          },
          fail: (err) => {
            console.error('switchTab failed:', err)
            wx.showToast({
              title: '页面跳转失败: ' + err.errMsg,
              icon: 'none'
            })
          }
        })
      }
    }
  }
})
