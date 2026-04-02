// 测试云函数调用
(async function() {
  console.log('🔧 测试云函数调用...\n');
  
  const testPhone = '138' + Date.now().toString().slice(-8);
  console.log('测试手机号:', testPhone);
  
  try {
    // 调用云函数
    const res = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'applyRole',
        data: {
          role: 'dispatcher',
          applyData: {
            phone: testPhone,
            name: '测试用户',
            password: '123456',
            company: '测试公司'
          }
        }
      }
    });
    
    console.log('\n✅ 云函数返回:', JSON.stringify(res.result));
    
    // 等待一下
    await new Promise(r => setTimeout(r, 1000));
    
    // 查询数据库
    const db = wx.cloud.database();
    const queryRes = await db.collection('users').where({ phone: testPhone }).get();
    
    console.log('\n✅ 查询结果:', queryRes.data.length, '条');
    
    if (queryRes.data.length === 0) {
      console.log('\n❌ 数据库中没有写入记录！');
      console.log('   可能原因:');
      console.log('   1. 云函数中数据库操作失败');
      console.log('   2. 权限问题');
      console.log('   3. OPENID为空导致逻辑分支未走到');
      
      // 检查该手机号的OPENID
      const contextRes = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getOpenid' }
      });
      console.log('\n   当前OPENID:', contextRes.result.openid);
    } else {
      console.log('\n✅ 写入成功！');
      console.log('   用户ID:', queryRes.data[0]._id);
    }
    
  } catch (err) {
    console.error('\n❌ 错误:', err);
  }
})();
