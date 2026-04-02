// 运行测试的快捷方式
// 在微信开发者工具控制台执行: require('./test/run-test.js')

// 先加载完整测试脚本
const fs = wx.getFileSystemManager()
const filePath = `${wx.env.USER_DATA_PATH}/full-test.js`

// 读取并执行测试脚本
try {
  const content = fs.readFileSync('test/full-test.js', 'utf8')
  eval(content)
  console.log('✅ 测试脚本已加载')
  
  // 自动运行
  FullTest.run().then(results => {
    console.log('测试完成')
  })
} catch (err) {
  console.error('加载失败:', err)
  console.log('请直接复制 test/full-test.js 内容到控制台执行')
}
