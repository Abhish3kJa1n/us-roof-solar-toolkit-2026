(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const cashEl = get('cashPrice');
  const principalEl = get('loanPrincipal');
  const downEl = get('downPayment');
  const aprEl = get('apr');
  const termEl = get('termYears');
  const scopeEl = get('sameScope');
  const resultEl = get('loanResult');
  const calculate = get('calculateLoan');
  const reset = get('resetLoan');
  if (!cashEl || !principalEl || !downEl || !aprEl || !termEl || !scopeEl || !resultEl || !calculate || !reset) return;

  const currency = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(value);
  const percent = value => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;
  const showError = message => {
    resultEl.innerHTML = `<div class="kicker">Check the written terms</div><div class="big">Unable to calculate</div><p>${message}</p>`;
  };

  calculate.addEventListener('click', () => {
    const raw = {
      cash: cashEl.value.trim(),
      principal: principalEl.value.trim(),
      down: downEl.value.trim(),
      apr: aprEl.value.trim(),
      term: termEl.value.trim()
    };
    if (!raw.cash || !raw.principal || !raw.apr || !raw.term) {
      showError('Enter the cash price, loan principal, APR and full loan term. Down payment is optional; blank means $0.');
      return;
    }
    const cash = Number(raw.cash);
    const principal = Number(raw.principal);
    const down = raw.down === '' ? 0 : Number(raw.down);
    const apr = Number(raw.apr);
    const years = Number(raw.term);
    if (!Number.isFinite(cash) || cash < 1 || cash > 2000000) {
      showError('Enter a cash project price from $1 to $2,000,000.'); return;
    }
    if (!Number.isFinite(principal) || principal < 1 || principal > 2000000) {
      showError('Enter the actual loan principal from $1 to $2,000,000.'); return;
    }
    if (!Number.isFinite(down) || down < 0 || down > 2000000) {
      showError('Enter a separate down payment from $0 to $2,000,000.'); return;
    }
    if (!Number.isFinite(apr) || apr < 0 || apr > 40) {
      showError('Enter an APR from 0% to 40%. Use the disclosed APR, not only the note rate.'); return;
    }
    if (!Number.isFinite(years) || years < 1 || years > 40) {
      showError('Enter a full loan term from 1 to 40 years.'); return;
    }

    const months = Math.round(years * 12);
    const monthlyRate = apr / 1200;
    const monthlyPayment = monthlyRate === 0
      ? principal / months
      : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    const scheduledPayments = monthlyPayment * months;
    const interest = scheduledPayments - principal;
    const totalOutlay = down + scheduledPayments;
    const totalAcquisitionAmount = principal + down;

    let scopeComparison;
    if (scopeEl.checked) {
      const difference = totalAcquisitionAmount - cash;
      const pct = difference / cash * 100;
      if (Math.abs(difference) < 0.5) {
        scopeComparison = `<p><strong>Same-scope acquisition amount:</strong> ${currency(totalAcquisitionAmount)}, approximately equal to the ${currency(cash)} cash quote.</p>`;
      } else if (difference > 0) {
        scopeComparison = `<p><strong>Financed acquisition amount above cash quote:</strong> ${currency(difference)} (${percent(pct)}). This is a difference to itemise—not proof that the full amount is a dealer fee. It may include lender/program fees, equipment or project add-ons, or a mismatch in quoted scope.</p>`;
      } else {
        scopeComparison = `<p><strong>Financed acquisition amount below cash quote:</strong> ${currency(Math.abs(difference))} (${percent(Math.abs(pct))}). Check whether the loan omits work, assumes a deposit/discount or covers a different project scope.</p>`;
      }
    } else {
      scopeComparison = '<p><strong>Cash-price comparison not calculated:</strong> confirm that both proposals cover the exact same equipment and work, then tick the same-scope box and calculate again.</p>';
    }

    resultEl.innerHTML = `<div class="kicker">Illustrative fixed-rate loan calculation</div><div class="big">${currency(monthlyPayment)} / month</div><p>Scheduled monthly payment over ${months.toLocaleString('en-US')} months at ${apr.toFixed(2)}% APR.</p><p><strong>Total scheduled loan payments:</strong> ${currency(scheduledPayments)}</p><p><strong>Estimated interest over the full schedule:</strong> ${currency(interest)}</p><p><strong>Separate down payment:</strong> ${currency(down)}</p><p><strong>Total modeled cash outlay:</strong> ${currency(totalOutlay)} (down payment + scheduled loan payments)</p>${scopeComparison}<p><strong>Critical limitation:</strong> this is a mathematical amortization illustration. If the actual contract has a required prepayment, balloon, payment step-up, re-amortization or fee paid outside the principal, this result is not the contractual schedule.</p>`;
  });

  reset.addEventListener('click', () => {
    [cashEl, principalEl, downEl, aprEl, termEl].forEach(el => { el.value = ''; });
    scopeEl.checked = false;
    resultEl.innerHTML = '<div class="kicker">Financing comparison</div><div class="big">Enter the written terms</div><p>Monthly payment, total scheduled payments, estimated interest and—only when scope matches—the difference between loan-funded acquisition cost and cash price will be calculated.</p>';
    cashEl.focus();
  });
})();
