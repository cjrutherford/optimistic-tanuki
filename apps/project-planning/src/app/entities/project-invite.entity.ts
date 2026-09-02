import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * An invitation to work on a project with somebody.
 *
 * There was a sketch of this in `apps/forgeofwill/src/app/project`: a TypeORM
 * entity inside the Angular client, with no table behind it, no service that
 * knew about it, and a route that answered 404. It is here because this is the
 * service that owns project data and decides who may reach it.
 *
 * Addressed to an email rather than a profile, because that is all you know
 * about somebody who has not arrived yet. Membership is by profile id, which
 * is what every access check compares, so the whole life of an invitation is
 * the distance between those two facts.
 */
@Entity()
// An address is invited to a project once. A second invitation while one is
// open would leave two rows that can be answered differently, and the code
// that reconciled them would be code nobody wanted to write.
@Index(['projectId', 'email'], { unique: true })
export class ProjectInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  /**
   * Stored folded to lower case.
   *
   * It is the key everything matches on, and an address kept as it was typed
   * fails to match the day somebody capitalises their own name differently.
   * Folding on the way in means there is one form of it in the table.
   */
  @Column()
  email: string;

  /** The profile that sent it. Only a project's owner may. */
  @Column()
  invitedBy: string;

  /**
   * What the link carries.
   *
   * Not a profile id and not the invitation's own id: at the moment of sending
   * there may be no profile to name, and an id that appears in a URL invites
   * somebody to try the next one along.
   */
  @Column({ unique: true })
  token: string;

  /**
   * PENDING until answered. ACCEPTED and DECLINED are the invitee's word,
   * REVOKED is the owner withdrawing it, whether before an answer or after.
   */
  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

  /**
   * The profile that turned out to be behind the address.
   *
   * Set when somebody signed in claims the invitation, which for a stranger
   * happens only once they have registered and a profile exists. Kept after
   * the answer, so the record says who actually decided rather than only that
   * a decision was made.
   */
  @Column({ nullable: true })
  claimedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  /** When it was answered or withdrawn. Null while it is still open. */
  @Column({ type: 'timestamp', nullable: true })
  respondedAt?: Date;
}
