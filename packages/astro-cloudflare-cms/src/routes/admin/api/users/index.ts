import type { APIRoute } from 'astro';
import { isMaster } from '../../../../lib/authz';
import { listUsers } from '../../../../lib/db-users';
import { getUserByEmail, insertUser } from '../../../../lib/db';
import { hashPassword } from '../../../../lib/auth';
import type { Role } from '../../../../lib/types';

export const GET: APIRoute = async ({ locals }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  return Response.json(await listUsers(locals.runtime.env.DB));
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  const db = locals.runtime.env.DB;

  let body: { email?: string; name?: string; role?: Role; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const name = (body.name ?? '').trim();
  const role: Role = body.role === 'master' ? 'master' : 'author';
  const password = body.password ?? '';
  if (!email || !name || password.length < 8)
    return new Response('email, name, and password (>=8) required', { status: 400 });
  if (await getUserByEmail(db, email))
    return new Response('email already exists', { status: 409 });

  const { hash, salt } = await hashPassword(password);
  const row = {
    id: crypto.randomUUID(),
    email,
    password_hash: hash,
    password_salt: salt,
    role,
    name,
    created_at: Math.floor(Date.now() / 1000),
  };

  try {
    await insertUser(db, row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return new Response('email already exists', { status: 409 });
    }
    throw err;
  }

  return Response.json(
    { id: row.id, email, role, name, created_at: row.created_at },
    { status: 201 }
  );
};
