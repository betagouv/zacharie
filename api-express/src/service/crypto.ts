import bcrypt from 'bcryptjs';

export async function comparePassword(password: string, expected: string) {
  return bcrypt.compare(password, expected);
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
