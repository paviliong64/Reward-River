import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUsaProfile } from './usaIdentity';

test('generateUsaProfile: generates realistic USA name, username, email, and single password', () => {
  const profile = generateUsaProfile();
  assert.ok(profile.fullName.includes(' '), 'Full name should have first and last name');
  assert.ok(profile.username.length >= 6, 'Username should be populated');
  assert.ok(profile.email.includes('@'), 'Email should include @ domain');
  assert.ok(profile.password.length >= 8, 'Generated password should be at least 8 characters');
});
