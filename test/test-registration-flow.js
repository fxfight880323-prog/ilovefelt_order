// 测试完整的注册-审批流程
(function() {

console.log('🚀 测试完整注册-审批流程...\n');

const db = wx.cloud.database();

// SHA256哈希（与云函数一致）
function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}
function hash(pwd) {
  // 小程序环境没有crypto，使用一个简单的哈希函数
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // 这不是真正的SHA256，但用于测试
  // 实际上我们需要使用与云函数相同的哈希方法
  return 'test_hash_' + Math.abs(hash).toString(16);
}

let testResults = [];
function log(name, pass, detail) {
  testResults.push({name, pass, detail});
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

// 步骤1: 清理旧数据
async function step1_Cleanup() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 1. 清理旧数据                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const testPhone = '138' + Date.now().toString().slice(-8);
  
  // 删除旧用户
  const oldUsers = await db.collection('users').where({ 
    phone: db.RegExp({ regexp: '^138' })
  }).get();
  
  for (const u of oldUsers.data) {
    await db.collection('users').doc(u._id).remove();
  }
  console.log(`   删除了 ${oldUsers.data.length} 个旧用户`);
  
  return testPhone;
}

// 步骤2: 注册新用户
async function step2_Register(phone) {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 2. 注册新用户                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  // 直接插入 users 表（模拟注册后的状态）
  const userRes = await db.collection('users').add({
    data: {
      openid: 'openid_' + Date.now(),
      phone: phone,
      password: 'test_hash_password',  // 简化密码用于测试
      name: '测试派单员',
      roles: [], // 未审批时为空
      roleApplications: [{
        role: 'dispatcher',
        status: 'pending',
        applyTime: db.serverDate(),
        applyData: { company: '测试公司' }
      }],
      isAdmin: false,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  const userId = userRes._id;
  log('用户创建', !!userId, userId);
  
  // 验证数据库
  const check = await db.collection('users').doc(userId).get();
  log('数据库验证', check.data.phone === phone);
  
  return { userId, phone };
}

// 步骤3: 管理员查看待审批
async function step3_CheckPending() {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 3. 管理员查看待审批             ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getRoleApplications', data: { status: 'pending' } }
  });
  
  log('获取待审批列表', res.result.code === 0, `${res.result.data?.length || 0} 条`);
  return res.result.data;
}

// 步骤4: 管理员审批
async function step4_Approve(userId, role) {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 4. 管理员审批                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: {
      action: 'reviewRoleApplication',
      data: {
        applicationId: `${userId}_${role}`,
        approved: true
      }
    }
  });
  
  log('审批操作', res.result.code === 0, res.result.message);
  return res.result.code === 0;
}

// 步骤5: 验证审批后状态
async function step5_VerifyApproval(userId, phone) {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 5. 验证审批后状态             ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  // 检查 users 表
  const userRes = await db.collection('users').doc(userId).get();
  const user = userRes.data;
  
  log('users表更新', 
    user.roles.includes('dispatcher') && 
    user.roleApplications[0].status === 'active',
    `roles: ${user.roles}, status: ${user.roleApplications[0].status}`
  );
  
  // 检查 dispatchers 表
  const dispatcherRes = await db.collection('dispatchers').where({ phone }).get();
  log('dispatchers表创建', 
    dispatcherRes.data.length > 0,
    dispatcherRes.data.length > 0 ? dispatcherRes.data[0]._id : '未找到'
  );
  
  return dispatcherRes.data.length > 0 ? dispatcherRes.data[0]._id : null;
}

// 步骤6: 登录测试
async function step6_Login(phone) {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃ 6. 登录测试                   ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━┛');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone, password: '123456' }
    }
  });
  
  log('登录', res.result.code === 0, res.result.message);
  
  if (res.result.code === 0) {
    log('返回角色', 
      res.result.data?.roles?.includes('dispatcher'),
      res.result.data?.roles?.join(', ')
    );
  }
}

// 执行测试
(async () => {
  try {
    const phone = await step1_Cleanup();
    const { userId } = await step2_Register(phone);
    await step3_CheckPending();
    await step4_Approve(userId, 'dispatcher');
    await step5_VerifyApproval(userId, phone);
    await step6_Login(phone);
    
    // 报告
    console.log('\n' + '═'.repeat(60));
    const passed = testResults.filter(r => r.pass).length;
    console.log('📋 测试结果:', `${passed}/${testResults.length} 通过`);
    console.log('═'.repeat(60));
    
    if (passed === testResults.length) {
      console.log('\n🎉 流程正常！测试手机号:', phone, '/ 密码: 123456');
    }
    
  } catch (e) {
    console.error('❌ 错误:', e);
  }
})();

})();
