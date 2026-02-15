# Multi-stage build for CoorChat Relay Server
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files
COPY CoorChat.RelayServer.sln ./
COPY src/CoorChat.RelayServer.Api/CoorChat.RelayServer.Api.csproj src/CoorChat.RelayServer.Api/
COPY src/CoorChat.RelayServer.Core/CoorChat.RelayServer.Core.csproj src/CoorChat.RelayServer.Core/
COPY src/CoorChat.RelayServer.Data/CoorChat.RelayServer.Data.csproj src/CoorChat.RelayServer.Data/
COPY tests/CoorChat.RelayServer.Tests.Unit/CoorChat.RelayServer.Tests.Unit.csproj tests/CoorChat.RelayServer.Tests.Unit/
COPY tests/CoorChat.RelayServer.Tests.Integration/CoorChat.RelayServer.Tests.Integration.csproj tests/CoorChat.RelayServer.Tests.Integration/

# Restore dependencies
RUN dotnet restore

# Copy source code
COPY src/ src/
COPY tests/ tests/

# Build and publish
WORKDIR /src/src/CoorChat.RelayServer.Api
RUN dotnet build -c Release --no-restore && \
    dotnet publish -c Release -o /app/publish --no-build

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S coorchat && \
    adduser -S coorchat -u 1001 && \
    chown -R coorchat:coorchat /app

USER coorchat

# Copy published application
COPY --from=build /app/publish .

# Expose ports
EXPOSE 80
EXPOSE 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

ENTRYPOINT ["dotnet", "CoorChat.RelayServer.Api.dll"]
