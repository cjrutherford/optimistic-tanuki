import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  FLOW_CALCULATE_ESTIMATE,
  FLOW_CREATE_BOOKING,
  FLOW_PROCESS_DEPOSIT,
  FLOW_GET_STATUS,
  FLOW_GET_AVAILABILITY,
  FlowCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateEstimateDto,
  CreateBookingDto,
  CreateFlowAvailabilityDto,
  DepositPaymentDto,
  SyncFlowDto,
} from '@optimistic-tanuki/models';
import { OPTIONAL_TENANT_KEY } from '@optimistic-tanuki/business-security';
import {
  TenantContextGuard,
  TenantResolverService,
} from '../../guards/tenant-context.guard';
import { FlowController } from './flow.controller';

type HttpTestResponse = {
  statusCode: number;
  body: unknown;
};

function injectHttpRequest(
  app: INestApplication,
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: Record<string, unknown>
): Promise<HttpTestResponse> {
  return new Promise((resolve, reject) => {
    const expressApp = app.getHttpAdapter().getInstance() as {
      handle: (
        req: Record<string, unknown>,
        res: Record<string, unknown>,
        next?: (error?: unknown) => void
      ) => void;
    };
    const requestHeaders = {
      ...headers,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    };
    const req = {
      method,
      url: path,
      originalUrl: path,
      path,
      body,
      query: {},
      headers: requestHeaders,
      socket: {},
      get(headerName: string) {
        return this.headers[headerName.toLowerCase()];
      },
    };
    const res = {
      statusCode: 200,
      headersSent: false,
      headers: {} as Record<string, string>,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      json(payload: unknown) {
        this.body = payload;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      send(payload: unknown) {
        this.body = payload;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      end(payload?: unknown) {
        this.body = payload ?? this.body;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: this.body });
        return this;
      },
    };

    try {
      expressApp.handle(req, res, (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ statusCode: res.statusCode, body: res.body });
      });
    } catch (error) {
      reject(error);
    }
  });
}

