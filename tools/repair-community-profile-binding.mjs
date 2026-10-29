#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
import { readFile, mkdir, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function planBindings(members, profiles, scope) {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const result = [];
  for (const m of members) {
    if (m.status !== 'approved') continue;
    const source = byId.get(m.profileId);
    if (!source || source.userId !== m.userId)
      throw new Error(
        'Approved membership has missing or wrong-account profile'
      );
    if (source.appScope !== 'global') continue;
    const targets = profiles.filter(
      (p) => p.userId === m.userId && p.appScope === scope
    );
    if (targets.length !== 1)
      throw new Error('Legacy membership requires exactly one target profile');
    result.push({ member: m, source, target: targets[0] });
  }
  if (result.length > 10) throw new Error('Candidate limit exceeded');
  return result;
}

function argumentsFor(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (
      ![
        '--community-slug',
        '--app-scope',
        '--expected-count',
        '--apply',
      ].includes(key) ||
      key in opts
    )
      throw new Error('Invalid or duplicate argument');
    opts[key] = key === '--apply' ? true : argv[++i];
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts['--community-slug'] || '') ||
    opts['--community-slug'].length > 255
  )
    throw new Error('Invalid community slug');
  if (!['client-interface', 'local-hub'].includes(opts['--app-scope']))
    throw new Error('Invalid app scope');
  if (opts['--apply'] && !/^(?:[0-9]|10)$/.test(opts['--expected-count'] ?? ''))
    throw new Error('Apply requires --expected-count between 0 and 10');
  if (!opts['--apply'] && opts['--expected-count'] !== undefined)
    throw new Error('--expected-count requires --apply');
  return opts;
}
async function durableFile(path, value) {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
    await file.sync();
  } finally {
    await file.close();
  }
}
async function main() {
  const opts = argumentsFor(process.argv.slice(2));
  let env = {};
  try {
    env = dotenv.parse(await readFile('.env'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error('Cannot read local .env');
  }
  const config = {
    host: '127.0.0.1',
    port: 5432,
    user: process.env.POSTGRES_USER || env.POSTGRES_USER || 'postgres',
    password:
      process.env.POSTGRES_PASSWORD || env.POSTGRES_PASSWORD || 'postgres',
    connectionTimeoutMillis: 10000,
    statement_timeout: 20000,
  };
  const social = new pg.Client({ ...config, database: 'ot_social' });
  const profile = new pg.Client({ ...config, database: 'ot_profile' });
  let socialTx = false,
    profileTx = false;
  try {
    await social.connect();
    await profile.connect();
    await social.query(opts['--apply'] ? 'BEGIN' : 'BEGIN READ ONLY');
    socialTx = true;
    await profile.query(opts['--apply'] ? 'BEGIN' : 'BEGIN READ ONLY');
    profileTx = true;
    // A table-level SHARE lock excludes concurrent profile inserts and updates; row locks
    // retain the exact verified identities until the social commit has completed.
    if (opts['--apply'])
      await profile.query('LOCK TABLE profile IN SHARE MODE');
    const communities = await social.query(
      `SELECT id, slug, "appScope", "isPrivate", "joinPolicy", "ownerId", "ownerProfileId", "managerId", "managerProfileId", "memberCount" FROM community WHERE slug=$1 ${
        opts['--apply'] ? 'FOR UPDATE' : ''
      }`,
      [opts['--community-slug']]
    );
    if (communities.rowCount !== 1)
      throw new Error('Community not found or ambiguous');
    const community = communities.rows[0];
    const scope = opts['--app-scope'];
    if (
      community.appScope !== scope &&
      !(
        community.appScope === 'social' &&
        community.isPrivate === false &&
        community.joinPolicy === 'public'
      )
    )
      throw new Error('Community scope or legacy public policy mismatch');
    const members = await social.query(
      `SELECT id, "communityId", "userId", "profileId", role, status, "joinedAt" FROM community_member WHERE "communityId"=$1 AND status='approved' ORDER BY id LIMIT 11 ${
        opts['--apply'] ? 'FOR UPDATE' : ''
      }`,
      [community.id]
    );
    if (members.rowCount > 10)
      throw new Error('Approved membership safety limit exceeded');
    const ids = members.rows.map((m) => m.profileId),
      users = members.rows.map((m) => m.userId);
    const profiles = await profile.query(
      `SELECT id, "userId", "appScope" FROM profile WHERE id::text=ANY($1::text[]) OR ("userId"=ANY($2::text[]) AND "appScope"=$3) ORDER BY id ${
        opts['--apply'] ? 'FOR SHARE' : ''
      }`,
      [ids, users, scope]
    );
    const plan = planBindings(members.rows, profiles.rows, scope);
    if (!opts['--apply']) {
      console.log(
        JSON.stringify({
          mode: 'dry-run',
          communityScope: community.appScope,
          requestedScope: scope,
          approvedMemberships: members.rowCount,
          candidates: plan.length,
        })
      );
      return;
    }
    if (plan.length !== Number(opts['--expected-count']))
      throw new Error('Candidate count changed');
    const dir = resolve(
      '.runtime-artifacts/chat-send',
      `legacy-repair-${randomUUID()}`
    );
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await durableFile(`${dir}/before.json`, {
      version: 1,
      createdAt: new Date().toISOString(),
      slug: opts['--community-slug'],
      scope,
      community,
      bindings: plan,
    });
    for (const { member, target } of plan) {
      const updated = await social.query(
        'UPDATE community_member SET "profileId"=$1 WHERE id=$2 AND "communityId"=$3 AND "userId"=$4 AND "profileId"=$5 AND status=$6 RETURNING *',
        [
          target.id,
          member.id,
          community.id,
          member.userId,
          member.profileId,
          member.status,
        ]
      );
      if (updated.rowCount !== 1 || updated.rows[0].profileId !== target.id)
        throw new Error('Membership update/readback mismatch');
      for (const [accountField, profileField] of [
        ['ownerId', 'ownerProfileId'],
        ['managerId', 'managerProfileId'],
      ]) {
        if (
          community[accountField] === member.userId &&
          community[profileField] === member.profileId
        ) {
          const update = await social.query(
            `UPDATE community SET "${profileField}"=$1 WHERE id=$2 AND "${accountField}"=$3 AND "${profileField}"=$4 RETURNING "${profileField}"`,
            [target.id, community.id, member.userId, member.profileId]
          );
          if (
            update.rowCount !== 1 ||
            update.rows[0][profileField] !== target.id
          )
            throw new Error('Steward update/readback mismatch');
        }
      }
    }
    const afterCommunity = (
      await social.query(
        'SELECT id, slug, "appScope", "isPrivate", "joinPolicy", "ownerId", "ownerProfileId", "managerId", "managerProfileId", "memberCount" FROM community WHERE id=$1',
        [community.id]
      )
    ).rows[0];
    const afterMembers = (
      await social.query(
        'SELECT id, "communityId", "userId", "profileId", role, status, "joinedAt" FROM community_member WHERE id::text=ANY($1::text[]) ORDER BY id',
        [plan.map((p) => p.member.id)]
      )
    ).rows;
    if (
      afterMembers.length !== plan.length ||
      plan.some(
        (p) =>
          !afterMembers.some(
            (m) =>
              m.id === p.member.id &&
              m.userId === p.member.userId &&
              m.profileId === p.target.id &&
              m.status === p.member.status &&
              m.role === p.member.role
          )
      )
    )
      throw new Error('Final readback mismatch');
    await durableFile(`${dir}/after-before-commit.json`, {
      community: afterCommunity,
      members: afterMembers,
      note: 'Transactional readback; commit outcome must be independently verified.',
    });
    await social.query('COMMIT');
    socialTx = false;
    await profile.query('COMMIT');
    profileTx = false;
    await durableFile(`${dir}/committed.json`, {
      committedAt: new Date().toISOString(),
      candidateCount: plan.length,
    });
    console.log(
      JSON.stringify({ mode: 'apply', candidates: plan.length, receipt: dir })
    );
  } finally {
    if (socialTx) await social.query('ROLLBACK').catch(() => {});
    if (profileTx) await profile.query('ROLLBACK').catch(() => {});
    await social.end().catch(() => {});
    await profile.end().catch(() => {});
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch(() => {
    console.error(
      'Repair failed; transaction rolled back where possible. Check database state and private receipt before retrying.'
    );
    process.exitCode = 1;
  });
