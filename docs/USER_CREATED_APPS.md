# User-Created Apps Feature

## Overview

The client-interface now allows regular users to create and manage their own configured applications with automatic app scope creation and owner role assignment.

## Features

### My Apps Management
- **Location**: `/my-apps` route in client-interface
- **Access**: Requires authentication and profile selection
- View all apps created by the current user
- Create new applications with a simple wizard
- Edit and manage existing applications
- Launch apps directly from the dashboard

### App Creation Wizard
- **Location**: `/create-app` route in client-interface
- **Features**:
  - Basic app information (name, description, domain)
  - Feature toggles (auth, social, tasks, blogging)
  - Automatic app scope creation
  - Automatic owner role assignment
  - Default landing page configuration
  - Default routing based on enabled features

### Automatic Permissions
When creating an app with "Create App Scope" enabled (default):
1. A new app scope is created with the app name
2. An owner role is created for that app scope
3. The creator is automatically assigned the owner role
4. The creator has full permissions within that app scope

## How to Use

### Creating Your First App

1. **Navigate to My Apps**
   - Log in to client-interface
   - Select your profile
   - Click "My Apps" in the navigation menu

2. **Start the Wizard**
   - Click "Create New App" button
   - Fill in app details:
     - **App Name** (required): A unique name for your application
     - **Description** (optional): What your app does
     - **Domain** (optional): Custom domain (requires DNS configuration)

3. **Select Features**
   - **Authentication** (recommended): User registration and login
   - **Social Features**: Posts, comments, and interactions
   - **Tasks**: Task management and tracking
   - **Blogging**: Create and publish blog posts

4. **Configure Permissions**
   - **Create App Scope** (recommended): Creates isolated permissions for your app
   - Automatically assigns you as owner with full permissions

5. **Create**
   - Click "Create App" to finalize
   - Your app will be created with:
     - A unique app scope
     - An owner role assigned to you
     - A landing page
     - Routes for enabled features

### Accessing Your App

#### Via Configurable Client
If you configured a domain for your app:
```
http://your-domain.com
```

Or using the route parameter:
```
http://localhost:8090/app/your-app-name
```

Or using the query parameter (development):
```
http://localhost:8090?appName=your-app-name
```

#### Via Client Interface
All auth-enabled features are accessible through the client-interface at:
```
http://localhost:4200
```

## Technical Details

### Backend Components

#### App Configuration Entity
- **ownerId**: Stores the profile ID of the creator
- **appScopeId**: Links to the associated app scope
- **Features**: JSON object defining enabled features
- **Routes**: JSON array defining app routes
- **Theme**: JSON object for customization

#### App Scope Creation
When `createAppScope: true` is set:
1. ConfigurationsService creates a new AppScope via permissions service
2. An owner role is created for the app scope
3. The owner role is assigned to the creator's profile

#### Permissions Flow
```
User creates app config
  ↓
Gateway passes profileId from JWT
  ↓
App-configurator service receives ownerId
  ↓
Creates AppScope via permissions microservice
  ↓
Creates owner role for AppScope
  ↓
Assigns owner role to creator profile
  ↓
Returns app configuration with appScopeId
```

### Frontend Components

#### AppConfigService
HTTP client for app configuration CRUD operations:
- `createAppConfig(dto)`: Create new app
- `getAllAppConfigs()`: Get all apps
- `getMyAppConfigs()`: Get user's apps
- `updateAppConfig(id, dto)`: Update app
- `deleteAppConfig(id)`: Delete app

#### MyAppsComponent
Dashboard for managing user-created apps:
- Displays apps created by current user
- Grid layout with app cards
- Quick actions (View, Edit, Launch)
- Empty state for new users

#### CreateAppComponent
Wizard for creating new applications:
- Form-based configuration
- Feature toggles
- Real-time validation
- Success/error handling

## Database Schema

### Migration: add-owner-and-appscope
```sql
ALTER TABLE "app_configuration_entity" 
  ADD "ownerId" character varying;
  
ALTER TABLE "app_configuration_entity" 
  ADD "appScopeId" character varying;
```

## API Endpoints

### Create App Configuration
```
POST /api/app-config
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My App",
  "description": "My awesome app",
  "domain": "myapp.example.com",
  "createAppScope": true,
  "landingPage": { ... },
  "routes": [ ... ],
  "features": {
    "auth": true,
    "social": false,
    "tasks": false,
    "blogging": false
  },
  "theme": { ... }
}
```

Response:
```json
{
  "id": "uuid",
  "name": "My App",
  "ownerId": "creator-profile-id",
  "appScopeId": "app-scope-id",
  ...
}
```

### Get My Apps
```
GET /api/app-config
Authorization: Bearer <token>
```

Returns all app configurations (filter client-side by ownerId).

## Future Enhancements

### Planned Features
1. **Dynamic Auth Routes**: Load auth UI components dynamically in configurable-client
2. **Permission Management**: UI for managing roles and permissions within created apps
3. **Team Collaboration**: Invite other users to collaborate on apps
4. **Template Library**: Pre-built app templates for common use cases
5. **Analytics Dashboard**: Track app usage and performance
6. **Custom Domains**: Automated DNS configuration and SSL
7. **App Marketplace**: Share and discover user-created apps

### Known Limitations
- Auth UI currently works best through client-interface
- Configurable-client focuses on landing pages
- No automated DNS/SSL configuration yet
- App filtering by owner is client-side only

## Troubleshooting

### My app doesn't appear in My Apps
- Ensure you're logged in with the same profile that created the app
- Check that the app was created successfully (check browser console)
- Try refreshing the page

### Can't access my app via domain
- Verify DNS is configured to point to the platform
- Check that domain matches exactly in app configuration
- Try accessing via route parameter instead: `/app/your-app-name`

### Permission denied errors
- Ensure app scope was created (check createAppScope was true)
- Verify your profile has the owner role assigned
- Check with platform admin if issues persist

## Support

For questions or issues:
- Check the main repository README
- Review the MULTI_TENANT.md documentation for configurable-client
- Submit issues on the GitHub repository
