using Microsoft.AspNetCore.Http;
using CoorChat.RelayServer.Core.Services;
using System.Threading.Tasks;

namespace CoorChat.RelayServer.Api.Middleware
{
    /// <summary>
    /// Authentication middleware for validating shared tokens
    /// </summary>
    public class AuthenticationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IAuthenticationService _authService;

        public AuthenticationMiddleware(
            RequestDelegate next,
            IAuthenticationService authService)
        {
            _next = next;
            _authService = authService;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Skip authentication for health check endpoint
            if (context.Request.Path.StartsWithSegments("/health"))
            {
                await _next(context);
                return;
            }

            // Skip authentication for SignalR hub - it handles auth via access token
            if (context.Request.Path.StartsWithSegments("/agentHub"))
            {
                await _next(context);
                return;
            }

            // Extract token from Authorization header
            var authHeader = context.Request.Headers["Authorization"].ToString();
            if (string.IsNullOrEmpty(authHeader))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Missing Authorization header");
                return;
            }

            // Parse Bearer token
            var token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? authHeader.Substring("Bearer ".Length).Trim()
                : authHeader;

            // Validate token
            var isValid = await _authService.ValidateTokenAsync(token);
            if (!isValid)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Invalid authentication token");
                return;
            }

            // Store token in context for downstream use
            context.Items["AuthToken"] = token;

            // Continue to next middleware
            await _next(context);
        }
    }

    /// <summary>
    /// Extension methods for AuthenticationMiddleware
    /// </summary>
    public static class AuthenticationMiddlewareExtensions
    {
        public static IApplicationBuilder UseTokenAuthentication(
            this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<AuthenticationMiddleware>();
        }
    }
}
