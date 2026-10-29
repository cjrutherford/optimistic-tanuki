import { RegisterSubmitType } from './register-types';

export default interface RegisterRequest {
  email: string;
  password: string;
  fn: string;
  ln: string;
  confirm: string;
  bio?: string;
  dateOfBirth?: string;
  guardianEmail?: string;
  guardianResumeToken?: string;
  guardianConsentRequest?: boolean;
}

export const submitTypeToRegisterRequest = (
  data: RegisterSubmitType
): RegisterRequest => {
  return {
    email: data.email,
    password: data.password,
    fn: data.firstName,
    ln: data.lastName,
    confirm: data.confirmation,
    bio: data.bio || '',
    dateOfBirth: data.dateOfBirth,
    guardianEmail: data.guardianEmail,
    guardianResumeToken: data.guardianResumeToken,
    guardianConsentRequest: data.guardianConsentRequest,
  };
};
