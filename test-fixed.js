// 微信小程序测试脚本 - 修复版
// 此版本使用正确的云函数调用流程

console.log('🚀 开始测试（修复版）...\n');

const results = [];

function log(name, pass, detail) {
  results.push({name, pass, detail});
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' - ' + detail : ''}`);
}

// 清理环境
console.log('清理环境...');
wx.removeStorageSync('users');
wx.removeStorageSync('currentUser');

let testPhone = null;
let testUserId = null;

// 步骤1: 初始化管理员
async function step1() {
  console.log('\n1. 初始化管理员');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'initAdmin',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  
  log('管理员初始化', res.result.code === 0, res.result.message);
}

// 步骤2: 注册新用户
async function step2() {
  console.log('\n2. 注册新用户');
  
  testPhone = '138' + Date.now().toString().slice(-8);
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'craftsman',
        applyData: {
          phone: testPhone,
          name: '测试用户',
          password: '123456',
          specialty: '针毯'
        }
      }
    }
  });
  
  if (res.result.code === 0) {
    // 获取用户ID
    const usersRes = await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'getUserInfo' }
    });
    // 通过手机号查询用户
    const allUsers = await wx.cloud.database().collection('users').where({
      phone: testPhone
    }).get();
    
    if (allUsers.data.length > 0) {
      testUserId = allUsers.data[0]._id;
    }
  }
  
  log('用户注册', res.result.code === 0, 
    res.result.code === 0 ? `${testPhone}, 状态: ${res.result.data.status}` : res.result.message
  );
}

// 步骤3: 验证pending状态
async function step3() {
  console.log('\n3. 验证pending状态');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: testPhone, password: '123456' }
    }
  });
  
  const isBlocked = res.result.code === -1002 || res.result.code === -1003;
  log('登录被拦截', isBlocked, 
    isBlocked ? `错误码: ${res.result.code}` : '未被拦截'
  );
}

// 步骤4: 管理员登录
async function step4() {
  console.log('\n4. 管理员登录');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  
  log('管理员登录', res.result.code === 0);
  log('管理员权限', res.result.data?.isAdmin === true);
}

// 步骤5: 获取待审批列表
async function step5() {
  console.log('\n5. 获取待审批列表');
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getRoleApplications', data: { status: 'pending' } }
  });
  
  log('获取待审批表', res.result.code === 0, 
    res.result.code === 0 ? `${res.result.data?.list?.length || 0} 条待审批` : res.result.message
  );
}

// 步骤6: 审批通过
async function step6() {
  console.log('\n6. 审批通过');
  
  if (!testUserId) {
    log('审批', false, '未找到测试用户ID');
    return;
  }
  
  const res = await wx.cloud.callFunction({
    name: 'admin',
    data: {
      action: 'reviewRoleApplication',
      data: {
        applicationId: `${testUserId}_craftsman`,
        approved: true
      }
    }
  });
  
  log('审批操作', res.result.code === 0, res.result.message);
}

// 步骤7: 验证审批后登录
async function step7() {
  console.log('\n7. 验证审批后登录');
  
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: testPhone, password: '123456' }
    }
  });
  
  log('审批后登录', res.result.code === 0, 
    res.result.code === 0 ? `角色: ${res.result.data.roles}` : res.result.message
  );
}

// 报告
function report() {
  console.log('\n' + '='.repeat(50));
  console.log('测试报告');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  
  console.log(`总计: ${results.length} 项`);
  console.log(`通过: ${passed} 项`);
  console.log(`失败: ${failed} 项`);
  
  if (failed > 0) {
    console.log('\n失败项目:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  - ${r.name}: ${r.detail || ''}`);
    });
  } else {
    console.log('\n✅ 所有测试通过！');
  }
}

// 执行
(async function() {
  try {
    await step1();
    await step2();
    await step3();
    await step4();
    await step5();
    await step6();
    await step7();
    report();
  } catch (e) {
    console.error('测试错误:', e);
  }
})();
