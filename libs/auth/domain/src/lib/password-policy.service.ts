import { timingSafeEqual } from 'crypto';

export class PasswordPolicyService {
  private readonly strongPasswordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

  ensureStrongPassword(password: string) {
    if (!this.strongPasswordRegex.test(password)) {
      throw new Error('Password is too weak');
    }
  }

  ensurePasswordConfirmation(password: string, confirmation: string) {
    this.ensureStrongPassword(password);

    const passwordBuffer = Buffer.from(password);
    const confirmationBuffer = Buffer.from(confirmation);

    if (passwordBuffer.byteLength !== confirmationBuffer.byteLength) {
      throw new Error('Passwords do not match');
    }

    const matches = timingSafeEqual(
      new Uint8Array(
        passwordBuffer.buffer,
        passwordBuffer.byteOffset,
        passwordBuffer.byteLength,
      ),
      new Uint8Array(
        confirmationBuffer.buffer,
        confirmationBuffer.byteOffset,
        confirmationBuffer.byteLength,
      ),
    );

    if (!matches) {
      throw new Error('Passwords do not match');
    }
  }
}
