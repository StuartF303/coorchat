using CoorChat.RelayServer.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace CoorChat.RelayServer.Tests.Unit.Services;

public class AuthenticationServiceTests
{
    private const string ValidToken = "cct_7265f6c9c0913231926d7c5b8b94e37ba43f654b997a4ed2a5e42bcbb740df5b";

    private readonly AuthenticationService _sut;
    private readonly Mock<ILogger<AuthenticationService>> _loggerMock;

    public AuthenticationServiceTests()
    {
        _loggerMock = new Mock<ILogger<AuthenticationService>>();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Authentication:SharedToken"] = ValidToken
            })
            .Build();

        _sut = new AuthenticationService(config, _loggerMock.Object);
    }

    [Fact]
    public async Task ValidateTokenAsync_ValidToken_ShouldReturnTrue()
    {
        var result = await _sut.ValidateTokenAsync(ValidToken);
        Assert.True(result);
    }

    [Fact]
    public async Task ValidateTokenAsync_InvalidToken_ShouldReturnFalse()
    {
        var result = await _sut.ValidateTokenAsync("cct_invalid_token_that_is_long_enough");
        Assert.False(result);
    }

    [Fact]
    public async Task ValidateTokenAsync_EmptyToken_ShouldReturnFalse()
    {
        var result = await _sut.ValidateTokenAsync("");
        Assert.False(result);
    }

    [Fact]
    public async Task ValidateTokenAsync_WhitespaceToken_ShouldReturnFalse()
    {
        var result = await _sut.ValidateTokenAsync("   ");
        Assert.False(result);
    }

    [Fact]
    public async Task ValidateTokenAsync_TooShortToken_ShouldReturnFalse()
    {
        var result = await _sut.ValidateTokenAsync("short");
        Assert.False(result);
    }

    [Fact]
    public async Task ValidateTokenAsync_ExactlyMinLength_ShouldValidateNormally()
    {
        // 16 chars - passes length check, fails hash check
        var result = await _sut.ValidateTokenAsync("1234567890123456");
        Assert.False(result);
    }

    [Fact]
    public void Constructor_MissingSharedToken_ShouldThrow()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        Assert.Throws<InvalidOperationException>(() =>
            new AuthenticationService(config, _loggerMock.Object));
    }

    [Fact]
    public void GenerateToken_ShouldReturnTokenWithPrefix()
    {
        var token = _sut.GenerateToken();
        Assert.StartsWith("cct_", token);
    }

    [Fact]
    public void GenerateToken_ShouldReturnUniqueTokens()
    {
        var token1 = _sut.GenerateToken();
        var token2 = _sut.GenerateToken();
        Assert.NotEqual(token1, token2);
    }

    [Fact]
    public void GenerateToken_ShouldReturnSufficientLength()
    {
        var token = _sut.GenerateToken();
        // "cct_" prefix + 64 hex chars (32 bytes) = 68 chars
        Assert.True(token.Length >= 16);
    }

    [Fact]
    public void HashToken_ShouldReturnConsistentHash()
    {
        var hash1 = _sut.HashToken("test-token");
        var hash2 = _sut.HashToken("test-token");
        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void HashToken_DifferentTokens_ShouldReturnDifferentHashes()
    {
        var hash1 = _sut.HashToken("token-a");
        var hash2 = _sut.HashToken("token-b");
        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void HashToken_ShouldReturnLowercaseHex()
    {
        var hash = _sut.HashToken("test-token");
        Assert.Matches("^[0-9a-f]+$", hash);
    }

    [Fact]
    public void HashToken_ShouldReturn64CharSHA256()
    {
        var hash = _sut.HashToken("test-token");
        Assert.Equal(64, hash.Length); // SHA-256 = 256 bits = 64 hex chars
    }
}
