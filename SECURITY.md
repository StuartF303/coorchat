# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

### Email

Send details to: **security@coorchat.dev** (if available)

### GitHub Security Advisory

Use GitHub's private vulnerability reporting:
https://github.com/stuartf303/coorchat/security/advisories/new

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity
  - **Critical**: 1-7 days
  - **High**: 1-2 weeks
  - **Medium**: 2-4 weeks
  - **Low**: Next planned release

### Disclosure Policy

- Security issues will be disclosed after a fix is available
- We'll work with you to understand the timeline that works for your disclosure
- We'll credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version
2. **Secure Tokens**: Never commit tokens to version control
3. **Use Environment Variables**: Store sensitive config in `.env` files (git-ignored)
4. **Enable TLS**: Use `rediss://` for Redis, `https://` for SignalR
5. **Rotate Tokens**: Regularly rotate authentication tokens
6. **Validate Input**: Don't trust user-provided data
7. **Monitor Logs**: Watch for suspicious activity

### Token Security

```bash
# Generate cryptographically secure tokens
npm run cli -- token generate

# Validate token format before use
npm run cli -- token validate YOUR_TOKEN

# Store tokens securely
export SHARED_TOKEN=cct_your_token_here  # Environment variable
# OR
echo "SHARED_TOKEN=cct_your_token_here" >> .env  # .env file (git-ignored)
```

### TLS/Encryption

**Redis:**
```bash
# Use rediss:// for TLS-encrypted connections
REDIS_URL=rediss://localhost:6379
REDIS_TLS=true
```

**SignalR:**
```bash
# Always use HTTPS
SIGNALR_HUB_URL=https://your-server.com/agentHub
```

### Authentication

All channels require token authentication:

- Minimum 16 characters
- Cryptographically random
- SHA-256 hashed for storage
- Timing-safe comparison

## Known Security Features

### Implemented

- ✅ Token-based authentication
- ✅ Timing-safe token comparison (prevents timing attacks)
- ✅ HMAC-SHA256 message signatures (Redis)
- ✅ TLS enforcement options
- ✅ Secure random token generation
- ✅ SHA-256 token hashing
- ✅ Input validation for all messages
- ✅ No plaintext token storage

### Planned

- 🔲 Token expiration
- 🔲 Role-based access control (RBAC)
- 🔲 Rate limiting
- 🔲 Audit logging
- 🔲 IP whitelisting

## Security Advisories

Security advisories will be published at:
https://github.com/stuartf303/coorchat/security/advisories

Subscribe to notifications to stay informed.

## Compliance

CoorChat is designed with security in mind but has not been audited for specific compliance standards (GDPR, SOC2, etc.). If you have compliance requirements, please review the code and security features before deploying in production.

## Bug Bounty

We currently do not have a bug bounty program, but we deeply appreciate security researchers who responsibly disclose vulnerabilities.

## Security Updates

Security fixes are released as patch versions (e.g., 1.0.1) and documented in:

- GitHub Security Advisories
- Release notes
- CHANGELOG.md

## Questions?

For general security questions (not vulnerabilities), please:

- Open a [Discussion](https://github.com/stuartf303/coorchat/discussions)
- Tag with `security` label

**Thank you for helping keep CoorChat secure!**
