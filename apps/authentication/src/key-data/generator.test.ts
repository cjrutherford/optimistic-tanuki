import KeyGenerator from './generator';

describe('KeyGenerator', () => {
    let keyGenerator: KeyGenerator;

    beforeAll(() => {
        keyGenerator = new KeyGenerator('/path/to/private/key');
    });

    describe('generateSalt', () => {
        it('should generate a salt of length 32 characters', () => {
            const salt = keyGenerator.generateSalt();
            expect(salt).toHaveLength(32);
        });

        it('should generate a salt that is a hexadecimal string', () => {
            const salt = keyGenerator.generateSalt();
            const hexRegex = /^[0-9a-fA-F]+$/;
            expect(salt).toMatch(hexRegex);
        });

        it('should generate different salts on subsequent calls', () => {
            const salt1 = keyGenerator.generateSalt();
            const salt2 = keyGenerator.generateSalt();
            expect(salt1).not.toBe(salt2);
        });
    });
});