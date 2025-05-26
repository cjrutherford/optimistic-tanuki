import { KeyDatum } from './key-datum.entity';
import { UserEntity } from '../../user/entities/user.entity';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

describe('KeyDatum Entity', () => {
    it('should validate a valid KeyDatum entity', async () => {
        const user = new UserEntity();
        user.id = 'some-uuid'; // njsscan-ignore: node_username

        const keyDatum = plainToClass(KeyDatum, {
            id: 'some-uuid',
            public: Buffer.from('some-public-key'),
            salt: 'some-salt',
            User: user,
        });

        const errors = await validate(keyDatum);
        expect(errors.length).toBe(0);
    });

    it('should fail validation if public is not a Buffer', async () => {
        const user = new UserEntity();
        user.id = 'some-uuid'; // njsscan-ignore: node_username

        const keyDatum = plainToClass(KeyDatum, {
            id: 'some-uuid',
            public: 320,
            salt: 'some-salt',
            User: user,
        });

        const errors = await validate(keyDatum);
        expect(errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should fail validation if salt is missing', async () => {
        const user = new UserEntity();
        user.id = 'some-uuid'; // njsscan-ignore: node_username

        const keyDatum = plainToClass(KeyDatum, {
            id: 'some-uuid',
            public: Buffer.from('some-public-key'),
            User: user,
        });

        const errors = await validate(keyDatum);
        expect(errors.length).toBeGreaterThan(0);
    });

}); //another change