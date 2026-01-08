using ClickerCsharp.Dtos;
using CSharpClicker.UseCases.ExchangeBoosts;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CSharpClicker.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ExchangeController : ControllerBase
{
    private readonly IMediator mediator;

    public ExchangeController(IMediator imediator)
    {
        mediator = imediator;
    }

    /// <summary>
    /// Обмен 5 на 1
    /// </summary>
    /// <param name="request"></param>
    /// <returns></returns>
    [HttpPost("exchange")]
    public async Task<IActionResult> ExchangeBoosts([FromBody] ExchangeRequestDto request)
    {
        var command = new ExchangeBoostsCommand(request.FromBoostId, false);
        var result = await mediator.Send(command);

        if (result.Success)
            return Ok(result);

        return BadRequest(result);
    }

    /// <summary>
    /// Обмен 1 на 5
    /// </summary>
    /// <param name="request"></param>
    /// <returns></returns>
    [HttpPost("reverse-exchange")]
    public async Task<IActionResult> ReverseExchangeBoosts([FromBody] ExchangeRequestDto request)
    {
        var command = new ExchangeBoostsCommand(request.FromBoostId, true);
        var result = await mediator.Send(command);

        if (result.Success)
            return Ok(result);

        return BadRequest(result);
    }
}