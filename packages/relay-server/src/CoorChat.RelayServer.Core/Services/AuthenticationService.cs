using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoorChat.RelayServer.Core.Services
{
    /// <summary>
    /// Authentication service for validating shared tokens
    /// </summary>
    public class AuthenticationService : IAuthenticationService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthenticationService> _logger;
        private readonly string _validTokenHash;

        public AuthenticationService(
            IConfiguration configuration,
            ILogger<AuthenticationService> logger)
        {
            _configuration = configuration;
            _logger = logger;

            // Load valid token from configuration
            var validToken = _configuration["Authentication:SharedToken"]
                ?? throw new InvalidOperationException("Authentication:SharedToken not configured");

            // Store hash of valid token for timing-safe comparison
            _validTokenHash = HashToken(validToken);

            _logger.LogInformation("Authentication service initialized");
        }

        /// <summary>
        /// Validate an authentication token
        /// </summary>
        public Task<bool> ValidateTokenAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                _logger.LogWarning("Empty token provided");
                return Task.FromResult(false);
            }

            // Minimum token length check
            if (token.Length < 16)
            {
                _logger.LogWarning("Token too short: {Length} characters", token.Length);
                return Task.FromResult(false);
            }

            try
            {
                // Hash provided token
                var providedHash = HashToken(token);

                // Timing-safe comparison
                var isValid = TimingSafeEqual(providedHash, _validTokenHash);

                if (!isValid)
                {
                    _logger.LogWarning("Invalid token provided");
                }

                return Task.FromResult(isValid);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating token");
                return Task.FromResult(false);
            }
        }

        /// <summary>
        /// Generate a new authentication token
        /// </summary>
        public string GenerateToken()
        {
            // Generate 32 bytes (256 bits) of random data
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }

            // Convert to hex string with prefix
            return "cct_" + Convert.ToHexString(bytes).ToLowerInvariant();
        }

        /// <summary>
        /// Hash a token for secure storage
        /// </summary>
        public string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(token);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        /// <summary>
        /// Timing-safe string comparison
        /// </summary>
        private bool TimingSafeEqual(string a, string b)
        {
            if (a == null || b == null)
                return false;

            if (a.Length != b.Length)
                return false;

            var result = 0;
            for (int i = 0; i < a.Length; i++)
            {
                result |= a[i] ^ b[i];
            }

            return result == 0;
        }
    }
}
