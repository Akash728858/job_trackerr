/**
 * Job Notification Tracker
 * Main application logic: filtering, rendering, localStorage
 */

// State
let allJobs = [];
let filteredJobs = [];
let savedJobIds = new Set();
let preferences = null;

// Job status: localStorage key jobTrackerStatus = { [jobId]: status }
const JOB_TRACKER_STATUS_KEY = 'jobTrackerStatus';
const JOB_TRACKER_STATUS_UPDATES_KEY = 'jobTrackerStatusUpdates';
const STATUS_VALUES = ['Not Applied', 'Applied', 'Rejected', 'Selected'];

const JNT_TEST_CHECKLIST_KEY = 'jnt-test-checklist';
const JNT_TEST_COUNT = 10;

const JNT_PROOF_LINKS_KEY = 'jnt-proof-links';
const PROOF_LINK_KEYS = ['lovable', 'github', 'deployed'];

// Initialize
function init() {
  allJobs = [...JOBS_DATA];
  filteredJobs = [...JOBS_DATA];
  loadSavedJobs();
  loadPreferences();
  populateLocationFilter();
  setupEventListeners();
  setupSettingsForm();
  handleFilter(); // Initial filter and render
  renderSaved();
  checkPreferencesBanner();
}

// Load saved jobs from localStorage
function loadSavedJobs() {
  try {
    const saved = localStorage.getItem('jnt-saved-jobs');
    if (saved) {
      savedJobIds = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.error('Error loading saved jobs:', e);
  }
}

// Save job IDs to localStorage
function saveJobIds() {
  try {
    localStorage.setItem('jnt-saved-jobs', JSON.stringify(Array.from(savedJobIds)));
  } catch (e) {
    console.error('Error saving jobs:', e);
  }
}

// ---------- Job status (persist in localStorage) ----------
function getJobStatusMap() {
  try {
    const raw = localStorage.getItem(JOB_TRACKER_STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function getJobStatus(jobId) {
  const map = getJobStatusMap();
  const s = map[jobId];
  return (s && STATUS_VALUES.includes(s)) ? s : 'Not Applied';
}

function setJobStatus(jobId, status) {
  if (!STATUS_VALUES.includes(status)) return;
  const map = getJobStatusMap();
  map[jobId] = status;
  try {
    localStorage.setItem(JOB_TRACKER_STATUS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving job status:', e);
  }
  // Record for Recent Status Updates (Applied, Rejected, Selected only)
  if (status !== 'Not Applied') {
    const job = JOBS_DATA.find(j => j.id === jobId);
    if (job) {
      const updates = getStatusUpdatesList();
      updates.unshift({
        jobId,
        title: job.title,
        company: job.company,
        status,
        dateChanged: new Date().toISOString()
      });
      const maxUpdates = 50;
      try {
        localStorage.setItem(JOB_TRACKER_STATUS_UPDATES_KEY, JSON.stringify(updates.slice(0, maxUpdates)));
      } catch (err) {
        console.error('Error saving status updates:', err);
      }
    }
  }
}

function getStatusUpdatesList() {
  try {
    const raw = localStorage.getItem(JOB_TRACKER_STATUS_UPDATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// ---------- Built-In Test Checklist ----------
function getTestChecklistState() {
  try {
    const raw = localStorage.getItem(JNT_TEST_CHECKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out = {};
    for (let i = 1; i <= JNT_TEST_COUNT; i++) {
      out[i] = !!parsed[i];
    }
    return out;
  } catch (e) {
    return {};
  }
}

function setTestChecklistItem(testId, checked) {
  const state = getTestChecklistState();
  state[testId] = !!checked;
  try {
    localStorage.setItem(JNT_TEST_CHECKLIST_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving test checklist:', e);
  }
}

function allTestsPassed() {
  const state = getTestChecklistState();
  for (let i = 1; i <= JNT_TEST_COUNT; i++) {
    if (!state[i]) return false;
  }
  return true;
}

function renderTestPage() {
  const state = getTestChecklistState();
  const countEl = document.getElementById('jnt-test-passed-count');
  const warningEl = document.getElementById('jnt-test-warning');
  const checkboxes = document.querySelectorAll('.jnt-test-checkbox');
  let passed = 0;
  checkboxes.forEach(cb => {
    const id = parseInt(cb.dataset.testId, 10);
    const checked = !!state[id];
    cb.checked = checked;
    if (checked) passed++;
  });
  if (countEl) countEl.textContent = passed;
  if (warningEl) {
    if (passed < JNT_TEST_COUNT) {
      warningEl.classList.remove('jnt-hidden');
    } else {
      warningEl.classList.add('jnt-hidden');
    }
  }
}

function renderShipPage() {
  const lockedEl = document.getElementById('jnt-ship-locked');
  const unlockedEl = document.getElementById('jnt-ship-unlocked');
  const canShip = allTestsPassed() && allProofLinksValid();
  if (canShip) {
    if (lockedEl) lockedEl.classList.add('jnt-hidden');
    if (unlockedEl) unlockedEl.classList.remove('jnt-hidden');
  } else {
    if (lockedEl) lockedEl.classList.remove('jnt-hidden');
    if (unlockedEl) unlockedEl.classList.add('jnt-hidden');
  }
}

function getJntRoute() {
  const hash = window.location.hash.slice(1).replace(/^\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'jt' && parts[1]) return 'jt-' + parts[1];
  return parts[0] || 'home';
}

// ---------- Final Proof & submission ----------
function validateUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function getProofLinks() {
  try {
    const raw = localStorage.getItem(JNT_PROOF_LINKS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { lovable: parsed.lovable || '', github: parsed.github || '', deployed: parsed.deployed || '' };
  } catch (e) {
    return { lovable: '', github: '', deployed: '' };
  }
}

function setProofLinks(links) {
  try {
    localStorage.setItem(JNT_PROOF_LINKS_KEY, JSON.stringify(links));
  } catch (e) {
    console.error('Error saving proof links:', e);
  }
}

function allProofLinksValid() {
  const links = getProofLinks();
  return PROOF_LINK_KEYS.every(key => validateUrl(links[key]));
}

function getProject1Status() {
  const testsOk = allTestsPassed();
  const linksOk = allProofLinksValid();
  if (testsOk && linksOk) return 'shipped';
  const hasAnyLink = PROOF_LINK_KEYS.some(key => getProofLinks()[key].trim().length > 0);
  const anyTestChecked = Object.values(getTestChecklistState()).some(Boolean);
  if (hasAnyLink || anyTestChecked) return 'in-progress';
  return 'not-started';
}

function getProofStepCompletion() {
  let prefs = null;
  try {
    const r = localStorage.getItem('jobTrackerPreferences');
    prefs = r ? JSON.parse(r) : null;
  } catch (e) {}
  const hasPrefs = prefs && (prefs.roleKeywords || (prefs.preferredLocations && prefs.preferredLocations.length > 0));
  const digestStored = getStoredDigestForToday();
  const statusMap = getJobStatusMap();
  const hasAnyStatus = Object.keys(statusMap).length > 0;
  return {
    1: true,
    2: !!hasPrefs,
    3: true,
    4: !!(digestStored && digestStored.jobs && digestStored.jobs.length > 0),
    5: hasAnyStatus,
    6: true,
    7: allTestsPassed(),
    8: allProofLinksValid()
  };
}

function renderProofPage() {
  const completion = getProofStepCompletion();
  const stepsEl = document.getElementById('jnt-proof-steps');
  if (stepsEl) {
    stepsEl.querySelectorAll('.jnt-proof-step').forEach(li => {
      const step = parseInt(li.dataset.step, 10);
      const statusSpan = li.querySelector('.jnt-proof-step-status');
      const isCompleted = !!completion[step];
      if (statusSpan) statusSpan.textContent = isCompleted ? 'Completed' : 'Pending';
      li.classList.toggle('jnt-proof-step-completed', isCompleted);
      li.classList.toggle('jnt-proof-step-pending', !isCompleted);
    });
  }

  const status = getProject1Status();
  const badgeEl = document.getElementById('jnt-proof-status-badge');
  if (badgeEl) {
    badgeEl.textContent = status === 'shipped' ? 'Shipped' : status === 'in-progress' ? 'In Progress' : 'Not Started';
    badgeEl.className = 'jnt-proof-status-badge jnt-proof-status-' + status;
  }

  const shippedMsgEl = document.getElementById('jnt-proof-shipped-msg');
  if (shippedMsgEl) {
    shippedMsgEl.classList.toggle('jnt-hidden', status !== 'shipped');
  }

  const links = getProofLinks();
  const lovableInput = document.getElementById('jnt-proof-lovable');
  const githubInput = document.getElementById('jnt-proof-github');
  const deployedInput = document.getElementById('jnt-proof-deployed');
  if (lovableInput) lovableInput.value = links.lovable;
  if (githubInput) githubInput.value = links.github;
  if (deployedInput) deployedInput.value = links.deployed;
}

function buildFinalSubmissionText() {
  const links = getProofLinks();
  return `------------------------------------------
Job Notification Tracker — Final Submission

Lovable Project:
${links.lovable || '(not set)'}

GitHub Repository:
${links.github || '(not set)'}

Live Deployment:
${links.deployed || '(not set)'}

Core Features:
- Intelligent match scoring
- Daily digest simulation
- Status tracking
- Test checklist enforced
------------------------------------------`;
}

// Load preferences from localStorage
function loadPreferences() {
  try {
    const saved = localStorage.getItem('jobTrackerPreferences');
    if (saved) {
      preferences = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading preferences:', e);
    preferences = null;
  }
}

// Save preferences to localStorage
function savePreferences() {
  try {
    localStorage.setItem('jobTrackerPreferences', JSON.stringify(preferences));
    checkPreferencesBanner();
    // Recalculate match scores and re-render
    handleFilter();
  } catch (e) {
    console.error('Error saving preferences:', e);
  }
}

// Calculate match score for a job
function calculateMatchScore(job) {
  if (!preferences) return 0;

  let score = 0;
  const roleKeywords = (preferences.roleKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  const userSkills = (preferences.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(s => s);
  const preferredLocations = preferences.preferredLocations || [];
  const preferredModes = preferences.preferredMode || [];
  const experienceLevel = preferences.experienceLevel || '';

  // +25 if any roleKeyword appears in job.title (case-insensitive)
  if (roleKeywords.length > 0) {
    const titleLower = job.title.toLowerCase();
    if (roleKeywords.some(keyword => titleLower.includes(keyword))) {
      score += 25;
    }
  }

  // +15 if any roleKeyword appears in job.description
  if (roleKeywords.length > 0) {
    const descLower = job.description.toLowerCase();
    if (roleKeywords.some(keyword => descLower.includes(keyword))) {
      score += 15;
    }
  }

  // +15 if job.location matches preferredLocations
  if (preferredLocations.length > 0 && preferredLocations.includes(job.location)) {
    score += 15;
  }

  // +10 if job.mode matches preferredMode
  if (preferredModes.length > 0 && preferredModes.includes(job.mode)) {
    score += 10;
  }

  // +10 if job.experience matches experienceLevel
  if (experienceLevel && job.experience === experienceLevel) {
    score += 10;
  }

  // +15 if overlap between job.skills and user.skills (any match)
  if (userSkills.length > 0 && job.skills && job.skills.length > 0) {
    const jobSkillsLower = job.skills.map(s => s.toLowerCase());
    if (userSkills.some(skill => jobSkillsLower.includes(skill))) {
      score += 15;
    }
  }

  // +5 if postedDaysAgo <= 2
  if (job.postedDaysAgo <= 2) {
    score += 5;
  }

  // +5 if source is LinkedIn
  if (job.source === 'LinkedIn') {
    score += 5;
  }

  // Cap score at 100
  return Math.min(score, 100);
}

// Get match score badge class
function getMatchScoreBadgeClass(score) {
  if (score >= 80) return 'jnt-match-score-high';
  if (score >= 60) return 'jnt-match-score-medium';
  if (score >= 40) return 'jnt-match-score-low';
  return 'jnt-match-score-subtle';
}

// Populate location filter dropdown
function populateLocationFilter() {
  const locationSet = new Set();
  JOBS_DATA.forEach(job => locationSet.add(job.location));
  const locations = Array.from(locationSet).sort();
  
  const select = document.getElementById('filter-location');
  locations.forEach(location => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    select.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Filter inputs
  document.getElementById('filter-keyword')?.addEventListener('input', handleFilter);
  document.getElementById('filter-location')?.addEventListener('change', handleFilter);
  document.getElementById('filter-mode')?.addEventListener('change', handleFilter);
  document.getElementById('filter-experience')?.addEventListener('change', handleFilter);
  document.getElementById('filter-source')?.addEventListener('change', handleFilter);
  document.getElementById('filter-status')?.addEventListener('change', handleFilter);
  document.getElementById('filter-sort')?.addEventListener('change', handleFilter);
  document.getElementById('toggle-matches-only')?.addEventListener('change', handleFilter);

  // Modal
  document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Router integration - listen to hash changes
  window.addEventListener('hashchange', () => {
    const route = getJntRoute();
    if (route === 'dashboard') {
      renderDashboard();
      checkPreferencesBanner();
    } else if (route === 'saved') {
      renderSaved();
    } else if (route === 'digest') {
      renderDigestPage();
    } else if (route === 'settings') {
      checkPreferencesBanner();
    } else if (route === 'jt-07-test') {
      renderTestPage();
    } else if (route === 'jt-08-ship') {
      renderShipPage();
    } else if (route === 'jt-proof' || route === 'proof') {
      renderProofPage();
    }
  });

  // Check initial route
  const initialRoute = getJntRoute();
  if (initialRoute === 'dashboard') {
    renderDashboard();
    checkPreferencesBanner();
  } else if (initialRoute === 'saved') {
    renderSaved();
  } else if (initialRoute === 'digest') {
    renderDigestPage();
  } else if (initialRoute === 'settings') {
    checkPreferencesBanner();
  } else if (initialRoute === 'jt-07-test') {
    renderTestPage();
  } else if (initialRoute === 'jt-08-ship') {
    renderShipPage();
  } else if (initialRoute === 'jt-proof' || initialRoute === 'proof') {
    renderProofPage();
  }

  // Final Proof: link inputs (validate URL, store in localStorage)
  const proofInputIds = ['jnt-proof-lovable', 'jnt-proof-github', 'jnt-proof-deployed'];
  const proofKeys = ['lovable', 'github', 'deployed'];
  proofInputIds.forEach((id, i) => {
    const input = document.getElementById(id);
    const errorEl = document.getElementById(id + '-error');
    if (!input) return;
    input.addEventListener('blur', () => {
      const val = input.value.trim();
      const links = getProofLinks();
      links[proofKeys[i]] = val;
      if (val && !validateUrl(val)) {
        if (errorEl) { errorEl.textContent = 'Please enter a valid URL (http or https).'; errorEl.classList.remove('jnt-hidden'); }
        setProofLinks(links);
      } else {
        if (errorEl) errorEl.classList.add('jnt-hidden');
        setProofLinks(links);
      }
      renderProofPage();
    });
    input.addEventListener('input', () => {
      if (errorEl) errorEl.classList.add('jnt-hidden');
    });
  });

  // Copy Final Submission
  document.getElementById('jnt-proof-copy-btn')?.addEventListener('click', () => {
    const text = buildFinalSubmissionText();
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Final submission copied to clipboard.', 'info');
    }).catch(() => {
      showNotification('Could not copy to clipboard.', 'info');
    });
  });

  // Built-In Test Checklist: checkbox change and Reset
  document.getElementById('jnt-test-checklist')?.addEventListener('change', (e) => {
    const cb = e.target.closest('.jnt-test-checkbox');
    if (!cb) return;
    const id = parseInt(cb.dataset.testId, 10);
    if (id >= 1 && id <= JNT_TEST_COUNT) {
      setTestChecklistItem(id, cb.checked);
      renderTestPage();
    }
  });
  document.getElementById('jnt-test-reset-btn')?.addEventListener('click', () => {
    try {
      localStorage.removeItem(JNT_TEST_CHECKLIST_KEY);
    } catch (e) {}
    renderTestPage();
  });

  // Digest generate button (bound when digest block is visible)
  document.getElementById('digest-generate-btn')?.addEventListener('click', () => {
    const digest = getOrCreateTodayDigest();
    const noPrefs = document.getElementById('digest-no-prefs');
    const generateBlock = document.getElementById('digest-generate');
    const noMatches = document.getElementById('digest-no-matches');
    const contentBlock = document.getElementById('digest-content');
    [noPrefs, generateBlock, contentBlock].forEach(el => { if (el) el.classList.add('jnt-hidden'); });
    if (digest === null) {
      if (noMatches) noMatches.classList.remove('jnt-hidden');
    } else {
      renderDigestPage();
    }
  });

  // Create Email Draft - wired once so it always responds
  document.getElementById('digest-email-draft')?.addEventListener('click', function(e) {
    e.preventDefault();
    const digest = getStoredDigestForToday();
    if (!digest || !digest.jobs || !digest.jobs.length) {
      showNotification('No digest to email. Generate a digest first.', 'info');
      return;
    }
    const mailtoUrl = buildMailtoDigestUrl(digest);
    const fullText = formatDigestAsPlainText(digest);
    try {
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Mailto open failed:', err);
    }
    navigator.clipboard.writeText(fullText).then(function() {
      showNotification('Digest copied to clipboard. If your email did not open, paste it into your email.', 'info');
    }).catch(function() {
      showNotification('Opening email draft. If nothing happened, try running the app from http://localhost (not file://).', 'info');
    });
  });
}

// Handle filter changes
function handleFilter() {
  const keyword = document.getElementById('filter-keyword')?.value.toLowerCase() || '';
  const location = document.getElementById('filter-location')?.value || '';
  const mode = document.getElementById('filter-mode')?.value || '';
  const experience = document.getElementById('filter-experience')?.value || '';
  const source = document.getElementById('filter-source')?.value || '';
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const matchesOnly = document.getElementById('toggle-matches-only')?.checked || false;
  const minMatchScore = preferences?.minMatchScore || 40;

  // Calculate match scores for all jobs
  const jobsWithScores = JOBS_DATA.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job)
  }));

  filteredJobs = jobsWithScores.filter(job => {
    // Keyword search (title or company)
    if (keyword && !job.title.toLowerCase().includes(keyword) && 
        !job.company.toLowerCase().includes(keyword)) {
      return false;
    }
    // Location filter
    if (location && job.location !== location) {
      return false;
    }
    // Mode filter
    if (mode && job.mode !== mode) {
      return false;
    }
    // Experience filter
    if (experience && job.experience !== experience) {
      return false;
    }
    // Source filter
    if (source && job.source !== source) {
      return false;
    }
    // Status filter (AND with others)
    if (statusFilter) {
      const jobStatus = getJobStatus(job.id);
      if (jobStatus !== statusFilter) {
        return false;
      }
    }
    // Match score filter
    if (matchesOnly && job.matchScore < minMatchScore) {
      return false;
    }
    return true;
  });

  // Sort
  const sortBy = document.getElementById('filter-sort')?.value || 'latest';
  sortJobs(filteredJobs, sortBy);

  renderDashboard();
}

// Sort jobs
function sortJobs(jobs, sortBy) {
  switch (sortBy) {
    case 'latest':
      jobs.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
      break;
    case 'oldest':
      jobs.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
      break;
    case 'match-score':
      jobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      break;
    case 'salary-high':
      jobs.sort((a, b) => {
        const aVal = extractSalaryValue(a.salaryRange);
        const bVal = extractSalaryValue(b.salaryRange);
        return bVal - aVal;
      });
      break;
    case 'salary-low':
      jobs.sort((a, b) => {
        const aVal = extractSalaryValue(a.salaryRange);
        const bVal = extractSalaryValue(b.salaryRange);
        return aVal - bVal;
      });
      break;
  }
}

// Extract numeric value from salary range for sorting
function extractSalaryValue(salaryRange) {
  // Extract first number from salary range
  const match = salaryRange.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Format posted days ago
function formatPostedDaysAgo(days) {
  if (days === 0) return 'Posted today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// Render dashboard
function renderDashboard() {
  const container = document.getElementById('jobs-container');
  const emptyState = document.getElementById('dashboard-empty');
  const emptyStateText = document.getElementById('empty-state-text');
  const countEl = document.getElementById('dashboard-count');

  if (!container) return;

  // Update count
  if (countEl) {
    countEl.textContent = `${filteredJobs.length} job${filteredJobs.length !== 1 ? 's' : ''} available`;
  }

  // Clear container
  container.innerHTML = '';

  if (filteredJobs.length === 0) {
    container.classList.add('jnt-hidden');
    if (emptyState) emptyState.classList.remove('jnt-empty-hidden');
    // Update empty state message
    if (emptyStateText) {
      const matchesOnly = document.getElementById('toggle-matches-only')?.checked || false;
      if (matchesOnly && preferences) {
        emptyStateText.textContent = 'No roles match your criteria. Adjust filters or lower threshold.';
      } else {
        emptyStateText.textContent = 'Try adjusting your filters to see more results.';
      }
    }
    return;
  }

  container.classList.remove('jnt-hidden');
  if (emptyState) emptyState.classList.add('jnt-empty-hidden');

  // Render job cards
  filteredJobs.forEach(job => {
    const card = createJobCard(job, false);
    container.appendChild(card);
  });
}

// Render saved page
function renderSaved() {
  const container = document.getElementById('saved-container');
  const emptyState = document.getElementById('saved-empty');
  const countEl = document.getElementById('saved-count');

  if (!container) return;

  const savedJobs = JOBS_DATA.filter(job => savedJobIds.has(job.id));

  // Update count
  if (countEl) {
    countEl.textContent = `${savedJobs.length} job${savedJobs.length !== 1 ? 's' : ''} saved`;
  }

  // Clear container
  container.innerHTML = '';

  if (savedJobs.length === 0) {
    container.classList.add('jnt-hidden');
    if (emptyState) emptyState.classList.remove('jnt-empty-hidden');
    return;
  }

  container.classList.remove('jnt-hidden');
  if (emptyState) emptyState.classList.add('jnt-empty-hidden');

  // Render saved job cards
  savedJobs.forEach(job => {
    const card = createJobCard(job, true);
    container.appendChild(card);
  });
}

// Get status badge CSS class
function getStatusBadgeClass(status) {
  const m = { 'Not Applied': 'jnt-status-not-applied', 'Applied': 'jnt-status-applied', 'Rejected': 'jnt-status-rejected', 'Selected': 'jnt-status-selected' };
  return m[status] || 'jnt-status-not-applied';
}

// Create job card element
function createJobCard(job, isSaved) {
  const card = document.createElement('div');
  card.className = 'jnt-job-card';
  card.dataset.jobId = job.id;

  const isAlreadySaved = savedJobIds.has(job.id);
  const matchScore = job.matchScore || 0;
  const matchScoreBadge = preferences ? `<span class="jnt-match-score-badge ${getMatchScoreBadgeClass(matchScore)}">Match: ${matchScore}</span>` : '';
  const currentStatus = getJobStatus(job.id);
  const statusBadgeClass = getStatusBadgeClass(currentStatus);
  const statusButtons = STATUS_VALUES.map(s => {
    const active = s === currentStatus ? ' jnt-status-btn-active' : '';
    const badgeClass = getStatusBadgeClass(s);
    return `<button type="button" class="jnt-status-btn ${badgeClass}${active}" data-status="${escapeHtml(s)}" data-job-id="${job.id}">${escapeHtml(s)}</button>`;
  }).join('');

  card.innerHTML = `
    <div class="jnt-job-card-header">
      <div class="jnt-job-title-row">
        <h3 class="jnt-job-title">${escapeHtml(job.title)}</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${matchScoreBadge}
          <span class="jnt-job-source-badge jnt-source-${job.source.toLowerCase()}">${escapeHtml(job.source)}</span>
        </div>
      </div>
      <div class="jnt-job-company">${escapeHtml(job.company)}</div>
    </div>
    <div class="jnt-job-card-body">
      <div class="jnt-job-status-row">
        <span class="jnt-job-status-label">Status:</span>
        <div class="jnt-status-btn-group" role="group" aria-label="Job application status">
          ${statusButtons}
        </div>
      </div>
      <div class="jnt-job-meta">
        <span class="jnt-job-meta-item">
          <span class="jnt-job-icon">📍</span>
          ${escapeHtml(job.location)}
        </span>
        <span class="jnt-job-meta-item">
          <span class="jnt-job-icon">💼</span>
          ${escapeHtml(job.mode)}
        </span>
        <span class="jnt-job-meta-item">
          <span class="jnt-job-icon">👤</span>
          ${escapeHtml(job.experience === 'Fresher' ? 'Fresher' : job.experience + ' years')}
        </span>
      </div>
      <div class="jnt-job-salary">${escapeHtml(job.salaryRange)}</div>
      <div class="jnt-job-posted">${formatPostedDaysAgo(job.postedDaysAgo)}</div>
    </div>
    <div class="jnt-job-card-footer">
      <button class="jnt-btn jnt-btn-secondary jnt-btn-view" data-job-id="${job.id}">View</button>
      <button class="jnt-btn jnt-btn-secondary jnt-btn-save ${isAlreadySaved ? 'jnt-btn-saved' : ''}" data-job-id="${job.id}">
        ${isAlreadySaved ? '✓ Saved' : 'Save'}
      </button>
      <button class="jnt-btn jnt-btn-primary jnt-btn-apply" data-job-id="${job.id}" data-apply-url="${escapeHtml(job.applyUrl)}">Apply</button>
    </div>
  `;

  // Add event listeners
  card.querySelector('.jnt-btn-view').addEventListener('click', () => openModal(job));
  card.querySelector('.jnt-btn-save').addEventListener('click', () => toggleSave(job.id, card));
  card.querySelector('.jnt-btn-apply').addEventListener('click', (e) => {
    e.preventDefault();
    handleApplyClick(job);
  });

  // Status button group: on click set status, update UI, show toast for Applied/Rejected/Selected
  card.querySelectorAll('.jnt-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      if (!newStatus || !STATUS_VALUES.includes(newStatus)) return;
      setJobStatus(job.id, newStatus);
      card.querySelectorAll('.jnt-status-btn').forEach(b => {
        b.classList.remove('jnt-status-btn-active');
        b.classList.remove('jnt-status-applied', 'jnt-status-rejected', 'jnt-status-selected', 'jnt-status-not-applied');
        b.classList.add(getStatusBadgeClass(b.dataset.status));
        if (b.dataset.status === newStatus) b.classList.add('jnt-status-btn-active');
      });
      if (newStatus !== 'Not Applied') {
        showNotification('Status updated: ' + newStatus, 'info');
      }
    });
  });

  return card;
}

// Toggle save job
function toggleSave(jobId, cardElement) {
  const btn = cardElement.querySelector('.jnt-btn-save');
  
  if (savedJobIds.has(jobId)) {
    savedJobIds.delete(jobId);
    btn.textContent = 'Save';
    btn.classList.remove('jnt-btn-saved');
  } else {
    savedJobIds.add(jobId);
    btn.textContent = '✓ Saved';
    btn.classList.add('jnt-btn-saved');
  }

  saveJobIds();

  // Update saved page if visible
  const currentRoute = window.location.hash.slice(1).replace(/^\/?/, '') || 'home';
  if (currentRoute === 'saved') {
    renderSaved();
  }
}

// Open modal with job details
function openModal(job) {
  const modal = document.getElementById('job-modal');
  const modalBody = document.getElementById('modal-body');

  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <div class="jnt-modal-header">
      <h2 class="jnt-modal-title">${escapeHtml(job.title)}</h2>
      <div class="jnt-modal-company">${escapeHtml(job.company)}</div>
    </div>
    <div class="jnt-modal-body">
      <div class="jnt-modal-section">
        <h3 class="jnt-modal-section-title">Job Details</h3>
        <div class="jnt-modal-details">
          <div class="jnt-modal-detail-item">
            <strong>Location:</strong> ${escapeHtml(job.location)}
          </div>
          <div class="jnt-modal-detail-item">
            <strong>Mode:</strong> ${escapeHtml(job.mode)}
          </div>
          <div class="jnt-modal-detail-item">
            <strong>Experience:</strong> ${escapeHtml(job.experience === 'Fresher' ? 'Fresher' : job.experience + ' years')}
          </div>
          <div class="jnt-modal-detail-item">
            <strong>Salary:</strong> ${escapeHtml(job.salaryRange)}
          </div>
          <div class="jnt-modal-detail-item">
            <strong>Posted:</strong> ${formatPostedDaysAgo(job.postedDaysAgo)}
          </div>
          <div class="jnt-modal-detail-item">
            <strong>Source:</strong> ${escapeHtml(job.source)}
          </div>
        </div>
      </div>
      <div class="jnt-modal-section">
        <h3 class="jnt-modal-section-title">Skills Required</h3>
        <div class="jnt-modal-skills">
          ${job.skills.map(skill => `<span class="jnt-skill-tag">${escapeHtml(skill)}</span>`).join('')}
        </div>
      </div>
      <div class="jnt-modal-section">
        <h3 class="jnt-modal-section-title">Description</h3>
        <p class="jnt-modal-description">${escapeHtml(job.description)}</p>
      </div>
    </div>
    <div class="jnt-modal-footer">
      <button class="jnt-btn jnt-btn-secondary jnt-btn-save-modal ${savedJobIds.has(job.id) ? 'jnt-btn-saved' : ''}" data-job-id="${job.id}">
        ${savedJobIds.has(job.id) ? '✓ Saved' : 'Save Job'}
      </button>
      <button class="jnt-btn jnt-btn-primary jnt-btn-apply-modal" data-job-id="${job.id}">Apply Now</button>
    </div>
  `;

  // Add event listener for save button in modal
  const saveBtn = modalBody.querySelector('.jnt-btn-save-modal');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      toggleSave(job.id);
      const updatedBtn = modalBody.querySelector('.jnt-btn-save-modal');
      if (updatedBtn) {
        if (savedJobIds.has(job.id)) {
          updatedBtn.textContent = '✓ Saved';
          updatedBtn.classList.add('jnt-btn-saved');
        } else {
          updatedBtn.textContent = 'Save Job';
          updatedBtn.classList.remove('jnt-btn-saved');
        }
      }
      // Update card if visible
      const card = document.querySelector(`[data-job-id="${job.id}"]`);
      if (card && card.classList.contains('jnt-job-card')) {
        const cardSaveBtn = card.querySelector('.jnt-btn-save');
        if (cardSaveBtn) {
          if (savedJobIds.has(job.id)) {
            cardSaveBtn.textContent = '✓ Saved';
            cardSaveBtn.classList.add('jnt-btn-saved');
          } else {
            cardSaveBtn.textContent = 'Save';
            cardSaveBtn.classList.remove('jnt-btn-saved');
          }
        }
      }
    });
  }

  // Add event listener for apply button in modal
  const applyBtn = modalBody.querySelector('.jnt-btn-apply-modal');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      handleApplyClick(job);
    });
  }

  modal.classList.add('jnt-modal-open');
  document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
  const modal = document.getElementById('job-modal');
  if (modal) {
    modal.classList.remove('jnt-modal-open');
    document.body.style.overflow = '';
  }
}

// Handle Apply button click
function handleApplyClick(job) {
  // Show demo notification since these are placeholder URLs
  showNotification(`This is a demo application. To apply for "${job.title}" at ${job.company}, please visit their official careers page.`, 'info');
  
  // Optionally, you could open the URL anyway (but it will show 404)
  // window.open(job.applyUrl, '_blank');
}

// Show toast notification
function showNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.querySelector('.jnt-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `jnt-notification jnt-notification-${type}`;
  notification.innerHTML = `
    <div class="jnt-notification-content">
      <span class="jnt-notification-icon">ℹ️</span>
      <span class="jnt-notification-message">${escapeHtml(message)}</span>
      <button class="jnt-notification-close" aria-label="Close">×</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.classList.add('jnt-notification-show');
  }, 10);

  // Auto-remove after 5 seconds
  const autoRemove = setTimeout(() => {
    removeNotification(notification);
  }, 5000);

  // Close button
  notification.querySelector('.jnt-notification-close').addEventListener('click', () => {
    clearTimeout(autoRemove);
    removeNotification(notification);
  });
}

// Remove notification
function removeNotification(notification) {
  notification.classList.remove('jnt-notification-show');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 300);
}

// Setup settings form
function setupSettingsForm() {
  // Load preferences into form
  if (preferences) {
    const roleInput = document.getElementById('pref-role');
    const locationsSelect = document.getElementById('pref-locations');
    const experienceSelect = document.getElementById('pref-experience');
    const skillsInput = document.getElementById('pref-skills');
    const minMatchSlider = document.getElementById('pref-min-match');
    const minMatchValue = document.getElementById('min-match-value');

    if (roleInput && preferences.roleKeywords) {
      roleInput.value = preferences.roleKeywords;
    }
    if (locationsSelect && preferences.preferredLocations) {
      Array.from(locationsSelect.options).forEach(option => {
        option.selected = preferences.preferredLocations.includes(option.value);
      });
    }
    if (experienceSelect && preferences.experienceLevel) {
      experienceSelect.value = preferences.experienceLevel;
    }
    if (skillsInput && preferences.skills) {
      skillsInput.value = preferences.skills;
    }
    if (minMatchSlider && preferences.minMatchScore !== undefined) {
      minMatchSlider.value = preferences.minMatchScore;
      if (minMatchValue) {
        minMatchValue.textContent = preferences.minMatchScore;
      }
    }

    // Set checkboxes for preferred modes
    if (preferences.preferredMode) {
      preferences.preferredMode.forEach(mode => {
        const checkbox = document.getElementById(`pref-mode-${mode.toLowerCase()}`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }
  }

  // Update slider value display
  const minMatchSlider = document.getElementById('pref-min-match');
  const minMatchValue = document.getElementById('min-match-value');
  if (minMatchSlider && minMatchValue) {
    minMatchSlider.addEventListener('input', (e) => {
      minMatchValue.textContent = e.target.value;
    });
  }

  // Save preferences button
  const saveBtn = document.getElementById('save-preferences');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const roleKeywords = document.getElementById('pref-role')?.value.trim() || '';
      const locationsSelect = document.getElementById('pref-locations');
      const preferredLocations = locationsSelect ? 
        Array.from(locationsSelect.selectedOptions).map(opt => opt.value) : [];
      const preferredMode = [];
      if (document.getElementById('pref-mode-remote')?.checked) preferredMode.push('Remote');
      if (document.getElementById('pref-mode-hybrid')?.checked) preferredMode.push('Hybrid');
      if (document.getElementById('pref-mode-onsite')?.checked) preferredMode.push('Onsite');
      const experienceLevel = document.getElementById('pref-experience')?.value || '';
      const skills = document.getElementById('pref-skills')?.value.trim() || '';
      const minMatchScore = parseInt(document.getElementById('pref-min-match')?.value || '40', 10);

      preferences = {
        roleKeywords,
        preferredLocations,
        preferredMode,
        experienceLevel,
        skills,
        minMatchScore
      };

      savePreferences();
      showNotification('Preferences saved successfully!', 'info');
    });
  }
}

// ---------- Digest ----------
function getDigestStorageKey() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return 'jobTrackerDigest_' + y + '-' + m + '-' + day;
}

function getTop10ForDigest() {
  const jobsWithScores = JOBS_DATA.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job)
  }));
  jobsWithScores.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.postedDaysAgo - b.postedDaysAgo;
  });
  return jobsWithScores.slice(0, 10);
}

