const AuthCommands = {
  Login: 'Login',
  EnableMultiFactor: 'EnableMultiFactor',
  ResetPassword: 'ResetPassword',
  Register: 'Register',
  Validate: 'Validate',
  UserIdFromEmail: 'UserIdFromEmail',
  // Issue a new token for a user (e.g. after profile creation). Payload: { userId, profileId? }
  Issue: 'Issue',
  ValidateTotp: 'ValidateTotp',
  // Invalidate a token on logout. Payload: { token }
  Logout: 'Logout',
};

export default AuthCommands;
