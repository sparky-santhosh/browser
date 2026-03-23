// client.js — read-only version (no token UI)
// - prompts for display name on first visit
// - fetches message files from repo/messages/ and renders them
// - posting is disabled (Send button is disabled)

const POLL_INTERVAL_MS = 5000;
const MSG_DIR = 'messages';
const MAX_RENDER = 200; // last N files to render

/* Repo detection (project or user pages) */
function detectRepo() {
  const host = location.hostname; // owner.github.io
  const hostParts = host.split('.');
  const owner = hostParts[0] || '';
  const pathParts = location.pathname.split('/').filter(Boolean);
  let repo = '';
  if (pathParts.length > 0) repo = pathParts[0];
  else repo = `${owner}.github.io`;
  return { owner, repo };
}

const detected = detectRepo();
const messagesEl = document.getElementById('messages');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const usernameDisplay = document.getElementById('usernameDisplay');
const changeNameBtn = document.getElementById('changeNameBtn');
const initialModal = document.getElementById('initialNameModal');
const initialNameInput = document.getElementById('initialNameInput');
const initialNameSave = document.getElementById('initialNameSave');

let OWNER = detected.owner;
let REPO = detected.repo;
let USERNAME = localStorage.getItem('gh_files_chat_username') || '';
let pollTimer = null;
let lastRendered = ''; // last filename rendered (lexicographically)

/* Username flow */
function showInitialNameModal() {
  initialModal.style.display = 'flex';
  initialModal.setAttribute('aria-hidden', 'false');
  initialNameInput.focus();
}
function hideInitialNameModal() {
  initialModal.style.display = 'none';
  initialModal.setAttribute('aria-hidden', 'true');
}
function setUsername(name) {
  USERNAME = (name || '').trim() || 'Anonymous';
  localStorage.setItem('gh_files_chat_username', USERNAME);
  usernameDisplay.textContent = USERNAME;
}
if (!USERNAME) showInitialNameModal();
else usernameDisplay.textContent = USERNAME;

/* modal handlers */
initialNameSave.addEventListener('click', () => {
  const val = initialNameInput.value.trim();
  if (!val) return;
  setUsername(val);
  hideInitialNameModal();
});
initialNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') initialNameSave.click();
});
changeNameBtn.addEventListener('click', () => {
  initialModal.style.display = 'flex';
  initialModal.setAttribute('aria-hidden', 'false');
  initialNameInput.value = USERNAME || '';
  initialNameInput.focus();
});

/* UI helpers */
function appendSystem(txt) {
  const d = document.createElement('div');
  d.className = 'system';
  d.textContent = `* ${txt}`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function appendMessage(obj) {
  // obj: { user, text, ts, filename }
  const container = document.createElement('div');
  container.className = 'message';
  const userSpan = document.createElement('span');
  userSpan.className = 'user';
  userSpan.textContent = obj.user || 'unknown';
  const textSpan = document.createElement('span');
  textSpan.textContent = `: ${obj.text}`;
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date(obj.ts).toLocaleTimeString();
  container.appendChild(userSpan);
  container.appendChild(textSpan);
  container.appendChild(timeSpan);
  messagesEl.appendChild(container);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* Read messages: list files in messages/ and fetch their content */
async function fetchMessageFiles() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${MSG_DIR}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' }});
    if (res.status === 404) {
      appendSystem(`No ${MSG_DIR}/ directory found yet. First poster will create files.`);
      return [];
    }
    if (!res.ok) {
      appendSystem(`GitHub API returned ${res.status} when listing messages`);
      return [];
    }
    const data = await res.json();
    const files = data.filter(f => f.type === 'file').sort((a,b) => a.name.localeCompare(b.name));
    return files;
  } catch (e) {
    console.error('fetchMessageFiles', e);
    appendSystem('Failed to fetch messages (network).');
    return [];
  }
}

async function fetchAndRender() {
  const files = await fetchMessageFiles();
  if (!files || files.length === 0) {
    messagesEl.innerHTML = '';
    appendSystem('No messages yet. Say hi!');
    return;
  }
  const recent = files.slice(Math.max(0, files.length - MAX_RENDER));
  const lastName = recent.length ? recent[recent.length - 1].name : '';
  if (lastName === lastRendered) return;
  lastRendered = lastName;

  messagesEl.innerHTML = '';
  await Promise.all(recent.map(async (f) => {
    try {
      const rawRes = await fetch(f.download_url);
      if (!rawRes.ok) return;
      const txt = await rawRes.text();
      let obj = null;
      try { obj = JSON.parse(txt); } catch (e) {
        obj = { user: f.name.split('-')[1] || 'unknown', text: txt, ts: f.name.split('-')[0] || new Date().toISOString() };
      }
      obj.filename = f.name;
      appendMessage(obj);
    } catch (e) {
      console.error('fetch file', f.name, e);
    }
  }));
}

/* Posting disabled: show helpful message */
sendBtn.addEventListener('click', () => {
  appendSystem('Posting is disabled on this Pages-only site. Ask the admin to enable posting.');
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

/* Polling */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  fetchAndRender();
  pollTimer = setInterval(fetchAndRender, POLL_INTERVAL_MS);
}

/* initialize username display */
if (USERNAME) usernameDisplay.textContent = USERNAME;
startPolling();