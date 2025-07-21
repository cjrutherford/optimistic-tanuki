# Repo Purpose
this repository is a collection of tools and resources for creating, maintaining, and publishing full stack web applicatiions using the NX workspace toolchain. this toolchain is designed to help developers build scalable, maintainable, and efficient web applications with a focus on modularity and reusability. We want to leverage the power of NX to create a robust and flexible development environment that can be easily extended and customized to meet the needs of different projects.

# Components

## Applications

### Assets
the assets application is responsible for managing static assets such as images, fonts, and other media files. it provides a centralized location for storing and serving these assets, making it easy to manage and access them across different applications within the workspace. this application is designed to be modular and reusable, allowing it to be easily integrated into other applications within the workspace. it is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Authentication
the authentication application is responsible for managing user authentication and authorization. it provides user accounts and session management through the use of JWT tokens. this application is designed to be modular and reusable, allowing it to be easily integrated into other applications within the workspace. with little expectation of the user or consuming services. 

### Client Interface
The client interface application is intended to be the full interface to the end user on the web. it is an angular application that provides UI elements and tooling to call and interact with the backend services against the gateway application. It is designed to be a strictly defined application with explicit dependencies and interfaces.

### Gateway
The gateway application is responsible for relying on the authentication application to provide user accounts and session management, and routing requests to the appropriate backend services. it acts as a reverse proxy, forwarding requests to the appropriate backend service based on the request path. this application is designed to be an entrypoint for client interfaces and other applications within the workspace, providing a single point of access to the backend services. it is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Profile
the profile application is responsible for maintaining user profiles and providing a user interface for managing user information. it is designed to be modular and reusable, allowing it to be easily integrated into other applications within the workspace. this application is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Social
The social application provides an api surface for managing social interactions such as following, posts, votes, comments, links, and attachments. It depends on the asset and profile applications for managing media and user information. it is designed to be modular and reusable, allowing it to be easily integrated into other applications within the workspace. this application is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Tasks
The tasks application provides an api surface for managing tasks, including task creation, timing, and completion. it is designed to be modular and reusable, allowing it to be easily integrated into other applications within the workspace. this application is built with the intention of being used by other applications, with little expectation of the user or consuming services.

## Libraries

### Auth-ui
The auth-ui library provides a set of UI components and services for managing user authentication and authorization. it is designed to be used by the client interface application to provide a consistent and reusable authentication experience across different applications within the workspace. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Common-ui
The common-ui library provides a set of common UI components and services that can be used across different applications within the workspace. it includes components such as buttons, forms, modals, and other reusable UI elements. this library is designed to be used by the client interface application and other applications within the workspace to provide a consistent and reusable user interface experience. it is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### constants
The constants library provides a series of exported platform constants that should be used in other services within the platform. it is where all manually set injection tokens should be defined, and it is designed to be used by the client interface application and other applications within the workspace. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Database
The database library provides a set of services for managing database connections and setting up Typeorm. it is designed to be used by the backend services within the workspace to provide a consistent implementation of database connections and migrations. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### encryption
The encryption library provides a set of services for handling cryptographic operations such as hashing and encryption. it is designed to be used by the backend services within the workspace to provide a consistent implementation of cryptographic operations. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### form-ui
The form-ui library provides a set of UI components to be used with forms.

### logger
provides common logging settings with an exported logger service. 

### models
The models library provides a set of common data models and interfaces that can be used across backend applications.

### Profile-ui
The profile-ui library provides a set of UI components and services for managing user profiles and information. it is designed to be used by the client interface application to provide a consistent and reusable profile management experience across different applications within the workspace. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### Social-ui
The social-ui library provides a set of UI components and services for managing social interactions such as following, posts, votes, comments, links, and attachments. it is designed to be used by the client interface application to provide a consistent and reusable social interaction experience across different applications within the workspace. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### theme-ui
The theme-ui library provides a set of UI components and services for managing themes and styles. it exports a theme service that handles setting up host styles for UI applications. it is designed to be used by the client interface application and other applications within the workspace to provide a consistent and reusable theme management experience. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.

### ui-models
The ui-models library provides a set of common data models and interfaces that can be used across UI applications. it is designed to be used by the client interface application and other applications within the workspace to provide a consistent implementation of data models and interfaces. this library is built with the intention of being used by other applications, with little expectation of the user or consuming services.
