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
  const resWasteSilverItem = $('res-waste-silver-item');
  const resSilverWaste = $('res-silver-waste');

  const vSilver = $('v-silver');
  const vCopper = $('v-copper');
  const vWasteRow = $('v-waste-row');
  const vWaste = $('v-waste');
  const vTotal = $('v-total');
  const vActualPct = $('v-actual-pct');

  const historyList = $('history-list');
  const emptyHistory = $('empty-history');
  const btnClearAll = $('btn-clear-all');

  // Block adjustment refs — Step 2 (silver)
  const step2Section = $('step2-section');
  const actualSilverIn = $('actual-silver');
  const idealSilverHint = $('ideal-silver-hint');
  const btnStep2 = $('btn-step2');

  // Block adjustment refs — Step 3 (copper)
  const step3Section = $('step3-section');
  const requiredCopperDisplay = $('required-copper-display');
  const actualCopperIn = $('actual-copper');
  const idealCopperHint = $('ideal-copper-hint');
  const btnStep3 = $('btn-step3');

  // Final result refs
  const finalResult = $('final-result');
  const blockWarningBox = $('block-warning-box');
  const blockSuccessBox = $('block-success-box');
  const adjSilver = $('adj-silver');
  const adjCopper = $('adj-copper');
  const adjWasteItem = $('adj-waste-item');
  const adjWaste = $('adj-waste');
  const adjTotalWeight = $('adj-total-weight');
  const adjWeightDiff = $('adj-weight-diff');
  const adjActualPct = $('adj-actual-pct');
  const adjCopperLabel = $('adj-copper-label');
  const adjCopperSublabel = $('adj-copper-sublabel');

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

    // Store last calc state for block adjustment
    lastCalcState = {
      totalWeight, minSilverPct, maxSilverPct,
      idealSilver: result.weightOfSilver,
      idealCopper: result.freshCopperNeeded,
      wasteUsed: result.wasteUsed,
      wastePurity: usingWaste ? wastePurity : 0,
      usingWaste
    };

    // Update Step 2 silver hint and pre-fill
    idealSilverHint.textContent = formatWeight(result.weightOfSilver);
    if (currentUnit === 'kg') {
      actualSilverIn.value = (result.weightOfSilver / 1000).toFixed(4).replace(/\.?0+$/, '');
    } else {
      actualSilverIn.value = result.weightOfSilver.toFixed(2).replace(/\.?0+$/, '');
    }

    // Reset: hide Step 3 and final result when a new ideal calc is done
    step3Section.style.display = 'none';
    finalResult.style.display = 'none';

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
      resWasteSilverItem.style.display = 'flex';
      resSilverWaste.textContent = formatWeight(verification.pureSilverFromWaste);
    } else {
      resWasteItem.style.display = 'none';
      resWasteCopperItem.style.display = 'none';
      resWasteSilverItem.style.display = 'none';
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

  // ─── BLOCK ADJUSTMENT STATE ───────────────────
  let lastCalcState = null;

  // ─── STEP 2: Silver entered → Calculate required copper ───
  btnStep2.addEventListener('click', () => {
    if (!lastCalcState) {
      return showError('Run the ideal calculation first');
    }

    const actualSilverRaw = parseFloat(actualSilverIn.value);
    if (isNaN(actualSilverRaw) || actualSilverRaw <= 0) {
      return showError('Enter a valid actual silver weight');
    }

    const actualSilver = toGrams(actualSilverRaw);
    const { wasteUsed, wastePurity, maxSilverPct } = lastCalcState;
    const silverPurity = 0.985;
    const copperSilverContent = 0.01;

    // Pure silver already contributed by silver blocks + waste
    const pureSilverFromSilver = actualSilver * silverPurity;
    const pureSilverFromWaste = wasteUsed * (wastePurity / 100);
    const silverAlready = pureSilverFromSilver + pureSilverFromWaste;

    // Solve for required copper to hit max target purity
    // targetPct/100 = (silverAlready + copper * 0.01) / (actualSilver + wasteUsed + copper)
    const targetDecimal = maxSilverPct / 100;
    let requiredCopper = (silverAlready - targetDecimal * (actualSilver + wasteUsed)) / (targetDecimal - copperSilverContent);
    requiredCopper = Math.max(requiredCopper, 0);

    // Store actual silver in state for Step 3
    lastCalcState.actualSilver = actualSilver;
    lastCalcState.requiredCopper = requiredCopper;

    // Show Step 3 with required copper prominently displayed
    const requiredCopperFormatted = formatWeight(requiredCopper);
    requiredCopperDisplay.textContent = requiredCopperFormatted;
    idealCopperHint.textContent = requiredCopperFormatted;

    // Pre-fill copper input with required value
    if (currentUnit === 'kg') {
      actualCopperIn.value = (requiredCopper / 1000).toFixed(4).replace(/\.?0+$/, '');
    } else {
      actualCopperIn.value = requiredCopper.toFixed(2).replace(/\.?0+$/, '');
    }

    // Show Step 3, hide final result
    step3Section.style.display = 'block';
    finalResult.style.display = 'none';
    step3Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ─── STEP 3: Copper entered → Calculate final result (auto-adjust if needed) ───
  btnStep3.addEventListener('click', () => {
    if (!lastCalcState || !lastCalcState.actualSilver) {
      return showError('Complete Step 2 first');
    }

    const actualCopperRaw = parseFloat(actualCopperIn.value);
    if (isNaN(actualCopperRaw) || actualCopperRaw < 0) {
      return showError('Enter a valid actual copper weight');
    }

    let actualCopper = toGrams(actualCopperRaw);
    const { actualSilver, wasteUsed, wastePurity, minSilverPct, maxSilverPct, totalWeight, usingWaste, requiredCopper } = lastCalcState;

    const silverPurity = 0.985;
    const copperSilverContent = 0.01;

    // Compute purity with user's copper
    const pureSilverFromSilver = actualSilver * silverPurity;
    const pureSilverFromWaste = wasteUsed * (wastePurity / 100);
    const silverAlready = pureSilverFromSilver + pureSilverFromWaste;

    let userCopper = actualCopper;
    let pureSilverFromCopper = actualCopper * copperSilverContent;
    let totalPureSilver = silverAlready + pureSilverFromCopper;
    let newTotalWeight = actualSilver + actualCopper + wasteUsed;
    let actualPct = newTotalWeight > 0 ? (totalPureSilver / newTotalWeight) * 100 : 0;
    let inRange = actualPct >= minSilverPct - 0.01 && actualPct <= maxSilverPct + 0.01;

    let wasAdjusted = false;
    let adjustedCopper = actualCopper;

    // If out of range, auto-adjust copper to bring purity to max or min edge
    if (!inRange) {
      wasAdjusted = true;
      let targetPct;
      if (actualPct > maxSilverPct + 0.01) {
        // Purity too high → need MORE copper to bring it down to max
        targetPct = maxSilverPct;
      } else {
        // Purity too low → need LESS copper to bring it up to min
        targetPct = minSilverPct;
      }
      const targetDecimal = targetPct / 100;
      adjustedCopper = (silverAlready - targetDecimal * (actualSilver + wasteUsed)) / (targetDecimal - copperSilverContent);
      adjustedCopper = Math.max(adjustedCopper, 0);

      // Recalculate with adjusted copper
      pureSilverFromCopper = adjustedCopper * copperSilverContent;
      totalPureSilver = silverAlready + pureSilverFromCopper;
      newTotalWeight = actualSilver + adjustedCopper + wasteUsed;
      actualPct = newTotalWeight > 0 ? (totalPureSilver / newTotalWeight) * 100 : 0;
      inRange = true; // We forced it into range
    }

    const weightDiff = newTotalWeight - totalWeight;

    // Display final result
    adjSilver.textContent = formatWeight(actualSilver);
    adjCopper.textContent = formatWeight(adjustedCopper);

    // Update copper label based on whether it was auto-adjusted
    if (wasAdjusted) {
      adjCopperLabel.textContent = 'Copper (adjusted)';
      adjCopperSublabel.textContent = 'auto-corrected for purity';
    } else {
      adjCopperLabel.textContent = 'Copper (actual)';
      adjCopperSublabel.textContent = 'from your blocks';
    }

    if (usingWaste && wasteUsed > 0) {
      adjWasteItem.style.display = 'flex';
      adjWaste.textContent = formatWeight(wasteUsed);
    } else {
      adjWasteItem.style.display = 'none';
    }

    adjTotalWeight.textContent = formatWeight(newTotalWeight);
    if (weightDiff >= 0) {
      adjWeightDiff.textContent = '+' + formatWeight(weightDiff);
    } else {
      adjWeightDiff.textContent = '−' + formatWeight(Math.abs(weightDiff));
    }
    adjActualPct.textContent = actualPct.toFixed(2) + '%';
    adjActualPct.style.color = '';

    // Messages
    if (wasAdjusted) {
      blockWarningBox.style.display = 'none';
      blockSuccessBox.textContent = `✓ Your copper (${formatWeight(userCopper)}) was adjusted to ${formatWeight(adjustedCopper)} to keep purity at ${actualPct.toFixed(2)}% (within ${minSilverPct}% – ${maxSilverPct}% range).`;
      blockSuccessBox.style.display = 'block';
    } else {
      blockWarningBox.style.display = 'none';
      blockSuccessBox.textContent = `✓ Purity ${actualPct.toFixed(2)}% is within your desired range (${minSilverPct}% – ${maxSilverPct}%). Good to go!`;
      blockSuccessBox.style.display = 'block';
    }

    finalResult.style.display = 'block';
    finalResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

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
