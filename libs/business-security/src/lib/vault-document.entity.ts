import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VaultDocumentKind } from '@optimistic-tanuki/models';

export const VAULT_DOCUMENT_KINDS: readonly VaultDocumentKind[] = [
  'transcript',
  'tax_schedule',
  'other',
];

/**
 * The text of one confidential practice document, keyed to the tenant that
 * owns it.
 *
 * This table exists because the vault drop used to hash the upload, seal the
 * hash in the audit chain, and throw the bytes away. Nothing downstream could
 * then read the document it had just been asked about, so the copilot could only
 * ever answer from the question it was given.
 *
 * `(tenantId, documentId)` is unique so a re-drop replaces the text rather than
 * accumulating copies, and the pair is the only key the retrieval path accepts:
 * a lookup always carries the tenant, so a document id on its own addresses
 * nothing. Row level security is added in the migration, matching
 * `compliance_audit_logs`, so a query that forgets the tenant predicate reads
 * no rows rather than another tenant's.
 */
@Index('IDX_vault_documents_tenant_document', ['tenantId', 'documentId'], {
  unique: true,
})
@Entity('vault_documents')
export class VaultDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  documentId: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType: string;

  /**
   * How the content was classified at ingest, by reading it rather than by
   * trusting the file name. A caller cannot ask for a document to be a
   * transcript and have it believed.
   */
  @Column({ type: 'varchar', length: 32, default: 'other' })
  kind: string;

  @Column({ type: 'varchar', length: 64 })
  documentHash: string;

  /**
   * Extracted plain text, empty when the upload was a format this service
   * cannot read without a document-conversion dependency. Empty is recorded as
   * empty: retrieval reports such a document as having no readable text, which
   * is the truth, rather than answering from nothing.
   */
  @Column({ type: 'text', default: '' })
  contentText: string;

  @CreateDateColumn()
  createdAt: Date;
}
