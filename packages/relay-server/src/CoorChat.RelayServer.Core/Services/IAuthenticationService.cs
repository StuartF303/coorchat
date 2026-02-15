using System.Threading.Tasks;

namespace CoorChat.RelayServer.Core.Services
{
    /// <summary>
    /// Interface for authentication service
    /// </summary>
    public interface IAuthenticationService
    {
        /// <summary>
        /// Validate an authentication token
        /// </summary>
        /// <param name="token">Token to validate</param>
        /// <returns>True if token is valid, false otherwise</returns>
        Task<bool> ValidateTokenAsync(string token);

        /// <summary>
        /// Generate a new authentication token
        /// </summary>
        /// <returns>New authentication token</returns>
        string GenerateToken();

        /// <summary>
        /// Hash a token for secure storage
        /// </summary>
        /// <param name="token">Token to hash</param>
        /// <returns>Hashed token</returns>
        string HashToken(string token);
    }
}
