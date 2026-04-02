// 检查 user 云函数日志
(async function() {
  console.log('🔧 测试并检查 user 云函数日志...\n');
  
  const testPhone = '138' + Date.now().toString().slice(-8);
  console.log('测试手机号:', testPhone);
  
  // 调用注册
  console.log('\n1. 调用 applyRole...');
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'dispatcher',
        applyData: {
          phone: testPhone,
          name: '日志测试用户',
          password: '123456',
          company: '测试公司'
        }
      }
    }
  });
  
  console.log('   返回:', JSON.stringify(res.result));
  
  console.log('\n2. 请立即查看云函数日志:');
  console.log('   云开发 -> 云函数 -> user -> 日志');
  console.log('   查找包含 "applyRole" 的日志');
  
  console.log('\n3. 等待2秒后查询数据库...');
  await new Promise(r => setTimeout(r, 2000));
  
  const db = wx.cloud.database();
  const check = await db.collection('users').where({ phone: testPhone }).get();
  console.log('   数据库查询:', check.data.length, '条');
  
  if (check.data.length === 0) {
    console.log('   ❌ 数据库中没有记录 - 请检查云函数日志找原因');
  } else {
    console.log('   ✅ 找到记录:', check.data[0]._id);
  }
})();
