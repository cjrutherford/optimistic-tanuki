import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import {
  ComplianceAuditLogEntity,
  VaultDocumentEntity,
} from '@optimistic-tanuki/business-security';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AuditLedgerController } from './audit-ledger.controller';
import { AuditLedgerService } from './audit-ledger.service';
import { VaultDocumentController } from './vault-document.controller';
import { VaultDocumentService } from './vault-document.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'compliance_audit',
      factory: loadDatabase,
    }),
  ],
  controllers: [AuditLedgerController, VaultDocumentController],
  providers: [
    AuditLedgerService,
    VaultDocumentService,
    {
      provide: getRepositoryToken(VaultDocumentEntity),
      useFactory: (ds: DataSource) => ds.getRepository(VaultDocumentEntity),
      inject: ['COMPLIANCE_AUDIT_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ComplianceAuditLogEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(ComplianceAuditLogEntity),
      inject: ['COMPLIANCE_AUDIT_CONNECTION'],
    },
  ],
})
export class AppModule {}
