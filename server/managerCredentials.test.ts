import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbStore } from './db.js';
import { hashPassword, verifyPassword } from './auth.js';

test('Manager custom email and password creation, credential updates, and authentication', async () => {
  // 1. Admin creates a manager with custom email, username and password
  const customEmail = `manager_${Date.now()}@rewardriver.online`;
  const customPass = 'MyCustomSecret@2026';
  const customName = 'Ahmed Manager';

  const { hash, salt } = hashPassword(customPass);
  const managerUser = await dbStore.createUser({
    id: `usr_mgr_${Date.now()}`,
    username: 'ahmed_manager',
    email: customEmail,
    displayName: customName,
    passwordHash: hash,
    salt,
    role: 'manager',
    emailVerified: true,
    externalOpaqueId: `rr_cpx_mgr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: 'password'
  });

  assert.ok(managerUser.id);
  assert.equal(managerUser.role, 'manager');
  assert.equal(managerUser.email, customEmail);

  // 2. Verify credentials authenticate successfully
  const stored = dbStore.getUserByEmail(customEmail);
  assert.ok(stored);
  assert.ok(stored.passwordHash && stored.salt);
  assert.equal(verifyPassword(customPass, stored.passwordHash, stored.salt), true);
  assert.equal(verifyPassword('WrongPass', stored.passwordHash, stored.salt), false);

  // 3. Admin updates manager password to another custom password
  const newCustomPass = 'ChangedAdminOverride#786';
  const newCreds = hashPassword(newCustomPass);
  const updatedUser = await dbStore.updateUser(stored.id, {
    passwordHash: newCreds.hash,
    salt: newCreds.salt
  });
  assert.ok(updatedUser);

  // Verify new password works and old password is rejected
  const reloaded = dbStore.getUserById(stored.id);
  assert.ok(reloaded);
  assert.equal(verifyPassword(newCustomPass, reloaded.passwordHash!, reloaded.salt!), true);
  assert.equal(verifyPassword(customPass, reloaded.passwordHash!, reloaded.salt!), false);

  // 4. Verify Manager Portal dashboard data returns safe manager object without crashes
  const managerDashboard = dbStore.getManagerDashboardData({ managerId: reloaded.id });
  assert.ok(managerDashboard.manager);
  assert.equal(managerDashboard.manager.id, reloaded.id);
  assert.equal(managerDashboard.manager.displayName, customName);
  assert.equal(managerDashboard.manager.role, 'manager');
  assert.equal(typeof managerDashboard.manager.displayName, 'string');
});
