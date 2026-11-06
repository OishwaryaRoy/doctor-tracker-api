import bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/ApiError.js';
import { toUserDTO, type UserDTO } from '../users/user.dto.js';
import { User } from '../users/user.model.js';
import type { LoginInput } from './auth.schema.js';
import { signToken } from './token.js';

const DUMMY_HASH = '$2b$12$QOT3kk4De2C0aKy.I7R4dORzpjZtivqUsA9yYjLWP/h3PgUokAvr6';

const INVALID_CREDENTIALS = 'Invalid email or password';

export async function login({
  email,
  password,
}: LoginInput): Promise<{ user: UserDTO; token: string }> {
  const user = await User.findOne({ email }).select('+passwordHash');

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordMatches) throw ApiError.unauthorized(INVALID_CREDENTIALS);

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user: toUserDTO(user.toObject()), token };
}

export async function getCurrentUser(userId: string): Promise<UserDTO> {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized('Your account no longer exists');
  return toUserDTO(user);
}
