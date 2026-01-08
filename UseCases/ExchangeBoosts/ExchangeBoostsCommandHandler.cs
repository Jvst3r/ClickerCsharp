using CSharpClicker.Domain;
using CSharpClicker.DomainServices;
using CSharpClicker.Infrastructure.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CSharpClicker.UseCases.ExchangeBoosts;

public class ExchangeBoostsCommandHandler : IRequestHandler<ExchangeBoostsCommand, ExchangeResult>
{
    private readonly ICurrentUserIdAccessor _currentUserIdAccessor;
    private readonly IAppDbContext _db;
    private readonly IScoreNotificationService _scoreService;
    private const int ExchangeRate = 5;

    public ExchangeBoostsCommandHandler(ICurrentUserIdAccessor currentUserIdAccessor,
                                        IAppDbContext appDbContext,
                                        IScoreNotificationService scoreNotificationService)
    {
        _currentUserIdAccessor = currentUserIdAccessor;
        _db = appDbContext;
        _scoreService = scoreNotificationService;
    }

    public async Task<ExchangeResult> Handle(ExchangeBoostsCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserIdAccessor.GetCurrentUserId();

        //пользователь
        var user = await _db.Users
            .Include(u => u.UserBoosts)
            .ThenInclude(ub => ub.Boost)
            .FirstAsync(u => u.Id == currentUserId, cancellationToken);

        //все бусты
        var allBoosts = await _db.Boosts
            .OrderBy(b => b.Id)
            .ToListAsync(cancellationToken);

        //буст для обмена
        var fromBoost = allBoosts.FirstOrDefault(b => b.Id == request.FromBoostId);
        if (fromBoost == null)
        {
            return new ExchangeResult
            {
                Success = false,
                Message = "Буст не найден"
            };
        }

        //определение целевого буста
        Boost? toBoost;
        if (!request.IsReverse)
        {
            //обмен 5 на 1
            toBoost = allBoosts.FirstOrDefault(b => b.Id == fromBoost.Id + 1);
            if (toBoost == null)
            {
                return new ExchangeResult
                {
                    Success = false,
                    Message = "Нет следующего буста для обмена"
                };
            }
        }
        else
        {
            //обмен 1 на 5
            toBoost = allBoosts.FirstOrDefault(b => b.Id == fromBoost.Id - 1);
            if (toBoost == null)
            {
                return new ExchangeResult
                {
                    Success = false,
                    Message = "Нет предыдущего буста для обмена"
                };
            }
        }

        var fromUserBoost = user.UserBoosts.FirstOrDefault(ub => ub.BoostId == fromBoost.Id);
        var toUserBoost = user.UserBoosts.FirstOrDefault(ub => ub.BoostId == toBoost.Id);

        if (!request.IsReverse)
        {
            //обмен 5 на 1
            if (fromUserBoost == null || fromUserBoost.Quantity < ExchangeRate)
            {
                return new ExchangeResult
                {
                    Success = false,
                    Message = $"Недостаточно бустов для обмена. Нужно {ExchangeRate}, есть {fromUserBoost?.Quantity ?? 0}"
                };
            }

            //выполняем обмен
            fromUserBoost.Quantity -= ExchangeRate;

            if (toUserBoost == null)
            {
                toUserBoost = new UserBoost
                {
                    UserId = user.Id,
                    BoostId = toBoost.Id,
                    CurrentPrice = toBoost.Price,
                    Quantity = 1
                };
                user.UserBoosts.Add(toUserBoost);
            }
            else
            {
                toUserBoost.Quantity += 1;
            }
        }
        else
        {
            //обмен 1 на 5
            if (fromUserBoost == null || fromUserBoost.Quantity < 1)
            {
                return new ExchangeResult
                {
                    Success = false,
                    Message = $"Недостаточно бустов для обмена. Нужно 1, есть {fromUserBoost?.Quantity ?? 0}"
                };
            }

            //выполняем обратный обмен
            fromUserBoost.Quantity -= 1;

            if (toUserBoost == null)
            {
                toUserBoost = new UserBoost
                {
                    UserId = user.Id,
                    BoostId = toBoost.Id,
                    CurrentPrice = toBoost.Price,
                    Quantity = ExchangeRate
                };
                user.UserBoosts.Add(toUserBoost);
            }
            else
            {
                toUserBoost.Quantity += ExchangeRate;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _scoreService.NotifyBoostChangedAsync(
            user.Id,
            fromBoost.Id,
            fromUserBoost.Quantity, 
            fromUserBoost.CurrentPrice,
            cancellationToken);

        await _scoreService.NotifyBoostChangedAsync(
            user.Id,
            toBoost.Id,
            toUserBoost.Quantity,
            toUserBoost.CurrentPrice,
            cancellationToken);

        await _scoreService.NotifyProfitChangedAsync(
            user.Id,
            user.UserBoosts.GetProfitPerClick(),
            user.UserBoosts.GetProfitPerSecond(),
            cancellationToken);

        return new ExchangeResult
        {
            Success = true,
            Message = !request.IsReverse
                ? $"Успешно обменяно {ExchangeRate} '{fromBoost.Title}' на 1 '{toBoost.Title}'"
                : $"Успешно обменяно 1 '{fromBoost.Title}' на {ExchangeRate} '{toBoost.Title}'",
            UpdatedQuantities = new Dictionary<int, int>
            {
                [fromBoost.Id] = fromUserBoost.Quantity,
                [toBoost.Id] = toUserBoost.Quantity
            }
        };
    }
}