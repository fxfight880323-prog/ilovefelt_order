// 微信小程序完整测试脚本
// 使用方法：全选复制 → 粘贴到控制台 → 回车

(function() {
  'use strict';
  
  const TestEngine = {
    results: [],
    
    log: function(name, pass, detail) {
      this.results.push({name, pass, detail});
      const icon = pass ? '✓' : '✗';
      console.log(`${icon} ${name}${detail ? ' - ' + detail : ''}`);
    },
    
    cleanup: async function() {
      console.log('🧹 清理测试环境...');
      wx.removeStorageSync('users');
      wx.removeStorageSync('currentUser');
      wx.removeStorageSync('userRole');
      return true;
    },
    
    testAdmin: async function() {
      console.log('\n👑 测试管理员账号 (13810062394 / 880323)');
      
      try {
        // 1. 初始化管理员
        const initRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'initAdmin',
            data: {
              phone: '13810062394',
              password: '880323',
              name: '管理员'
            }
          }
        });
        
        this.log('初始化管理员', 
          initRes.result.code === 0, 
          initRes.result.message
        );
        
        // 2. 登录测试
        const loginRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'loginByPhone',
            data: {
              phone: '13810062394',
              password: '880323'
            }
          }
        });
        
        const isSuccess = loginRes.result.code === 0;
        const isAdmin = loginRes.result.data?.isAdmin;
        
        this.log('管理员登录', isSuccess, 
          isSuccess ? `角色: ${loginRes.result.data.roles.join(',')}` : loginRes.result.message
        );
        
        this.log('管理员权限标识', isAdmin === true);
        
        return isSuccess && isAdmin;
      } catch (e) {
        this.log('管理员测试', false, e.message);
        return false;
      }
    },
    
    testRegister: async function() {
      console.log('\n📝 测试注册流程');
      
      try {
        const phone = '138' + Date.now().toString().slice(-8);
        
        // 1. 注册新用户
        const regRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'applyRole',
            data: {
              role: 'craftsman',
              applyData: {
                phone: phone,
                name: '测试用户',
                password: '123456',
                specialty: '针毯'
              }
            }
          }
        });
        
        const regSuccess = regRes.result.code === 0;
        const isPending = regRes.result.data?.status === 'pending';
        
        this.log('用户注册', regSuccess && isPending, 
          regSuccess ? `手机号: ${phone}, 状态: ${regRes.result.data.status}` : regRes.result.message
        );
        
        // 2. 登录拦截测试
        const loginRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'loginByPhone',
            data: {
              phone: phone,
              password: '123456'
            }
          }
        });
        
        const isBlocked = loginRes.result.code !== 0;
        const isPendingError = loginRes.result.code === -1002 || loginRes.result.code === -1003;
        
        this.log('待审批登录拦截', isBlocked && isPendingError,
          isBlocked ? `错误码: ${loginRes.result.code}` : '未被拦截'
        );
        
        return { phone, regSuccess, isBlocked };
      } catch (e) {
        this.log('注册测试', false, e.message);
        return { phone: null, regSuccess: false, isBlocked: false };
      }
    },
    
    testApproval: async function(phone) {
      console.log('\n🔐 测试管理员审批');
      
      if (!phone) {
        this.log('审批测试', false, '无测试手机号');
        return false;
      }
      
      try {
        // 直接修改数据库模拟审批
        const users = wx.getStorageSync('users') || [];
        const idx = users.findIndex(u => u.phone === phone);
        
        if (idx > -1) {
          users[idx].status = 'active';
          users[idx].roles = ['craftsman'];
          if (users[idx].roleApplications && users[idx].roleApplications[0]) {
            users[idx].roleApplications[0].status = 'active';
          }
          wx.setStorageSync('users', users);
          this.log('模拟审批通过', true);
        } else {
          this.log('找不到测试用户', false);
          return false;
        }
        
        // 审批后登录测试
        const loginRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'loginByPhone',
            data: {
              phone: phone,
              password: '123456'
            }
          }
        });
        
        const canLogin = loginRes.result.code === 0;
        this.log('审批后登录', canLogin,
          canLogin ? `角色: ${loginRes.result.data.roles}` : loginRes.result.message
        );
        
        return canLogin;
      } catch (e) {
        this.log('审批测试', false, e.message);
        return false;
      }
    },
    
    report: function() {
      console.log('\n' + '='.repeat(50));
      console.log('📊 测试报告');
      console.log('='.repeat(50));
      
      const passed = this.results.filter(r => r.pass).length;
      const failed = this.results.filter(r => !r.pass).length;
      const total = this.results.length;
      
      console.log(`总计: ${total} 项`);
      console.log(`通过: ${passed} 项 ✓`);
      console.log(`失败: ${failed} 项 ✗`);
      
      if (failed > 0) {
        console.log('\n❌ 失败项目:');
        this.results.filter(r => !r.pass).forEach(r => {
          console.log(`  - ${r.name}: ${r.detail || ''}`);
        });
      } else {
        console.log('\n🎉 所有测试通过！');
      }
      
      return { passed, failed, total };
    },
    
    run: async function() {
      console.log('🚀 开始自动化测试...\n');
      console.log('⚠️ 此测试会清理数据库，请确保非生产环境\n');
      
      await this.cleanup();
      await this.testAdmin();
      const regResult = await this.testRegister();
      await this.testApproval(regResult.phone);
      
      return this.report();
    }
  };
  
  // 暴露到全局
  window.runTestNow = function() {
    TestEngine.run();
  };
  
  // 自动执行
  TestEngine.run();
  
})();
