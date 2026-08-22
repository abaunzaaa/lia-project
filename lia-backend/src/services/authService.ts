import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { DbUser, JwtPayload, PublicUser, toPublicUser } from '../models/userTypes';
import { LoginInput, RegisterInput } from '../models/authSchemas';

export class AuthServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

type UserRow = Pick<
  DbUser,
  'id' | 'full_name' | 'age' | 'email' | 'emergency_contact' | 'created_at' | 'password_hash'
>;

const USER_PUBLIC_COLUMNS = `
  id,
  full_name,
  age,
  email,
  emergency_contact,
  created_at
`;

function signToken(user: Pick<PublicUser, 'id' | 'email'>): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
  };

  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, config.jwtSecret, options);
}

export async function register(
  input: RegisterInput
): Promise<{ user: PublicUser; token: string }> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM public.users WHERE email = $1 LIMIT 1',
    [input.email]
  );

  if (existing.rows.length > 0) {
    throw new AuthServiceError(409, 'Ya existe una cuenta con este correo.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const id = uuidv4();
  const emergencyContact = input.emergencyContact;

  try {
    const result = await pool.query<Omit<UserRow, 'password_hash'>>(
      `INSERT INTO public.users (
        id, full_name, age, email, password_hash, emergency_contact, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING ${USER_PUBLIC_COLUMNS}`,
      [id, input.fullName, input.age, input.email, passwordHash, emergencyContact]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AuthServiceError(500, 'No se pudo crear la cuenta.');
    }

    const user = toPublicUser(row);
    const token = signToken(user);
    return { user, token };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthServiceError(409, 'Ya existe una cuenta con este correo.');
    }
    throw error;
  }
}

export async function login(
  input: LoginInput
): Promise<{ user: PublicUser; token: string }> {
  const result = await pool.query<UserRow>(
    `SELECT id, full_name, age, email, emergency_contact, created_at, password_hash
     FROM public.users
     WHERE email = $1
     LIMIT 1`,
    [input.email]
  );

  const row = result.rows[0];
  if (!row) {
    throw new AuthServiceError(401, 'Correo o contraseña incorrectos.');
  }

  const passwordMatches = await bcrypt.compare(input.password, row.password_hash);
  if (!passwordMatches) {
    throw new AuthServiceError(401, 'Correo o contraseña incorrectos.');
  }

  const user = toPublicUser(row);
  const token = signToken(user);
  return { user, token };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const result = await pool.query<Omit<UserRow, 'password_hash'>>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM public.users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    throw new AuthServiceError(404, 'Usuario no encontrado.');
  }

  return toPublicUser(row);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
