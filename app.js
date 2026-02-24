/* ============================================
   ALLOY CALCULATOR — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ─── DOM REFS ───────────────────────────────────
  const $ = id => document.getElementById(id);

  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  const form = $('calc-form');
  const totalWeightIn = $('total-weight');
  const silverPctMinIn = $('silver-pct-min');
  const silverPctMaxIn = $('silver-pct-max');
  const useWasteToggle = $('use-waste');
  const wasteFields = $('waste-fields');
  const grossWasteIn = $('gross-waste');
  const bagWeightIn = $('bag-weight');
  const wastePurityIn = $('waste-purity');
  const usableWasteRow = $('usable-waste-row');
  const usableWasteDisp = $('usable-waste-display');

  const resultsContainer = $('results-container');
  const warningBox = $('warning-box');
  const resSilver = $('res-silver');
  const resCopper = $('res-copper');
  const resWasteItem = $('res-waste-item');
  const resWasteUsed = $('res-waste-used');
  const resWastePurity = $('res-waste-purity-label');
  const resWasteCopperItem = $('res-waste-copper-item');
  const resCopperWaste = $('res-copper-waste');

  const vSilver = $('v-silver');
  const vCopper = $('v-copper');
  const vWasteRow = $('v-waste-row');
  const vWaste = $('v-waste');
  const vTotal = $('v-total');
  const vActualPct = $('v-actual-pct');

  const historyList = $('history-list');
  const emptyHistory = $('empty-history');
  const historyBadge = $('history-badge');
  const btnClearAll = $('btn-clear-all');

  // ─── UNIT TOGGLE STATE ─────────────────────────
  let currentUnit = 'g'; // 'g' or 'kg'
  const unitToggle = $('unit-toggle');
  const unitBtns = unitToggle.querySelectorAll('.unit-btn');
  const weightUnitLabels = document.querySelectorAll('.weight-unit-label');

  unitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const newUnit = btn.dataset.unit;
      if (newUnit === currentUnit) return;

      // Switch active class
      unitBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Convert displayed value
      const currentVal = parseFloat(totalWeightIn.value);
      if (!isNaN(currentVal) && currentVal > 0) {
        if (newUnit === 'kg') {
          totalWeightIn.value = (currentVal / 1000).toFixed(4).replace(/\.?0+$/, '');
        } else {
          totalWeightIn.value = (currentVal * 1000).toFixed(2).replace(/\.?0+$/, '');
        }
      }

      // Convert waste fields too
      [grossWasteIn, bagWeightIn].forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
          if (newUnit === 'kg') {
            input.value = (val / 1000).toFixed(4).replace(/\.?0+$/, '');
          } else {
            input.value = (val * 1000).toFixed(2).replace(/\.?0+$/, '');
          }
        }
      });

      // Update placeholder text
      if (newUnit === 'kg') {
        totalWeightIn.placeholder = 'e.g. 0.1';
        grossWasteIn.placeholder = 'e.g. 0.05';
        bagWeightIn.placeholder = 'e.g. 0.002';
      } else {
        totalWeightIn.placeholder = 'e.g. 100';
        grossWasteIn.placeholder = 'e.g. 50';
        bagWeightIn.placeholder = 'e.g. 2';
      }

      currentUnit = newUnit;

      // Update all weight unit labels
      weightUnitLabels.forEach(label => {
        label.textContent = currentUnit;
      });

      // Update usable waste display
      updateUsableWaste();
    });
  });

  // Convert to grams for calculation
  function toGrams(value) {
    return currentUnit === 'kg' ? value * 1000 : value;
  }

  // Format weight for display with current unit
  function formatWeight(grams) {
    if (currentUnit === 'kg') {
      return (grams / 1000).toFixed(4).replace(/\.?0+$/, '') + ' kg';
    }
    return grams.toFixed(2) + ' g';
  }

  // ─── ALLOY CALCULATION (ported from touch.py) ──
  function calculateAlloyWeights(totalWeight, desiredSilverPct, wasteWeight = 0, wastePurity = 0) {
    const desiredSilverDecimal = desiredSilverPct / 100;
    const silverPurity = 0.985;
    const copperPurity = 0.99;
    const silverInCopper = 0.01;

    let guidance = '';
    let maxWasteUsage = null;

    // If waste exceeds total order weight, limit it
    if (wasteWeight > totalWeight) {
      maxWasteUsage = (desiredSilverDecimal * totalWeight) / (wastePurity / 100);
      if (maxWasteUsage > totalWeight) {
        maxWasteUsage = totalWeight;
      }
      guidance =
        'WARNING: You entered more waste than required for your order. ' +
        `Use no more than ${maxWasteUsage.toFixed(2)} grams of waste with ${wastePurity.toFixed(2)}% purity ` +
        'to achieve your desired alloy. Ignore the excess waste and use the recommended amount only.';
      wasteWeight = maxWasteUsage;
    }

    // Waste alloy calculations
    const pureSilverFromWaste = wasteWeight > 0 ? wasteWeight * (wastePurity / 100) : 0;
    const copperFromWasteRaw = wasteWeight > 0 ? wasteWeight - pureSilverFromWaste : 0;
    const pureSilverNeeded = Math.max(desiredSilverDecimal * totalWeight - pureSilverFromWaste, 0);

    let weightOfSilver = 0;
    if (pureSilverNeeded > 0) {
      weightOfSilver = (pureSilverNeeded - silverInCopper * (totalWeight - wasteWeight)) / (silverPurity - silverInCopper);
    }

    let totalCopperNeeded = totalWeight - weightOfSilver - wasteWeight;
    let freshCopperNeeded = Math.max(totalCopperNeeded - copperFromWasteRaw, 0);

    weightOfSilver = Math.max(weightOfSilver, 0);
    totalCopperNeeded = Math.max(totalCopperNeeded, 0);
    freshCopperNeeded = Math.max(freshCopperNeeded, 0);
    const copperFromWaste = Math.max(copperFromWasteRaw, 0);

    return { weightOfSilver, freshCopperNeeded, copperFromWaste, wasteUsed: wasteWeight, guidance };
  }

  // ─── UI: TAB SWITCHING ─────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      views.forEach(v => {
        v.classList.remove('active');
        if (v.id === `view-${target}`) v.classList.add('active');
      });
      if (target === 'history') renderHistory();
    });
  });

  // ─── UI: WASTE TOGGLE ─────────────────────────
  useWasteToggle.addEventListener('change', () => {
    wasteFields.style.display = useWasteToggle.checked ? 'block' : 'none';
    if (!useWasteToggle.checked) {
      grossWasteIn.value = '';
      bagWeightIn.value = '';
      wastePurityIn.value = '';
      usableWasteRow.style.display = 'none';
    }
  });

  // Live compute usable waste
  function updateUsableWaste() {
    const gross = parseFloat(grossWasteIn.value) || 0;
    const bag = parseFloat(bagWeightIn.value) || 0;
    if (gross > 0 && bag >= 0) {
      const usable = Math.max(gross - bag, 0);
      usableWasteDisp.textContent = usable.toFixed(currentUnit === 'kg' ? 4 : 2).replace(/\.?0+$/, '') + (currentUnit === 'kg' ? ' kg' : ' grams');
      usableWasteRow.style.display = 'block';
    } else {
      usableWasteRow.style.display = 'none';
    }
  }
  grossWasteIn.addEventListener('input', updateUsableWaste);
  bagWeightIn.addEventListener('input', updateUsableWaste);

  // ─── ERROR TOAST ───────────────────────────────
  let toastTimer;
  function showError(msg) {
    let toast = document.querySelector('.error-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'error-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
      toast.classList.add('show');
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    });
  }

  // ─── FORM SUBMISSION ──────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();

    const rawWeight = parseFloat(totalWeightIn.value);
    const totalWeight = toGrams(rawWeight);
    const minSilverPct = parseFloat(silverPctMinIn.value);
    const maxSilverPct = parseFloat(silverPctMaxIn.value) || 98.5;

    // Validate
    if (isNaN(rawWeight) || rawWeight <= 0) {
      return showError('Total weight must be greater than 0');
    }
    if (isNaN(minSilverPct) || minSilverPct < 1 || minSilverPct > 98.5) {
      return showError('Min silver percentage must be between 1% and 98.5%');
    }
    if (maxSilverPct < minSilverPct) {
      return showError('Max silver % must be ≥ Min silver %');
    }
    if (maxSilverPct > 98.5) {
      return showError('Max silver percentage cannot exceed 98.5%');
    }

    // Target the max purity for calculation
    const desiredSilverPct = maxSilverPct;

    let wasteWeight = 0;
    let wastePurity = 0;
    const usingWaste = useWasteToggle.checked;

    if (usingWaste) {
      const grossWaste = toGrams(parseFloat(grossWasteIn.value) || 0);
      const bagWeight = toGrams(parseFloat(bagWeightIn.value) || 0);
      wasteWeight = grossWaste - bagWeight;
      wastePurity = parseFloat(wastePurityIn.value) || 0;

      if (wasteWeight <= 0 || wastePurity <= 0 || wastePurity > 98.5) {
        return showError('Enter valid waste weight and purity (1%–98.5%)');
      }
    }

    // Calculate targeting max purity
    const result = calculateAlloyWeights(totalWeight, desiredSilverPct, wasteWeight, wastePurity);

    // Verification values
    const pureSilverFromSilver = result.weightOfSilver * 0.985;
    const pureSilverFromCopper = result.freshCopperNeeded * 0.01;
    const pureSilverFromWaste = result.wasteUsed * (wastePurity / 100);
    const totalPureSilver = pureSilverFromSilver + pureSilverFromCopper + pureSilverFromWaste;
    const actualPct = (totalPureSilver / totalWeight) * 100;

    // Check if actual purity is within the desired range
    let rangeWarning = '';
    if (actualPct < minSilverPct - 0.01) {
      rangeWarning = `⚠ The achieved purity (${actualPct.toFixed(2)}%) is below your minimum desired purity of ${minSilverPct}%. ` +
        'Consider adjusting the waste amount or purity parameters.';
    }

    // Combine warnings
    let combinedGuidance = result.guidance;
    if (rangeWarning) {
      combinedGuidance = combinedGuidance ? combinedGuidance + '\n\n' + rangeWarning : rangeWarning;
    }

    // Display results
    displayResults({ ...result, guidance: combinedGuidance }, wastePurity, usingWaste, {
      pureSilverFromSilver, pureSilverFromCopper, pureSilverFromWaste,
      totalPureSilver, actualPct
    }, minSilverPct, maxSilverPct);

    // Save to history
    saveToHistory({
      timestamp: Date.now(),
      totalWeight,
      weightUnit: currentUnit,
      minSilverPct,
      maxSilverPct,
      usingWaste,
      wasteWeight: usingWaste ? wasteWeight : 0,
      wastePurity: usingWaste ? wastePurity : 0,
      silverWeight: result.weightOfSilver,
      freshCopperWeight: result.freshCopperNeeded,
      copperFromWaste: result.copperFromWaste,
      wasteUsed: result.wasteUsed,
      actualPct,
      guidance: combinedGuidance
    });
  });

  // ─── DISPLAY RESULTS ───────────────────────────
  function displayResults(result, wastePurity, usingWaste, verification, minPct, maxPct) {
    // Warning
    if (result.guidance) {
      warningBox.textContent = result.guidance;
      warningBox.style.display = 'block';
    } else {
      warningBox.style.display = 'none';
    }

    // Main values
    resSilver.textContent = formatWeight(result.weightOfSilver);
    resCopper.textContent = formatWeight(result.freshCopperNeeded);

    if (usingWaste && result.wasteUsed > 0) {
      resWasteItem.style.display = 'flex';
      resWasteUsed.textContent = formatWeight(result.wasteUsed);
      resWastePurity.textContent = wastePurity.toFixed(2) + '% purity';
      resWasteCopperItem.style.display = 'flex';
      resCopperWaste.textContent = formatWeight(result.copperFromWaste);
    } else {
      resWasteItem.style.display = 'none';
      resWasteCopperItem.style.display = 'none';
    }

    // Verification
    vSilver.textContent = formatWeight(verification.pureSilverFromSilver);
    vCopper.textContent = formatWeight(verification.pureSilverFromCopper);

    if (usingWaste && result.wasteUsed > 0) {
      vWasteRow.style.display = 'flex';
      vWaste.textContent = formatWeight(verification.pureSilverFromWaste);
    } else {
      vWasteRow.style.display = 'none';
    }

    vTotal.textContent = formatWeight(verification.totalPureSilver);
    vActualPct.textContent = verification.actualPct.toFixed(2) + '%';

    // Color the actual pct based on range compliance
    if (verification.actualPct >= minPct - 0.01 && verification.actualPct <= maxPct + 0.01) {
      vActualPct.parentElement.style.color = '';
    } else {
      vActualPct.style.color = '#c0534f';
    }

    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── HISTORY (localStorage) ────────────────────
  const STORAGE_KEY = 'alloy_calc_history';

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveToHistory(entry) {
    const history = getHistory();
    history.unshift(entry); // newest first
    if (history.length > 200) history.length = 200; // cap
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    updateBadge(history.length);
  }

  function deleteHistoryEntry(index) {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
  }

  function clearAllHistory() {
    if (confirm('Clear all history? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
    }
  }

  function updateBadge(count) {
    if (count > 0) {
      historyBadge.textContent = count;
      historyBadge.style.display = 'flex';
    } else {
      historyBadge.style.display = 'none';
    }
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year}  ${hours}:${mins}`;
  }

  function renderHistory() {
    const history = getHistory();
    updateBadge(history.length);

    // Clear the list but preserve the empty state element
    historyList.innerHTML = '';

    if (history.length === 0) {
      btnClearAll.style.display = 'none';
      const emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>No calculations yet</p>
        <span>Your calculations will appear here</span>
      `;
      historyList.appendChild(emptyEl);
      return;
    }

    btnClearAll.style.display = 'inline-flex';

    history.forEach((entry, i) => {
      const card = document.createElement('div');
      card.className = 'history-card';

      // Format purity display
      const purityDisplay = entry.maxSilverPct
        ? `${entry.minSilverPct.toFixed(1)}–${entry.maxSilverPct.toFixed(1)}% Ag`
        : `${(entry.desiredSilverPct || entry.minSilverPct || 0).toFixed(2)}% Ag`;

      // Format weight display (support old entries without weightUnit)
      const weightUnit = entry.weightUnit || 'g';
      const displayWeight = weightUnit === 'kg'
        ? (entry.totalWeight / 1000).toFixed(4).replace(/\.?0+$/, '') + ' kg'
        : entry.totalWeight.toFixed(2) + ' g';

      const wasteInfo = entry.usingWaste && entry.wasteUsed > 0
        ? `<div class="history-detail">
             <span class="history-detail-label">Waste Used</span>
             <span class="history-detail-value waste-val">${entry.wasteUsed.toFixed(2)} g</span>
           </div>`
        : '';

      card.innerHTML = `
        <div class="history-card-header">
          <div>
            <div class="history-date">${formatDate(entry.timestamp)}</div>
            <div class="history-order-info">${displayWeight} @ ${purityDisplay}</div>
          </div>
          <button class="btn-delete-history" data-index="${i}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="history-details">
          <div class="history-detail">
            <span class="history-detail-label">Silver</span>
            <span class="history-detail-value silver-val">${entry.silverWeight.toFixed(2)} g</span>
          </div>
          <div class="history-detail">
            <span class="history-detail-label">Fresh Copper</span>
            <span class="history-detail-value copper-val">${entry.freshCopperWeight.toFixed(2)} g</span>
          </div>
          ${wasteInfo}
          <div class="history-detail">
            <span class="history-detail-label">Actual Ag%</span>
            <span class="history-detail-value pct-val">${entry.actualPct.toFixed(2)}%</span>
          </div>
        </div>
      `;

      historyList.appendChild(card);
    });

    // Attach delete handlers
    historyList.querySelectorAll('.btn-delete-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        deleteHistoryEntry(idx);
      });
    });
  }

  btnClearAll.addEventListener('click', clearAllHistory);

  // Initial badge update
  updateBadge(getHistory().length);

  // ─── SERVICE WORKER ────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    });
  }

})();
