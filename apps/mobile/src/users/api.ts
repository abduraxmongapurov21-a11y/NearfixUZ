import type { AuthorizedRequest } from '../messaging/api';
import type { UserIdentity } from '../types';

export async function discoverUsers(
  request: AuthorizedRequest,
  query: string,
  limit = 10,
): Promise<UserIdentity[]> {
  const parameters = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  const response = await request<{ users: UserIdentity[] }>(`/v1/users/discover?${parameters.toString()}`);
  return response.users;
}
