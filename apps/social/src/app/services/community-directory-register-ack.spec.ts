import { acknowledgeDirectoryRegister } from './community-directory-register-ack';

describe('register ACK boundary', () => {
  it('fails closed while commit and current authority cannot be established', () => {
    expect(() => acknowledgeDirectoryRegister()).toThrow(
      'Directory register acknowledgement is unavailable'
    );
  });
});
