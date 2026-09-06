import { AppController } from './app.controller';

describe('AppController', () => {
  it('healthz returns an ok status', () => {
    const controller = new AppController();
    expect(controller.healthz()).toEqual({ status: 'ok' });
  });
});
