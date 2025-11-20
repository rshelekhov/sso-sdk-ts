.PHONY: help test test-unit test-integration test-up test-down test-logs test-logs-follow install build typecheck format

# Default target - show help
help:
	@echo "SSO TypeScript SDK - Available Commands"
	@echo ""
	@echo "Testing:"
	@echo "  make test              - Run all tests (starts server, runs tests, stops server)"
	@echo "  make test-unit         - Run unit tests only (fast, no server needed)"
	@echo "  make test-integration  - Run integration tests (server must be running)"
	@echo ""
	@echo "Test Server:"
	@echo "  make test-up           - Start SSO server"
	@echo "  make test-down         - Stop SSO server"
	@echo "  make test-logs         - View server logs (last 100 lines)"
	@echo "  make test-logs-follow  - Follow server logs (interactive)"
	@echo ""
	@echo "Development:"
	@echo "  make install           - Install dependencies"
	@echo "  make build             - Build the SDK"
	@echo "  make typecheck         - Run type checking"
	@echo "  make format            - Format code"

# Run all tests (starts server, runs tests, stops server)
test:
	@echo "▶ Starting SSO server..."
	@docker compose -f docker-compose.test.yml up -d
	@echo "⏳ Waiting for services (30s)..."
	@sleep 30
	@echo "▶ Running unit tests..."
	@bun run test:unit || (docker compose -f docker-compose.test.yml down && exit 1)
	@echo "▶ Running integration tests..."
	@bun run test:integration || (docker compose -f docker-compose.test.yml down && exit 1)
	@echo "▶ Stopping server..."
	@docker compose -f docker-compose.test.yml down
	@echo "✅ All tests passed!"

# Run unit tests only
test-unit:
	@echo "▶ Running unit tests..."
	@bun run test:unit

# Run integration tests (requires running server)
test-integration:
	@echo "▶ Running integration tests..."
	@bun run test:integration

# Start SSO server and dependencies
test-up:
	@echo "▶ Starting SSO server..."
	@docker compose -f docker-compose.test.yml up -d
	@echo "⏳ Waiting 30s for services to be ready..."
	@sleep 30
	@echo "✅ Server ready! Use 'make test-integration' to run tests"

# Stop SSO server
test-down:
	@echo "▶ Stopping SSO server..."
	@docker compose -f docker-compose.test.yml down -v
	@echo "✅ Server stopped"

# View SSO server logs (use test-logs-follow for interactive mode)
test-logs:
	@docker compose -f docker-compose.test.yml logs --tail=100 sso

# Follow SSO server logs (interactive)
test-logs-follow:
	@docker compose -f docker-compose.test.yml logs -f sso

# Install dependencies
install:
	@bun install

# Build the SDK
build:
	@bun run build

# Run TypeScript type checking
typecheck:
	@bun run typecheck

# Format code
format:
	@bun run format
