Page({
  data: {
    type: 'craftsman' // craftsman 或 dispatcher
  },

  onLoad(options) {
    this.setData({
      type: options.type || 'craftsman'
    })
  }
})