function getStoredDigestForToday() {
  try {
    const raw = localStorage.getItem(getDigestStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getOrCreateTodayDigest() {
  const key = getDigestStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const jobs = getTop10ForDigest();
  if (jobs.length === 0) return null;
  const dateStr = key.replace('jobTrackerDigest_', '');
  const payload = { date: dateStr, jobs };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.error('Error saving digest:', e);
  }
  return payload;
}

function formatDigestAsPlainText(digest) {
  if (!digest || !digest.jobs || !digest.jobs.length) return '';
  const lines = ['Top 10 Jobs For You — 9AM Digest', digest.date || '', ''];
  digest.jobs.forEach((job, i) => {
    lines.push(`${i + 1}. ${job.title}`);
    lines.push(`   Company: ${job.company}`);
    lines.push(`   Location: ${job.location}`);
    lines.push(`   Experience: ${job.experience === 'Fresher' ? 'Fresher' : job.experience + ' years'}`);
    lines.push(`   Match Score: ${job.matchScore || 0}`);
    lines.push('');
  });
  lines.push('This digest was generated based on your preferences.');
  return lines.join('\n');
}

// Compact format for mailto (short URL = better support in all clients)
function formatDigestForMailto(digest) {
  if (!digest || !digest.jobs || !digest.jobs.length) return '';
  const lines = ['Top 10 Jobs For You - 9AM Digest', digest.date || '', ''];
  digest.jobs.forEach((job, i) => {
    const exp = job.experience === 'Fresher' ? 'Fresher' : job.experience + ' years';
    lines.push((i + 1) + '. ' + job.title + ' | ' + job.company + ' | ' + job.location + ' | ' + exp + ' | Match: ' + (job.matchScore != null ? job.matchScore : 0));
  });
  lines.push('', 'This digest was generated based on your preferences.');
  return lines.join('\n');
}

function buildMailtoDigestUrl(digest) {
  const subject = 'My 9AM Job Digest';
  let body = formatDigestForMailto(digest);
  const maxBodyLen = 1000;
  if (body.length > maxBodyLen) {
    body = body.slice(0, maxBodyLen) + '\n\n[Truncated. Use Copy to Clipboard for full digest.]';
  }
  return 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function formatStatusUpdateDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch (e) {
    return isoStr;
  }
}

function renderDigestPage() {
  const noPrefs = document.getElementById('digest-no-prefs');
  const generateBlock = document.getElementById('digest-generate');
  const noMatches = document.getElementById('digest-no-matches');
  const contentBlock = document.getElementById('digest-content');
  const digestDateEl = document.getElementById('digest-date');
  const digestJobsList = document.getElementById('digest-jobs-list');
  const copyBtn = document.getElementById('digest-copy-btn');
  const emailDraftLink = document.getElementById('digest-email-draft');
  const statusUpdatesWrap = document.getElementById('digest-status-updates-wrap');
  const statusUpdatesList = document.getElementById('digest-status-updates-list');

  [noPrefs, generateBlock, noMatches, contentBlock].forEach(el => {
    if (el) el.classList.add('jnt-hidden');
  });

  // Recent Status Updates: show on digest page when there are updates
  const updates = getStatusUpdatesList();
  if (statusUpdatesWrap && statusUpdatesList) {
    if (updates.length > 0) {
      statusUpdatesWrap.classList.remove('jnt-hidden');
      statusUpdatesList.innerHTML = updates.map(u => `
        <div class="jnt-digest-status-update-item">
          <div class="jnt-digest-status-update-main">
            <strong>${escapeHtml(u.title)}</strong> — ${escapeHtml(u.company)}
          </div>
          <div class="jnt-digest-status-update-meta">
            <span class="jnt-status-badge ${getStatusBadgeClass(u.status)}">${escapeHtml(u.status)}</span>
            <span class="jnt-digest-status-update-date">${escapeHtml(formatStatusUpdateDate(u.dateChanged))}</span>
          </div>
        </div>
      `).join('');
    } else {
      statusUpdatesWrap.classList.add('jnt-hidden');
    }
  }

  const hasPrefs = preferences && (preferences.roleKeywords || (preferences.preferredLocations && preferences.preferredLocations.length > 0));

  if (!hasPrefs) {
    if (noPrefs) noPrefs.classList.remove('jnt-hidden');
    return;
  }

  const stored = getStoredDigestForToday();
  if (stored && stored.jobs && stored.jobs.length > 0) {
    if (contentBlock) contentBlock.classList.remove('jnt-hidden');
    if (digestDateEl) digestDateEl.textContent = stored.date || new Date().toISOString().slice(0, 10);
    if (digestJobsList) {
      digestJobsList.innerHTML = '';
      stored.jobs.forEach(job => {
        const row = document.createElement('div');
        row.className = 'jnt-digest-job-row';
        const expText = job.experience === 'Fresher' ? 'Fresher' : job.experience + ' years';
        row.innerHTML = `
          <div class="jnt-digest-job-main">
            <h3 class="jnt-digest-job-title">${escapeHtml(job.title)}</h3>
            <p class="jnt-digest-job-company">${escapeHtml(job.company)}</p>
            <div class="jnt-digest-job-meta">
              <span>${escapeHtml(job.location)}</span>
              <span>${escapeHtml(expText)}</span>
              <span class="jnt-digest-match">Match: ${job.matchScore != null ? job.matchScore : 0}</span>
            </div>
          </div>
          <div class="jnt-digest-job-actions">
            <button type="button" class="jnt-btn jnt-btn-primary jnt-digest-apply" data-job-id="${job.id}" data-apply-url="${escapeHtml(job.applyUrl)}">Apply</button>
          </div>
        `;
        row.querySelector('.jnt-digest-apply').addEventListener('click', (e) => {
          e.preventDefault();
          handleApplyClick(job);
        });
        digestJobsList.appendChild(row);
      });
    }
    if (copyBtn) {
      copyBtn.onclick = () => {
        const text = formatDigestAsPlainText(stored);
        navigator.clipboard.writeText(text).then(() => showNotification('Digest copied to clipboard.', 'info')).catch(() => showNotification('Could not copy to clipboard.', 'info'));
      };
    }
    return;
  }

  if (generateBlock) generateBlock.classList.remove('jnt-hidden');
}

// Check and show preferences banner
function checkPreferencesBanner() {
  const dashboardBanner = document.getElementById('dashboard-prefs-banner');
  const settingsBanner = document.getElementById('prefs-banner');

  if (!preferences || (!preferences.roleKeywords && preferences.preferredLocations.length === 0)) {
    if (dashboardBanner) dashboardBanner.classList.remove('jnt-hidden');
    if (settingsBanner) settingsBanner.classList.remove('jnt-hidden');
  } else {
    if (dashboardBanner) dashboardBanner.classList.add('jnt-hidden');
    if (settingsBanner) settingsBanner.classList.add('jnt-hidden');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
