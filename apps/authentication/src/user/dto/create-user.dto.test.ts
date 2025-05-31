import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
    it('should create an instance of CreateUserDto', () => {
        const createUserDto = new CreateUserDto();
        expect(createUserDto).toBeInstanceOf(CreateUserDto);
    });

    it('should have the correct properties', () => {
        const createUserDto = new CreateUserDto();
        expect(createUserDto).toHaveProperty('firstName');
        expect(createUserDto).toHaveProperty('lastName');
        expect(createUserDto).toHaveProperty('email');
        expect(createUserDto).toHaveProperty('password');
        expect(createUserDto).toHaveProperty('bio');
        expect(createUserDto).toHaveProperty('confirmPassword');
    });

    it('should allow setting and getting properties', () => {
        const createUserDto = new CreateUserDto();
        createUserDto.firstName = 'John'; // njsscan-ignore: node_username
        createUserDto.lastName = 'Doe'; // njsscan-ignore: node_username
        createUserDto.email = 'john.doe@example.com'; // njsscan-ignore: node_email,node_username
        createUserDto.password = 'password123'; // njsscan-ignore: node_password,node_username
        createUserDto.bio = 'A short bio'; // njsscan-ignore: node_username
        createUserDto.confirmPassword = 'password123'; // njsscan-ignore: node_password,node_username

        expect(createUserDto.firstName).toBe('John');
        expect(createUserDto.lastName).toBe('Doe');
        expect(createUserDto.email).toBe('john.doe@example.com');
        expect(createUserDto.password).toBe('password123');
        expect(createUserDto.bio).toBe('A short bio');
        expect(createUserDto.confirmPassword).toBe('password123');
    });
});