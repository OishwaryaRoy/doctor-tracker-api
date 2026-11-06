import type { Types } from 'mongoose';
import type { IUser } from './user.model.js';

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: IUser['role'];
  lastLoginAt: string | null;
};

export function toUserDTO(user: Omit<IUser, 'passwordHash'> & { _id: Types.ObjectId }): UserDTO {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
