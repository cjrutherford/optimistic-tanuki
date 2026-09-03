import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { MicroserviceExceptionFilter } from './microservice-exception.filter';

/**
 * A refusal has to reach the caller as a refusal.
 *
 * The gateway had no filter at all, so everything a microservice raised became
 * a 500. Somebody reaching a project they have no access to was told the
 * server had broken, and two reviewers racing to approve the same change both
 * saw a fault rather than "somebody already decided this". The services were
 * saying the right thing and nothing was listening.
 */
describe('MicroserviceExceptionFilter', () => {
  function catchIt(exception: unknown) {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    };
    new MicroserviceExceptionFilter().catch(exception, host as never);
    return {
      status: response.status.mock.calls[0][0],
      body: response.json.mock.calls[0][0],
    };
  }

  it('carries the status an RpcException asked for', () => {
    // The convention in project-planning's access helpers.
    const thrown = new RpcException({
      statusCode: 403,
      message: 'Forbidden: you do not have access to this project',
    });

    const { status, body } = catchIt(thrown);

    expect(status).toBe(403);
    expect(body.message).toMatch(/do not have access/);
  });

  it.each([400, 404, 409])('carries a %s through', (statusCode) => {
    const { status } = catchIt(new RpcException({ statusCode, message: 'x' }));

    expect(status).toBe(statusCode);
  });

  it('keeps an HttpException raised in the gateway itself', () => {
    const { status, body } = catchIt(
      new HttpException('Nope', HttpStatus.BAD_REQUEST)
    );

    expect(status).toBe(400);
    expect(body.message).toBe('Nope');
  });

  it('leaves anything unclassified as a fault', () => {
    // An error nobody labelled is a fault until somebody says otherwise.
    const { status } = catchIt(new Error('the database fell over'));

    expect(status).toBe(500);
  });

  it('does not take a status from something that is not one', () => {
    const { status } = catchIt({ statusCode: 'teapot', message: 'x' });

    expect(status).toBe(500);
  });
});
