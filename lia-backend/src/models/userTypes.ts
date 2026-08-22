/** Fila completa de public.users (uso interno / consultas SQL). */
export interface DbUser {
  id: string;
  full_name: string;
  age: number;
  email: string;
  password_hash: string;
  emergency_contact: string | null;
  created_at: Date;
  updated_at: Date | null;
}

/** Columnas necesarias para mapear a PublicUser. */
export type DbUserPublicFields = Pick<
  DbUser,
  'id' | 'full_name' | 'age' | 'email' | 'emergency_contact' | 'created_at'
>;

/** Usuario seguro para respuestas de la API (sin password_hash). */
export interface PublicUser {
  id: string;
  fullName: string;
  age: number;
  email: string;
  emergencyContact: string | null;
  createdAt: string;
}

/** Payload del JWT de sesión LÍA. */
export interface JwtPayload {
  sub: string;
  email: string;
}

export function toPublicUser(row: DbUserPublicFields): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    age: row.age,
    email: row.email,
    emergencyContact: row.emergency_contact,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
