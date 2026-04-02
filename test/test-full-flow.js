// 完整注册-审批流程测试（使用云函数）
(function() {

console.log('🚀 测试完整注册-审批流程...\n');

const db = wx.cloud.database();

let testResults = [];
function log(name, pass, detail) {
  testResults.push({name, pass, detail});
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

// 测试数据
let testPhone = '138' + Date.now().toString().slice(-8);
let testUserId = null;
let testDispatcherId = null;

async function test() {
  // 步骤1: 使用云函数注册
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 1. 使用云函数注册               ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const registerRes = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'dispatcher',
        applyData: {
          phone: testPhone,
          name: '测试派单员',
          password: '123456',
          company: '测试公司'
        }
      }
    }
  });
  
  console.log('   注册返回:', JSON.stringify(registerRes.result));
  log('云函数注册', registerRes.result.code === 0, registerRes.result.message);
  
  // 等待数据库写入
  await new Promise(r => setTimeout(r, 800));
  
  // 查询 users 表
  const userCheck = await db.collection('users').where({ phone: testPhone }).get();
  console.log('   users表查询:', userCheck.data.length, '条');
  
  if (userCheck.data.length > 0) {
    testUserId = userCheck.data[0]._id;
    log('users表写入', true, testUserId);
  } else {
    log('users表写入', false, '未找到');
    console.log('   测试中止');
    return;
  }
  
  // 步骤2: 管理员审批
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 2. 管理员审批                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const approveRes = await wx.cloud.callFunction({
    name: 'admin',
    data: {
      action: 'reviewRoleApplication',
      data: {
        applicationId: `${testUserId}_dispatcher`,
        approved: true
      }
    }
  });
  
  console.log('   审批返回:', JSON.stringify(approveRes.result));
  log('审批操作', approveRes.result.code === 0, approveRes.result.message);
  
  // 等待数据库更新
  await new Promise(r => setTimeout(r, 800));
  
  // 步骤3: 验证 users 表更新
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 3. 验证 users 表更新         ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const userAfter = await db.collection('users').doc(testUserId).get();
  const userData = userAfter.data;
  
  log('users表角色更新', 
    userData.roles.includes('dispatcher'),
    `roles: [${userData.roles.join(', ')}]`
  );
  
  log('roleApplications状态更新',
    userData.roleApplications[0].status === 'active',
    `status: ${userData.roleApplications[0].status}`
  );
  
  // 步骤4: 验证 dispatchers 表创建
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 4. 验证 dispatchers 表创建   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const dispatcherCheck = await db.collection('dispatchers').where({ phone: testPhone }).get();
  console.log('   dispatchers表查询:', dispatcherCheck.data.length, '条');
  
  if (dispatcherCheck.data.length > 0) {
    testDispatcherId = dispatcherCheck.data[0]._id;
    log('dispatchers表创建', true, testDispatcherId);
  } else {
    log('dispatchers表创建', false, '未找到');
  }
  
  // 步骤5: 登录测试
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 5. 登录测试                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const loginRes = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: testPhone, password: '123456' }
    }
  });
  
  console.log('   登录返回:', JSON.stringify(loginRes.result));
  log('登录', loginRes.result.code === 0, loginRes.result.message);
  
  if (loginRes.result.code === 0) {
    log('返回角色', 
      loginRes.result.data?.roles?.includes('dispatcher'),
      `roles: [${loginRes.result.data?.roles?.join(', ')}]`
    );
    log('返回openid', !!loginRes.result.data?.openid);
  }
  
  // 步骤6: 管理员查看人员列表
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 6. 管理员查看人员列表         ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const listRes = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getDispatcherList' }
  });
  
  log('获取派单员列表', listRes.result.code === 0, `${listRes.result.data?.length || 0} 人`);
  
  const found = listRes.result.data?.find(d => d.phone === testPhone);
  log('新注册用户在列表中', !!found, found ? found._id : '未找到');
  
  // 报告
  console.log('\n' + '═'.repeat(60));
  const passed = testResults.filter(r => r.pass).length;
  console.log('📋 测试结果:', `${passed}/${testResults.length} 通过`);
  console.log('═'.repeat(60));
  
  if (passed === testResults.length) {
    console.log('\n🎉 所有测试通过！');
    console.log('\n测试账号信息:');
    console.log('  手机号:', testPhone);
    console.log('  密码: 123456');
    console.log('  用户ID:', testUserId);
    console.log('  派单员ID:', testDispatcherId);
  } else {
    console.log('\n❌ 部分测试失败，请检查以上日志');
  }
}

test().catch(err => console.error('❌ 错误:', err));

})();
