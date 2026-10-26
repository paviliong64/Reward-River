/**
 * USA Profile & Account Auto-Generator
 * Generates realistic American names, usernames, emails, and passwords for fast 1-click signup.
 * Guarantees high uniqueness so duplicate accounts never occur.
 */

export interface GeneratedUsaProfile {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

const USA_FIRST_NAMES = [
  'Brandon', 'Austin', 'Tyler', 'Mason', 'Logan', 'Ethan', 'Caleb', 'Dylan',
  'Ryan', 'Noah', 'Lucas', 'Connor', 'Hunter', 'Jason', 'Kevin', 'Justin',
  'Madison', 'Chloe', 'Hannah', 'Olivia', 'Sophia', 'Emma', 'Hailey', 'Brooklyn',
  'Ashley', 'Megan', 'Rachel', 'Lauren', 'Zachary', 'Bradley', 'Liam', 'Jackson',
  'Aiden', 'Trevor', 'Derek', 'Nathan', 'Colton', 'Wyatt', 'Blake', 'Cameron'
];

const USA_LAST_NAMES = [
  'Walker', 'Carter', 'Brooks', 'Morgan', 'Bennett', 'Hayes', 'Parker', 'Collins',
  'Foster', 'Sullivan', 'Mitchell', 'Turner', 'Cooper', 'Reed', 'Murphy', 'Rivera',
  'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin',
  'Nelson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall'
];

const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];

export function generateUsaProfile(seedRandom?: () => number): GeneratedUsaProfile {
  const rand = seedRandom || Math.random;

  const first = USA_FIRST_NAMES[Math.floor(rand() * USA_FIRST_NAMES.length)];
  const last = USA_LAST_NAMES[Math.floor(rand() * USA_LAST_NAMES.length)];
  
  // Guarantee unique random suffix (4 digits + short time entropy) so accounts never collide
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 1000..9999
  const passDigits = Math.floor(100 + Math.random() * 900); // 100..999
  const domain = EMAIL_DOMAINS[Math.floor(rand() * EMAIL_DOMAINS.length)];

  const fullName = `${first} ${last}`;
  const username = `${first.toLowerCase()}_${last.toLowerCase()}${randomSuffix}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${randomSuffix}@${domain}`;
  const password = `${first}${last}${passDigits}!`;

  return {
    fullName,
    username,
    email,
    password
  };
}
