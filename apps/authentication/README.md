# Authentication

<<<<<<< HEAD
This service is responsible for user authentication and authorization. It provides a secure and reliable way to manage user identities and access control for all applications in the Optimistic Tanuki project.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Authentication service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/authentication`.
=======
This project handles user authentication and authorization including user accounts, sessions, JWT tokens, and two-factor authentication (2FA) with TOTP.

## Features

- **User Management**: User account creation and management
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: User session handling with token refresh
- **2FA/TOTP**: Two-factor authentication support using time-based one-time passwords
- **Key Management**: Cryptographic key storage and management

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `UserEntity`: User accounts and credentials
- `TokenEntity`: JWT tokens and session data
- `KeyDatum`: Cryptographic keys for 2FA

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @Inject(getRepositoryToken(UserEntity))
    private readonly userRepo: Repository<UserEntity>,
  ) {}
}
```

## Dependencies

- `@optimistic-tanuki/encryption`: Cryptographic services for password hashing and asymmetric encryption
- `jsonwebtoken`: JWT token generation and validation
- `otplib`: TOTP generation and validation for 2FA

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with credentials
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout and invalidate token

### 2FA
- `POST /auth/2fa/setup` - Setup 2FA for user
- `POST /auth/2fa/verify` - Verify 2FA token
- `POST /auth/2fa/disable` - Disable 2FA

## Running the Application

### Development
```bash
nx serve authentication
```

### Production Build
```bash
nx build authentication
```

### Docker
The authentication service is included in the main docker-compose stack:
```bash
docker-compose up authentication
```

## Configuration

The service requires the following environment variables:
- `JWT_SECRET`: Secret key for JWT token signing
- Database connection settings (host, port, username, password, database)
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
