import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
    it('should create an instance of UpdateUserDto', () => {
        const dto = new UpdateUserDto();
        expect(dto).toBeInstanceOf(UpdateUserDto);
    });

    it('should allow partial updates', () => {
        const dto = new UpdateUserDto();
        dto.firstName = 'John';
        dto.lastName = 'Doe';
        dto.email = 'john.doe@example.com';
        dto.bio = 'A short bio';
        dto.oldPassword = 'oldPassword123'; // njsscan-ignore: node_password
        dto.newPassword = 'newPassword123'; // njsscan-ignore: node_password
        dto.confirmPassword = 'newPassword123'; // njsscan-ignore: node_password

        expect(dto.firstName).toBe('John');
        expect(dto.lastName).toBe('Doe');
        expect(dto.email).toBe('john.doe@example.com');
        expect(dto.bio).toBe('A short bio');
        expect(dto.oldPassword).toBe('oldPassword123');
        expect(dto.newPassword).toBe('newPassword123');
        expect(dto.confirmPassword).toBe('newPassword123');
    });

    it('should allow empty fields', () => {
        const dto = new UpdateUserDto();
        expect(dto.firstName).toBe('');
        expect(dto.lastName).toBe('');
        expect(dto.email).toBe('');
        expect(dto.bio).toBe('');
        expect(dto.oldPassword).toBeUndefined();
        expect(dto.newPassword).toBeUndefined();
        expect(dto.confirmPassword).toBe('');
    });
});