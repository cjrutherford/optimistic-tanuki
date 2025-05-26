import AuthCommands from './authentication';
describe('AuthCommands', () => {

    it('should have a Login command', () => {
        expect(AuthCommands.Login).toBe('Login');
    });

    it('should have an EnableMultiFactor command', () => {
        expect(AuthCommands.EnableMultiFactor).toBe('EnableMultiFactor');
    });

    it('should have a ResetPassword command', () => {
        expect(AuthCommands.ResetPassword).toBe('ResetPassword');
    });

    it('should have a Register command', () => {
        expect(AuthCommands.Register).toBe('Register');
    });

    it('should have a Validate command', () => {
        expect(AuthCommands.Validate).toBe('Validate');
    });

    it('should have a ValidateTotp command', () => {
        expect(AuthCommands.ValidateTotp).toBe('ValidateTotp');
    });
});