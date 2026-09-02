import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PersonaTelos {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column('text', { array: true })
  goals: string[];

  @Column('text', { array: true })
  skills: string[];

  @Column('text', { array: true })
  interests: string[];

  @Column('text', { array: true })
  limitations: string[];

  @Column('text', { array: true })
  strengths: string[];

  @Column('text', { array: true })
  objectives: string[];

  @Column()
  coreObjective: string;

  @Column('text', { array: true })
  exampleResponses: string[];

  @Column()
  promptTemplate: string;

  /**
   * What this persona is allowed to do, as coarse capabilities.
   *
   * Choosing who you are talking to is meant to choose what can be done, not
   * only who is speaking. These are capabilities rather than tool names on
   * purpose: a record naming twenty seven tools is unreadable, breaks the day
   * a tool is renamed, and leaves a newly added tool belonging to nobody. A
   * capability keeps meaning what it meant.
   *
   * Empty means this persona can look but not act. Null means no scope has
   * been decided and every tool is available, which is what every record
   * carried before this column existed.
   */
  @Column('text', { array: true, nullable: true })
  capabilities?: string[] | null;
}
