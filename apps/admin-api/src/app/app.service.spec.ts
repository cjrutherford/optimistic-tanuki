import { AppService } from './app.service';

describe('AppService', () => {
  it('getHealth returns an ok status', () => {
    const service = new AppService();
    expect(service.getHealth()).toEqual({ status: 'ok' });
  });
});
