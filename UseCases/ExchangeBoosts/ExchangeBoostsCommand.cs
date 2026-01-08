using MediatR;

namespace CSharpClicker.UseCases.ExchangeBoosts;

public record ExchangeBoostsCommand(int FromBoostId, bool IsReverse) : IRequest<ExchangeResult>;

public class ExchangeResult
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public Dictionary<int, int> UpdatedQuantities { get; set; }
}   