describe('FlowController', () => {
  const requestContext = {
    tenantId: 'wirepro-electrical',
    tenantContext: {
      tenantId: 'wirepro-electrical',
      matchedBy: 'host' as const,
      matchedValue: 'wirepro.hopefulaspirationsindustries.com',
      tenant: {
        tenantId: 'wirepro-electrical',
        name: 'WirePro Electrical Services',
        hostPatterns: [],
        cnameDomains: [],
      },
    },
  };

  let controller: FlowController;
  let leadTrackerClient: jest.Mocked<ClientProxy>;
  let paymentsClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    leadTrackerClient = {
      send: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    paymentsClient = {
      send: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowController],
      providers: [
        {
          provide: ServiceTokens.LEAD_SERVICE,
          useValue: leadTrackerClient,
        },
        {
          provide: ServiceTokens.PAYMENTS_SERVICE,
          useValue: paymentsClient,
        },
      ],
    }).compile();

    controller = module.get<FlowController>(FlowController);
  });

  describe('calculateEstimate', () => {
    it('should dispatch estimate calculation to lead tracker', async () => {
      const dto: CreateEstimateDto = {
        serviceId: 'paint-correction',
        servicePackage: 'paint-correction',
        size: 'midsize',
        condition: 'moderate',
        squareFootage: 500,
        tradeType: 'Mobile Detailing',
      };
      const expectedResult = {
        estimateId: 'est-123',
        serviceId: 'paint-correction',
        serviceName: 'Paint Correction',
        basePrice: 120,
        conditionMultiplier: 1.15,
        subtotal: 241.5,
        taxAmount: 16.91,
        depositRequired: 50,
        total: 258.41,
        currency: 'USD',
        expiresAt: '2026-10-24T00:00:00.000Z',
      };

      leadTrackerClient.send.mockReturnValue(of(expectedResult));

      const result = await controller.calculateEstimate(dto, requestContext);
      expect(leadTrackerClient.send).toHaveBeenCalledWith(
        FLOW_CALCULATE_ESTIMATE,
        expect.objectContaining({
          ...dto,
          tenantId: requestContext.tenantId,
          tenantContext: requestContext.tenantContext,
        })
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createBooking', () => {
    it('should dispatch booking creation to lead tracker', async () => {
      const dto: CreateBookingDto = {
        serviceId: 'house-wash',
        servicePackage: 'house-wash',
        customerName: 'Marcus Bennett',
        customerPhone: '(912) 555-0142',
        customerEmail: 'marcus@example.com',
        serviceAddress: '142 Bull St, Savannah, GA 31401',
        scheduledDate: '2026-10-15',
        arrivalWindow: '08:00 - 10:00 AM',
      };
      const expectedBooking = {
        bookingId: 'lead-booking-uuid',
        status: 'scheduled',
        customerName: 'Marcus Bennett',
      };

      leadTrackerClient.send.mockReturnValue(of(expectedBooking));

      const result = await controller.createBooking(dto, requestContext);
      expect(leadTrackerClient.send).toHaveBeenCalledWith(
        FLOW_CREATE_BOOKING,
        expect.objectContaining({
          ...dto,
          tenantId: requestContext.tenantId,
          tenantContext: requestContext.tenantContext,
        })
      );
      expect(result).toEqual(expectedBooking);
    });
  });

  describe('processDeposit', () => {
    it('should dispatch deposit payment intent to payments service', async () => {
      const dto: DepositPaymentDto = {
        bookingId: 'lead-booking-uuid',
        idempotencyKey: 'deposit-key-1',
      };
      const expectedPayment = {
        success: true,
        paymentIntentId: 'pi_test_123',
        status: 'succeeded',
        smsConfirmation: { dispatched: true, sid: 'SM123' },
      };

      paymentsClient.send.mockReturnValue(of(expectedPayment));

      const result = await controller.processDeposit(dto, requestContext);
      expect(paymentsClient.send).toHaveBeenCalledWith(
        FLOW_PROCESS_DEPOSIT,
        expect.objectContaining({
          ...dto,
          tenantId: requestContext.tenantId,
          tenantContext: requestContext.tenantContext,
        })
      );
      expect(result).toEqual(expectedPayment);
    });
  });

  describe('sync', () => {
    it('forwards the typed sync payload exactly once', async () => {
      const dto = {
        items: [
          {
            id: 'sync-1',
            type: 'booking',
            payload: { bookingId: 'booking-1' },
            timestamp: 1720000000000,
            synced: false,
            attempts: 0,
            idempotencyKey: 'booking-key-1',
          },
        ],
      } as unknown as SyncFlowDto;
      const expectedResult = { acknowledgedIds: ['sync-1'] };
      leadTrackerClient.send.mockReturnValue(of(expectedResult));

      const result = await controller.sync(dto, requestContext);

      expect(leadTrackerClient.send).toHaveBeenCalledTimes(1);
      expect(leadTrackerClient.send).toHaveBeenCalledWith(
        FlowCommands.SYNC,
        expect.objectContaining({
          ...dto,
          tenantId: requestContext.tenantId,
          tenantContext: requestContext.tenantContext,
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it('rejects incomplete nested sync payloads through validation', async () => {
      const errors = await validate(
        plainToInstance(SyncFlowDto, { items: [{ id: 'x' }] }),
        { whitelist: true, forbidNonWhitelisted: true }
      );

      expect(errors.some((error) => error.property === 'items')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should dispatch getStatus to lead tracker', async () => {
      const expectedStatus = {
        id: 'lead-booking-uuid',
        bookingId: 'lead-booking-uuid',
        status: 'in_progress',
        customerName: 'Marcus Bennett',
        serviceName: 'Full Exterior House Wash',
        serviceAddress: '142 Bull St, Savannah, GA 31401',
        scheduledDate: '2026-10-15',
        arrivalWindow: '08:00 - 10:00 AM',
        depositPaid: true,
        totalAmount: 320,
        reviewPromptEligible: false,
        updatedAt: '2026-09-24T12:00:00.000Z',
      };

      leadTrackerClient.send.mockReturnValue(of(expectedStatus));

      const result = await controller.getStatus(
        'lead-booking-uuid',
        requestContext
      );
      expect(leadTrackerClient.send).toHaveBeenCalledWith(
        FLOW_GET_STATUS,
        expect.objectContaining({
          id: 'lead-booking-uuid',
          tenantId: requestContext.tenantId,
          tenantContext: requestContext.tenantContext,
        })
      );
      expect(result).toEqual(expectedStatus);
    });
  });

  it('returns the server-resolved profile ID for client initialization', () => {
    expect(controller.getCurrentTenant(requestContext)).toEqual(
      expect.objectContaining({
        tenantId: requestContext.tenantId,
        profileId: requestContext.tenantId,
      })
    );
  });

  it('rejects operational methods without a resolved tenant context', async () => {
    await expect(
      controller.getStatus('lead-booking-uuid', {} as never)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not mark the flow controller as an optional-tenant route', () => {
    expect(
      Reflect.getMetadata(OPTIONAL_TENANT_KEY, FlowController)
    ).toBeUndefined();
  });

  it('forwards availability with the resolved tenant context', async () => {
    const dto: CreateFlowAvailabilityDto = {
      serviceId: 'standard',
      servicePackage: 'standard',
      date: '2099-10-01',
    };
    const expected = { date: dto.date, windows: [] };
    leadTrackerClient.send.mockReturnValue(of(expected));

    const result = await controller.getAvailability(dto, requestContext);

    expect(leadTrackerClient.send).toHaveBeenCalledWith(
      FLOW_GET_AVAILABILITY,
      expect.objectContaining({
        ...dto,
        tenantId: requestContext.tenantId,
        tenantContext: requestContext.tenantContext,
      })
    );
    expect(result).toEqual(expected);
  });

  it('rejects client authority fields through the HTTP validation pipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          serviceId: 'standard',
          servicePackage: 'standard',
          size: 'midsize',
          condition: 'moderate',
          tenantId: 'client-controlled',
        },
        { type: 'body', metatype: CreateEstimateDto }
      )
    ).rejects.toBeInstanceOf(Error);
  });

  describe('HTTP tenant resolution', () => {
    let app: INestApplication;
    let leadTrackerClient: jest.Mocked<ClientProxy>;
    let paymentsClient: jest.Mocked<ClientProxy>;

    beforeEach(async () => {
      leadTrackerClient = {
        send: jest.fn(),
        emit: jest.fn(),
      } as unknown as jest.Mocked<ClientProxy>;
      paymentsClient = {
        send: jest.fn(),
        emit: jest.fn(),
      } as unknown as jest.Mocked<ClientProxy>;

      const moduleRef = await Test.createTestingModule({
        controllers: [FlowController],
        providers: [
          {
            provide: ServiceTokens.LEAD_SERVICE,
            useValue: leadTrackerClient,
          },
          {
            provide: ServiceTokens.PAYMENTS_SERVICE,
            useValue: paymentsClient,
          },
          TenantResolverService,
          TenantContextGuard,
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        })
      );
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('resolves the tenant and returns the server profile over HTTP', async () => {
      const response = await injectHttpRequest(
        app,
        'GET',
        '/api/v1/flow/tenant',
        { host: 'wirepro.hopefulaspirationsindustries.com' }
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          tenantId: 'wirepro-electrical',
          profileId: 'wirepro-electrical',
          matchedBy: 'host',
        })
      );
    });

    it('propagates the resolved tenant context to the lead service over HTTP', async () => {
      leadTrackerClient.send.mockReturnValue(of({ estimateId: 'estimate-1' }));
      const body = {
        serviceId: 'standard',
        servicePackage: 'standard',
        size: 'midsize',
        condition: 'moderate',
      };

      const response = await injectHttpRequest(
        app,
        'POST',
        '/api/v1/flow/estimates',
        { host: 'wirepro.hopefulaspirationsindustries.com' },
        body
      );

      expect(response.statusCode).toBe(200);
      expect(leadTrackerClient.send).toHaveBeenCalledWith(
        FLOW_CALCULATE_ESTIMATE,
        expect.objectContaining({
          ...body,
          tenantId: 'wirepro-electrical',
          tenantContext: expect.objectContaining({
            tenantId: 'wirepro-electrical',
          }),
        })
      );
    });

    it('rejects an unknown host before reaching the lead service', async () => {
      const response = await injectHttpRequest(
        app,
        'GET',
        '/api/v1/flow/status/booking-1',
        { host: 'unknown.example.com' }
      );

      expect(response.statusCode).toBe(404);
      expect(leadTrackerClient.send).not.toHaveBeenCalled();
    });
  });
});
