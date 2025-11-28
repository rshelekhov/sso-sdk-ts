# Changelog

All notable changes to the SSO SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-11-28

### Changed

- **Error Code Migration**: Migrated from string-based error codes to numeric error codes (1000-1599) matching backend protobuf definitions
  - Authentication errors: 1000-1099
  - Verification errors: 1100-1199
  - Validation errors: 1200-1299
  - Client management errors: 1300-1399
  - Internal service errors: 1500-1599
- Enhanced error mapping to support both string and numeric error codes for backward compatibility
- Improved error classification with more granular error code mappings in `parseAPIError()`
- Updated `getUserFriendlyMessage()` to handle both string and numeric error codes

### Fixed

- **Hono Example**: Fixed TypeScript type errors in Hono example application
  - Added proper type definitions for Hono context variables (`sessionId`, `ssoUser`)
  - Fixed session middleware type safety with proper null checks

## [0.2.0] - 2025-11-27

### Added

- **HTTP Error Mapping**: Implemented HTTP error mapping utilities for converting SSO SDK errors to HTTP responses
- **Hono Adapter**: Added Hono framework adapter for SSO error handling
- **Custom Error Codes**: Enhanced error constructors to accept custom error codes for better error handling flexibility

### Changed

- Updated package version to 0.2.0
- Enhanced build script to include Hono adapter
- Refactored ValidationError constructor for improved readability and consistency
- Added Hono as a devDependency and peerDependency (optional)

### Fixed

- Improved error handling consistency across the SDK

## [0.1.1] - 2025-11-23

### Changed

- Optimized package size by refining included files
- Updated package configuration for better distribution

### Fixed

- Package size optimization for faster installation

## [0.1.0] - 2025-11-20

### Added

- **Core SDK Implementation**: Complete SSO SDK with authentication, user management, and client application management
- **Authentication Features**:
  - JWT authentication middleware with JWKS verification
  - Session handling and token management
  - Refresh token support
- **Testing Framework**:
  - Comprehensive unit tests
  - Integration tests with Docker Compose setup
  - Test coverage reporting
- **Documentation**:
  - Complete README with SDK overview and usage examples
  - FAQ documentation
  - Security best practices guide
  - Testing guide
  - Token storage patterns documentation
- **Development Tools**:
  - BiomeJS integration for linting and formatting
  - GitHub Actions workflows for CI/CD
  - Makefile with development commands
  - Docker Compose configuration for integration tests
- **Project Configuration**:
  - TypeScript configuration
  - Prettier configuration
  - Bun runtime support
  - Package management setup

### Changed

- Migrated to BiomeJS from ESLint for better performance
- Improved code readability and maintainability
- Enhanced session handling and error messaging

### Removed

- Removed NestJS example application files (will be re-added in future releases)

[Unreleased]: https://github.com/rshelekhov/sso-sdk-ts/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/rshelekhov/sso-sdk-ts/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/rshelekhov/sso-sdk-ts/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rshelekhov/sso-sdk-ts/releases/tag/v0.1.0
