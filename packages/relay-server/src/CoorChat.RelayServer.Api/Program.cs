using CoorChat.RelayServer.Api.Hubs;
using CoorChat.RelayServer.Api.Middleware;
using CoorChat.RelayServer.Core.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// Add SignalR with configuration
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.MaximumReceiveMessageSize = 128 * 1024; // 128 KB
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .SetIsOriginAllowed(_ => true); // For development - restrict in production
    });
});

// Add health checks
builder.Services.AddHealthChecks();

// Register application services
builder.Services.AddSingleton<IConnectionManager, ConnectionManager>();
builder.Services.AddSingleton<IAuthenticationService, AuthenticationService>();

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "CoorChat Relay Server API",
        Version = "v1.0.0",
        Description = "SignalR relay server for multi-agent coordination"
    });
});

// Add logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

if (builder.Environment.IsDevelopment())
{
    builder.Logging.SetMinimumLevel(LogLevel.Debug);
}

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CoorChat Relay Server API v1");
        c.RoutePrefix = string.Empty; // Serve Swagger UI at root
    });
}

// Enable CORS (must be before other middleware)
app.UseCors();

// HTTPS redirection
app.UseHttpsRedirection();

// Authentication middleware for SignalR
app.UseMiddleware<AuthenticationMiddleware>();

// Authorization
app.UseAuthorization();

// Map controllers
app.MapControllers();

// Map SignalR hub
app.MapHub<AgentHub>("/agentHub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets |
                         Microsoft.AspNetCore.Http.Connections.HttpTransportType.ServerSentEvents;
});

// Health check endpoint
app.MapHealthChecks("/health");

// Root endpoint
app.MapGet("/", () => new
{
    name = "CoorChat Relay Server",
    version = "1.0.0",
    status = "running",
    timestamp = DateTime.UtcNow,
    endpoints = new
    {
        hub = "/agentHub",
        health = "/health",
        swagger = "/swagger"
    }
});

// Agent statistics endpoint
app.MapGet("/api/stats", (IConnectionManager connectionManager) => new
{
    totalConnections = connectionManager.GetConnectionCount(),
    agents = connectionManager.GetAllConnections().Select(c => new
    {
        c.AgentId,
        c.Role,
        c.ConnectedAt,
        c.LastActivity,
        connectionDuration = DateTime.UtcNow - c.ConnectedAt
    })
});

app.Logger.LogInformation("CoorChat Relay Server starting...");
app.Logger.LogInformation("SignalR Hub endpoint: /agentHub");
app.Logger.LogInformation("Health check endpoint: /health");

app.Run();
