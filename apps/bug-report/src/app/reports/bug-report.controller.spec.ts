import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BugReportController } from './bug-report.controller';
import { SubmitBugReportDto } from './bug-report.dto';
import { BugReportService } from './bug-report.service';
import { NonceService } from '../nonce/nonce.service';

const validPayload = () => ({
  nonce: 'a'.repeat(64),
  description: 'button broken',
  pageUrl: 'https://example.com/x',
  userAgent: 'jest',
  browserLogs: ['log line'],
  backendTraceIds: ['req-1'],
  screenshotDataUrl: 'data:image/jpeg;base64,/9j/',
  occurredAt: new Date().toISOString(),
});

describe('BugReportController', () => {
  let controller: BugReportController;
  let nonces: NonceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [BugReportController],
      providers: [
        NonceService,
        {
          provide: BugReportService,
          useValue: {
            submit: jest
              .fn()
              .mockResolvedValue({ id: '1', emailSent: true, issueUrl: null }),
          },
        },
      ],
    }).compile();
    controller = module.get(BugReportController);
    nonces = module.get(NonceService);
  });

  it('GET /nonce returns nonce without auth', async () => {
    const res = await controller.getNonce('1.2.3.4');
    expect(res.nonce).toMatch(/^[a-f0-9]{64}$/);
    // nonce is consumable once
    await expect(nonces.consume(res.nonce, '1.2.3.4')).resolves.toBe(true);
  });

  it('POST delegates to service after validation', async () => {
    const dto = plainToInstance(SubmitBugReportDto, validPayload());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    const res = await controller.submit(dto, '1.2.3.4', 'https://example.com');
    expect(res).toEqual({ id: '1', emailSent: true, issueUrl: null });
  });

  it('POST rejects oversized screenshot and long description', async () => {
    const bad = plainToInstance(SubmitBugReportDto, {
      ...validPayload(),
      description: 'x'.repeat(5001),
      screenshotDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(2_000_001),
    });
    const errors = await validate(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('POST rejects malformed nonce', async () => {
    const bad = plainToInstance(SubmitBugReportDto, {
      ...validPayload(),
      nonce: 'not-a-nonce',
    });
    const errors = await validate(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('nonce');
  });

  it('service throws on invalid nonce (integration of consume path)', async () => {
    const svc = new NonceService();
    await expect(svc.consume('b'.repeat(64), '1.1.1.1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
