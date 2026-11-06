import { z } from 'zod';
import { email } from '../../utils/zod.js';

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
