import type { APIRoute } from 'astro';
import { isMaster } from '../../../../lib/authz';
import { getUserById } from '../../../../lib/db';
import {
  updateUserProfile, updateUserPassword, deleteUser, countArticlesByAuthor, countMasters,
} from '../../../../lib/db-users';
import { hashPassword } from '../../../../lib/auth';
import type { Role } from '../../../../lib/types';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  const db = locals.runtime.env.DB;
  const id = params.id!;

  let body: { name?: unknown; role?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }

  const existing = await getUserById(db, id);
  if (!existing) return new Response('Not found', { status: 404 });

  // Runtime type-guards: reject non-string values for present fields.
  if (body.name !== undefined && typeof body.name !== 'string') {
    return new Response('invalid field', { status: 400 });
  }
  if (body.role !== undefined && typeof body.role !== 'string') {
    return new Response('invalid field', { status: 400 });
  }
  if (body.password !== undefined && typeof body.password !== 'string') {
    return new Response('invalid field', { status: 400 });
  }

  const name = (typeof body.name === 'string' ? body.name : existing.name).trim();
  if (!name) return new Response('name required', { status: 400 });

  const role: Role = body.role === 'master' || body.role === 'author' ? body.role : existing.role;

  // Don't allow demoting the last master.
  if (existing.role === 'master' && role !== 'master' && (await countMasters(db)) <= 1) {
    return new Response('cannot demote the last master', { status: 409 });
  }

  // Validate password BEFORE any write.
  const newPassword = typeof body.password === 'string' && body.password.length > 0
    ? body.password
    : null;
  if (newPassword !== null && newPassword.length < 8) {
    return new Response('password too short', { status: 400 });
  }

  // Perform writes.
  await updateUserProfile(db, id, { name, role });
  if (newPassword !== null) {
    const { hash, salt } = await hashPassword(newPassword);
    await updateUserPassword(db, id, hash, salt);
  }

  return Response.json({
    id,
    email: existing.email,
    role,
    name,
    created_at: existing.created_at,
  });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  const db = locals.runtime.env.DB;
  const id = params.id!;

  // Block self-delete.
  if (id === locals.user?.id) {
    return new Response('cannot delete your own account', { status: 409 });
  }

  const existing = await getUserById(db, id);
  if (!existing) return new Response(null, { status: 204 });

  if (existing.role === 'master' && (await countMasters(db)) <= 1) {
    return new Response('cannot delete the last master', { status: 409 });
  }
  if ((await countArticlesByAuthor(db, id)) > 0) {
    return new Response('user has articles; reassign or delete them first', { status: 409 });
  }

  await deleteUser(db, id);
  return new Response(null, { status: 204 });
};
