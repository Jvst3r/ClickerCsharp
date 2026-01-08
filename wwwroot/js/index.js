document.addEventListener('DOMContentLoaded', function () {
    const connection = new signalR.HubConnectionBuilder()
        .withUrl('http://localhost:5097/clickerHub')//у меня signalR почему то не работал, вот это помогло(и еще надо запускать через http)
        .withAutomaticReconnect()
        .build();

    connection.start()
        .then(function () {
            console.log('Connection started');
        })
        .catch(function (err) {
            return console.error(err.toString());
        });

    connection.on('ScoreUpdated', function (current, record) {
        const currentScoreElement = document.getElementById('currentScore');
        const recordScoreElement = document.getElementById('recordScore');

        currentScoreElement.textContent = current;
        recordScoreElement.textContent = record;

        updateBoostsAvailability();
    });

    connection.on('ProfitUpdated', function (profitPerClick, profitPerSecond) {
        const profitPerClickElement = document.getElementById('profitPerClick');
        const profitPerSecondElement = document.getElementById('profitPerSecond');

        profitPerClickElement.textContent = profitPerClick;
        profitPerSecondElement.textContent = profitPerSecond;
    });

    connection.on('BoostUpdated', function (boostId, quantity, currentPrice) {
        const boostElement = document.querySelector(`[data-boost-id="${boostId}"]`);

        const priceElement = boostElement.querySelector('[data-boost-price]');
        const quantityElement = boostElement.querySelector('[data-boost-quantity]');

        priceElement.textContent = currentPrice;
        quantityElement.textContent = quantity;

        updateBoostsAvailability();

        updateExchangeDropdowns(); //обновление gui обмена  при изменении кол-ва доступных 
    });

    const clickButton = document.getElementById('click-item');
    clickButton.addEventListener('click', async function () {
        const clickCount = 1; // You can change this to the actual click count
        await connection.invoke('RegisterClicks', clickCount);
    });

    const boostElements = document.querySelectorAll('.boost-item');

    boostElements.forEach(function (boostElement) {
        const boostId = boostElement.getAttribute('data-boost-id');
        const buyButton = boostElement.querySelector('.buy-boost-button');

        buyButton.addEventListener('click', async function () {
            connection.invoke('BuyBoost', parseInt(boostId, 10));
        });
    });

    updateBoostsAvailability();

    function updateBoostsAvailability() {
        const currentScoreElement = document.getElementById('currentScore');

        const currentScore = parseInt(currentScoreElement.textContent, 10);

        boostElements.forEach(function (boostElement) {
            const priceElement = boostElement.querySelector('[data-boost-price]');
            const buyButton = boostElement.querySelector('.buy-boost-button');

            if (currentScore < parseInt(priceElement.textContent, 10)) {
                boostElement.classList.add('disabled');
                buyButton.disabled = true;
            } else {
                boostElement.classList.remove('disabled');
                buyButton.disabled = false;
            }
        });
    }







    //ОБМЕН БУСТОВ
    const exchangeFromBoost = document.getElementById('exchangeFromBoost');
    const exchangeToName = document.getElementById('exchangeToName');
    const btnExchange = document.getElementById('btnExchange');
    const reverseFromBoost = document.getElementById('reverseFromBoost');
    const reverseToName = document.getElementById('reverseToName');
    const btnReverseExchange = document.getElementById('btnReverseExchange');
    const exchangeMessage = document.getElementById('exchangeMessage');

 
    async function performExchange(fromBoostId, isReverse = false) {
        const endpoint = isReverse ? '/api/exchange/reverse-exchange' : '/api/exchange/exchange';
        const button = isReverse ? btnReverseExchange : btnExchange;
        const originalText = button.textContent;

        // загрузочка
        button.disabled = true;
        button.textContent = 'Обмен...';

        if (exchangeMessage) {
            exchangeMessage.textContent = '';
            exchangeMessage.style.color = '';
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    fromBoostId: parseInt(fromBoostId)
                })
            });

            const result = await response.json();

            if (result.success) {
                if (result.updatedQuantities) {
                    Object.keys(result.updatedQuantities).forEach(boostId => {
                        const quantity = result.updatedQuantities[boostId];
                        const boostElement = document.querySelector(`[data-boost-id="${boostId}"]`);
                        if (boostElement) {
                            const quantityElement = boostElement.querySelector('[data-boost-quantity]');
                            if (quantityElement) {
                                quantityElement.textContent = quantity;
                            }
                        }
                    });
                }

                updateBoostsAvailability();
                showExchangeMessage(result.message, true);
                updateExchangeDropdowns();

            } else {
                showExchangeMessage(result.message || 'Ошибка обмена', false);
            }
        } catch (error) {
            console.error('Exchange error:', error);
            showExchangeMessage('Ошибка сети при обмене', false);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
            updateExchangeButtons();
        }
    }

    function updateExchangeButtons() {
        //для обмена 5 на 1
        if (exchangeFromBoost && btnExchange) {
            const selectedOption = exchangeFromBoost.options[exchangeFromBoost.selectedIndex];
            const isValid = selectedOption && selectedOption.value && !selectedOption.disabled;
            btnExchange.disabled = !isValid;

            if (isValid && selectedOption.dataset.nextName) {
                exchangeToName.textContent = selectedOption.dataset.nextName;
            } else {
                exchangeToName.textContent = '-';
            }
        }

        //для обмена 1 на 5
        if (reverseFromBoost && btnReverseExchange) {
            const selectedOption = reverseFromBoost.options[reverseFromBoost.selectedIndex];
            const isValid = selectedOption && selectedOption.value && !selectedOption.disabled;
            btnReverseExchange.disabled = !isValid;

            if (isValid && selectedOption.dataset.prevName) {
                reverseToName.textContent = selectedOption.dataset.prevName;
            } else {
                reverseToName.textContent = '-';
            }
        }
    }

    function updateExchangeDropdowns() {

        const exchangeContainer = document.getElementById('exchange');
        if (!exchangeContainer) {
            return;
        }

        const boostData = {};
        boostElements.forEach(boostElement => {
            const boostId = boostElement.getAttribute('data-boost-id');
            const quantityElement = boostElement.querySelector('[data-boost-quantity]');
            const nameElement = boostElement.querySelector('h6');

            if (quantityElement && nameElement) {
                boostData[boostId] = {
                    quantity: parseInt(quantityElement.textContent) || 0,
                    name: nameElement.textContent.trim()
                };
            }
        });

        if (exchangeFromBoost) {
            const currentValue = exchangeFromBoost.value;
            exchangeFromBoost.innerHTML = '<option value="">Выберите буст для обмена</option>';

            Object.keys(boostData).forEach(boostId => {
                const data = boostData[boostId];
                const nextBoostId = parseInt(boostId) + 1;
                const nextBoost = boostData[nextBoostId];

                if (nextBoost && data.quantity >= 5) {
                    const option = document.createElement('option');
                    option.value = boostId;
                    option.textContent = `${data.name} (есть ${data.quantity})`;
                    option.dataset.nextName = nextBoost.name;
                    exchangeFromBoost.appendChild(option);
                }
            });

            if (currentValue && [...exchangeFromBoost.options].some(opt => opt.value === currentValue)) {
                exchangeFromBoost.value = currentValue;
            } else {
                exchangeFromBoost.value = '';
            }
        }

        if (reverseFromBoost) {
            const currentValue = reverseFromBoost.value;
            reverseFromBoost.innerHTML = '<option value="">Выберите буст для обмена</option>';

            Object.keys(boostData).forEach(boostId => {
                const data = boostData[boostId];
                const prevBoostId = parseInt(boostId) - 1;
                const prevBoost = boostData[prevBoostId];

                if (prevBoost && data.quantity >= 1) {
                    const option = document.createElement('option');
                    option.value = boostId;
                    option.textContent = `${data.name} (есть ${data.quantity})`;
                    option.dataset.prevName = prevBoost.name;
                    reverseFromBoost.appendChild(option);
                }
            });

            if (currentValue && [...reverseFromBoost.options].some(opt => opt.value === currentValue)) {
                reverseFromBoost.value = currentValue;
            } else {
                reverseFromBoost.value = '';
            }
        }

        updateExchangeButtons();
    }

    //показывает сообщение об обмене
    function showExchangeMessage(text, isSuccess) {
        if (exchangeMessage) {
            exchangeMessage.textContent = text;
            exchangeMessage.style.color = isSuccess ? '#4CAF50' : '#f44336';
            exchangeMessage.style.fontWeight = 'bold';

            //5 секунд на сообщение
            setTimeout(() => {
                if (exchangeMessage.textContent === text) {
                    exchangeMessage.textContent = '';
                }
            }, 5000);
        }
    }

    function initializeExchange() {
        if (!exchangeFromBoost || !btnExchange) {
            return;
        }

        exchangeFromBoost.addEventListener('change', () => {
            updateExchangeButtons();
        });

        btnExchange.addEventListener('click', async () => {
            if (!exchangeFromBoost.value) return;
            await performExchange(exchangeFromBoost.value, false);
        });

        if (reverseFromBoost && btnReverseExchange) {
            reverseFromBoost.addEventListener('change', () => {
                updateExchangeButtons();
            });

            btnReverseExchange.addEventListener('click', async () => {
                if (!reverseFromBoost.value) return;
                await performExchange(reverseFromBoost.value, true);
            });
        }

        updateExchangeDropdowns(); //обновление списков
        updateExchangeButtons();   //обновление кнопок
    }

    //проверка загрузки обмена
    function checkExchangeElements() {
        const exchangeContainer = document.getElementById('exchange');
        if (exchangeContainer) {
            initializeExchange();
        }
        else {
            setTimeout(checkExchangeElements, 100);
        }
    }

    checkExchangeElements();
});