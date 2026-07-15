import { RpcException } from '@nestjs/microservices';
import { ArrayContains, FindOptionsWhere, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

/**
 * Ownership / membership helpers for the project-planning service.
 *
 * Identity for these checks is the caller's profile id, forwarded by the
 * gateway from the authenticated request context as `requestingUserId`. When
 * that value is absent the call is treated as a trusted internal/system call
 * (e.g. MCP agent tooling or seed scripts) and is left un-scoped. Every
 * externally reachable route always injects it, so authenticated HTTP callers
 * are always scoped.
 */

type ProjectOwnership = Pick<Project, 'owner' | 'members'>;

/** Returns true when the profile owns or is a member of the project. */
export function hasProjectAccess(
  project: ProjectOwnership | null | undefined,
  profileId: string
): boolean {
  if (!project) {
    return false;
  }
  return (
    project.owner === profileId || (project.members ?? []).includes(profileId)
  );
}

/** Throws a 403 RpcException when the profile has no access to the project. */
export function assertProjectAccess(
  project: ProjectOwnership | null | undefined,
  profileId: string
): void {
  if (!hasProjectAccess(project, profileId)) {
    throw new RpcException({
      statusCode: 403,
      message: 'Forbidden: you do not have access to this project',
    });
  }
}

/** Throws a 404 RpcException when the resource could not be found. */
export function assertFound<T>(
  resource: T | null | undefined,
  message = 'Resource not found'
): T {
  if (!resource) {
    throw new RpcException({ statusCode: 404, message });
  }
  return resource;
}

/**
 * Builds an OR where clause restricting projects to those the profile owns or
 * is a member of, preserving any additional filter criteria in `base`.
 */
export function accessibleProjectWhere(
  base: FindOptionsWhere<Project>,
  profileId: string
): FindOptionsWhere<Project>[] {
  return [
    { ...base, owner: profileId },
    { ...base, members: ArrayContains([profileId]) },
  ];
}

/** Loads the ids of every project the profile can access. */
export async function getAccessibleProjectIds(
  projectRepository: Repository<Project>,
  profileId: string
): Promise<string[]> {
  const projects = await projectRepository.find({
    where: accessibleProjectWhere({}, profileId),
    select: ['id'],
  });
  return projects.map((project) => project.id);
}
