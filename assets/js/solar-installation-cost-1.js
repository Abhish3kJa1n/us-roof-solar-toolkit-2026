(() => {
  'use strict';
  const BENCHMARK_USD_PER_W = 2.62;
  const quoteEl = document.getElementById('pvCashPrice');
  const sizeEl = document.getElementById('pvSystemSize');
  const runButton = document.getElementById('checkSolarQuote');
  const resetButton = document.getElementById('resetSolarQuote');
  const resultEl = document.getElementById('solarQuoteResult');
  if (!quoteEl || !sizeEl || !runButton || !resetButton || !resultEl) return;

  const money = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(value);
  const number = value => new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(value);
  const dollarsPerWatt = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);
  const showError = message => {
    resultEl.innerHTML = `<div class="kicker">Check inputs</div><div class="big">Unable to compare</div><p>${message}</p>`;
  };

  runButton.addEventListener('click', () => {
    const priceRaw = quoteEl.value.trim();
    const sizeRaw = sizeEl.value.trim();
    if (!priceRaw || !sizeRaw) {
      showError('Enter both the itemized PV-only installed cash price and the DC system capacity from the written proposal.');
      return;
    }
    const price = Number(priceRaw);
    const sizeKw = Number(sizeRaw);
    if (!Number.isFinite(price) || price < 1 || price > 2000000) {
      showError('Enter a PV-only installed cash price from $1 to $2,000,000.');
      return;
    }
    if (!Number.isFinite(sizeKw) || sizeKw < 0.5 || sizeKw > 100) {
      showError('Enter a DC system size from 0.5 to 100 kW. Use the module nameplate total, not inverter AC output.');
      return;
    }
    const watts = sizeKw * 1000;
    const pricePerWatt = price / watts;
    const benchmarkTotal = watts * BENCHMARK_USD_PER_W;
    const difference = pricePerWatt - BENCHMARK_USD_PER_W;
    const pct = difference / BENCHMARK_USD_PER_W * 100;
    const comparison = Math.abs(pct) < 0.05
      ? 'approximately equal to'
      : pct > 0 ? `${number(Math.abs(pct))}% above` : `${number(Math.abs(pct))}% below`;
    const deltaText = Math.abs(price - benchmarkTotal) < 0.5
      ? 'The entered amount is approximately equal to the arithmetic benchmark amount for this capacity.'
      : `At the reference rate, the arithmetic amount for this capacity is ${money(benchmarkTotal)}. Your entered price differs by ${money(Math.abs(price - benchmarkTotal))}.`;
    resultEl.innerHTML = `<div class="kicker">Your comparable PV-only quote</div><div class="big">${dollarsPerWatt(pricePerWatt)}/W</div><p>Your price is ${comparison} EnergySage's H1 2026 solar-only marketplace median of ${dollarsPerWatt(BENCHMARK_USD_PER_W)}/W (before incentives).</p><p>${deltaText}</p><p><strong>Do not read this as a fair-price verdict.</strong> The benchmark is a marketplace median, not a quote for your property. Compare module and inverter models, estimated annual production, roof and electrical scope, permits, warranties and installer quality before drawing a conclusion.</p>`;
  });

  resetButton.addEventListener('click', () => {
    quoteEl.value = '';
    sizeEl.value = '';
    resultEl.innerHTML = '<div class="kicker">Quote comparison</div><div class="big">Enter a written quote</div><p>The checker will calculate your PV-only cash price per DC watt and compare it with EnergySage\'s H1 2026 solar-only marketplace median. The comparison is not a valuation or a finding that a quote is fair or unfair.</p>';
    quoteEl.focus();
  });
})();
