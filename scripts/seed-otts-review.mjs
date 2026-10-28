#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const base = new URL(
  process.env.HOST_GATEWAY_BASE_URL || 'http://127.0.0.1:3000'
);
if (
  process.env.DEV_SEED_SCOPE !== 'ot-ts' ||
  base.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost'].includes(base.hostname)
)
  throw Error(
    'OT/TS review seeding requires the explicit local development scope'
  );
const statePath = path.resolve(
  '.runtime-artifacts/local-dev/otts-review-fixtures.json'
);
let state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : {};
const registryResponse = await fetch(new URL('/api/registry/apps', base), {
  signal: AbortSignal.timeout(15000),
});
if (!registryResponse.ok) throw Error('Local app registry is unavailable');
const registryBody = await registryResponse.json();
const apps = registryBody.data?.apps || registryBody.apps || registryBody.data;
const unwrap = (value) => {
  for (
    let i = 0;
    i < 5 &&
    value?.data &&
    !value.id &&
    !value.userId &&
    !value.newToken &&
    !value.token;
    i++
  )
    value = value.data;
  return value;
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
async function request(app, method, route, token, body, allow = []) {
  const entry = apps.find((a) => a.appId === app);
  if (!entry) throw Error('Review app missing from the registry');
  const response = await fetch(new URL('/api' + route, base), {
    method,
    headers: {
      'content-type': 'application/json',
      'x-ot-appscope': app,
      'x-ot-app-id': app,
      'x-ot-session-mode': 'bearer',
      origin: new URL(entry.uiBaseUrl).origin,
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !allow.includes(response.status)) {
    const detail =
      route === '/social/community' ? unwrap(payload)?.message : undefined;
    throw Error(
      `Review seed HTTP ${response.status}: ${method} ${route}` +
        (detail ? ' ' + JSON.stringify(detail).slice(0, 500) : '')
    );
  }
  return { status: response.status, data: unwrap(payload) };
}
async function account(kind) {
  const email = process.env[`OT_TS_REVIEW_${kind}_EMAIL`],
    password = process.env[`OT_TS_REVIEW_${kind}_PASSWORD`];
  if (!email?.endsWith('@example.test') || !password)
    throw Error('Private synthetic review credentials are missing');
  let login = await request(
    'client-interface',
    'POST',
    '/authentication/login',
    null,
    { email, password },
    [400, 401, 403, 404, 500]
  );
  if (login.status !== 201 && login.status !== 200) {
    if (state[kind]?.userId)
      throw Error(
        'Existing review account is unavailable; refusing to reset or recreate it'
      );
    await request(
      'client-interface',
      'POST',
      '/authentication/register',
      null,
      {
        email,
        password,
        confirm: password,
        fn: 'Review',
        ln: kind === 'OWNER' ? 'Owner' : 'Member',
        dateOfBirth: '1990-01-01',
        bio: 'Synthetic local development review account. Not a real person.',
      }
    );
    login = await request(
      'client-interface',
      'POST',
      '/authentication/login',
      null,
      { email, password }
    );
  }
  const sessions = {};
  for (const app of ['client-interface', 'local-hub']) {
    const result =
      app === 'client-interface'
        ? login
        : await request(app, 'POST', '/authentication/login', null, {
            email,
            password,
          });
    const token = result.data.newToken || result.data.token;
    if (typeof token !== 'string')
      throw Error('Authenticated review token is missing');
    const session = (
      await request(app, 'GET', '/authentication/session', token)
    ).data;
    const claim = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    );
    if (
      !uuid.test(session.userId) ||
      !uuid.test(session.profileId) ||
      claim.appId !== app ||
      claim.userId !== session.userId ||
      claim.profileId !== session.profileId
    )
      throw Error('Review session binding invalid');
    sessions[app] = { token, ...session };
  }
  if (sessions['client-interface'].userId !== sessions['local-hub'].userId)
    throw Error('Cross-product account mismatch');
  return { userId: sessions['local-hub'].userId, sessions };
}
const owner = await account('OWNER'),
  member = await account('MEMBER');
if (owner.userId === member.userId)
  throw Error('Review counterpart must be a distinct account');
const token = owner.sessions['local-hub'].token,
  memberToken = member.sessions['local-hub'].token;
const persist = () => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', {
    mode: 0o600,
  });
};
if (state.OWNER?.userId && state.OWNER.userId !== owner.userId)
  throw Error(
    'Review owner changed; retained fixture state cannot be reassigned'
  );
state.OWNER = { userId: owner.userId };
state.MEMBER = { userId: member.userId };
persist();
let city = state.cityId
  ? (
      await request(
        'local-hub',
        'GET',
        '/social/community/' + state.cityId,
        token,
        undefined,
        [404]
      )
    ).data
  : null;
if (!city?.id)
  city = (
    await request('local-hub', 'POST', '/social/community', token, {
      name: 'Development Review City',
      slug: 'dev-review-' + owner.userId.slice(0, 8),
      description:
        'Synthetic place for local OT/TS review, not a real locality.',
      localityType: 'city',
      city: 'Development Review City',
      countryCode: 'USA',
      adminArea: 'Development fixture',
      isPrivate: false,
      joinPolicy: 'public',
    })
  ).data;
if (!uuid.test(city.id)) throw Error('Review community identifier missing');
state.cityId = city.id;
state.citySlug = city.slug;
persist();
const members = (
  await request(
    'local-hub',
    'GET',
    '/social/community/' + city.id + '/members',
    token
  )
).data;
if (!Array.isArray(members)) throw Error('Review membership readback invalid');
let membership = members.find(
  (m) => m.profileId === member.sessions['local-hub'].profileId
);
if (!membership)
  membership = (
    await request(
      'local-hub',
      'POST',
      '/social/community/' + city.id + '/join',
      memberToken
    )
  ).data;
if (membership.status === 'pending')
  await request(
    'local-hub',
    'POST',
    '/social/community/members/' + membership.id + '/approve',
    token
  );
else if (membership.status !== 'approved')
  throw Error(
    'Existing review membership is not approved; refusing an implicit reset'
  );
let listing = state.listingId
  ? (
      await request(
        'local-hub',
        'GET',
        '/classifieds/' + state.listingId,
        token,
        undefined,
        [404]
      )
    ).data
  : null;
if (!listing?.id)
  listing = (
    await request('local-hub', 'POST', '/classifieds', token, {
      title: 'Development Review Bicycle',
      description:
        'Synthetic listing for local UI review. No real item or transaction.',
      price: 125,
      currency: 'USD',
      category: 'for-sale',
      communityId: city.id,
    })
  ).data;
if (!uuid.test(listing.id) || listing.userId !== owner.userId)
  throw Error('Review listing ownership not established');
state.listingId = listing.id;
persist();
const conversation = (
  await request(
    'local-hub',
    'POST',
    '/chat/conversations/direct/get-or-create',
    token,
    { recipientProfileId: member.sessions['local-hub'].profileId }
  )
).data;
if (!uuid.test(conversation.id))
  throw Error('Review conversation identifier missing');
state = {
  OWNER: { userId: owner.userId },
  MEMBER: { userId: member.userId },
  cityId: city.id,
  citySlug: city.slug,
  listingId: listing.id,
  conversationId: conversation.id,
  synthetic: true,
  credentialsFile: '.env',
  apps: ['client-interface', 'local-hub'],
};
fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', {
  mode: 0o600,
});
console.log(
  'OT/TS review accounts authenticated in both apps; synthetic locality, listing and direct conversation verified. Credentials remain private in .env.'
);
