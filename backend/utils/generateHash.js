// Small helper to create a bcrypt hash (useful for editing database.sql seed data).
// Usage:  npm run hash -- mypassword
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.log('Usage: npm run hash -- <password>');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 10));
