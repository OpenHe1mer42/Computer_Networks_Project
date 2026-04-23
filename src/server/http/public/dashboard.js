const elements = {
  connectionStatus: document.querySelector('#connectionStatus'),
  statusText: document.querySelector('#statusText'),
  activeConnections: document.querySelector('#activeConnections'),
  totalConnectionsSeen: document.querySelector('#totalConnectionsSeen'),
  messageCount: document.querySelector('#messageCount'),
  clientIps: document.querySelector('#clientIps'),
  lastUpdated: document.querySelector('#lastUpdated'),
  activeClientCount: document.querySelector('#activeClientCount'),
  knownClientCount: document.querySelector('#knownClientCount'),
  recentMessageCount: document.querySelector('#recentMessageCount'),
  activeClients: document.querySelector('#activeClients'),
  knownClients: document.querySelector('#knownClients'),
  recentMessages: document.querySelector('#recentMessages'),
};

function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function setStatus(state, text) {
  elements.connectionStatus.classList.toggle('is-online', state === 'online');
  elements.connectionStatus.classList.toggle('is-offline', state === 'offline');
  elements.statusText.textContent = text;
}

function createClientRow(client, { known = false } = {}) {
  const row = document.createElement('article');
  row.className = 'client-row';

  const remoteAddresses = Array.isArray(client.remoteAddresses)
    ? client.remoteAddresses.join(', ')
    : client.remoteAddress;

  row.innerHTML = `
    <div class="client-title">
      <strong>${client.name || client.clientId || 'Unknown client'}</strong>
      <span class="badge">${client.role || 'readonly'}</span>
    </div>
    <div class="meta">
      <span>ID: ${client.clientId || 'unregistered'}</span>
      <span>IP: ${remoteAddresses || 'unknown'}</span>
      <span>${known ? `Reconnects: ${client.reconnectCount ?? 0}` : `Socket: ${client.socketId || 'unknown'}`}</span>
      <span>Seen: ${formatDate(client.lastSeenAt)}</span>
    </div>
  `;

  return row;
}

function renderClientList(container, clients, emptyText, options) {
  container.innerHTML = '';

  if (!clients.length) {
    container.className = 'list empty';
    container.textContent = emptyText;
    return;
  }

  container.className = 'list';
  for (const client of clients) {
    container.append(createClientRow(client, options));
  }
}

function renderMessages(messages) {
  elements.recentMessages.innerHTML = '';

  if (!messages.length) {
    elements.recentMessages.innerHTML = '<tr><td colspan="5" class="empty-cell">No recent messages</td></tr>';
    return;
  }

  for (const message of messages.slice().reverse()) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(message.receivedAt)}</td>
      <td>${message.clientId || 'unknown'}</td>
      <td>${message.role || 'readonly'}</td>
      <td>${message.kind || 'event'}</td>
      <td class="preview">${message.preview || ''}</td>
    `;
    elements.recentMessages.append(row);
  }
}

function renderStats(stats) {
  const activeClients = stats.activeClients ?? [];
  const knownClients = stats.knownClients ?? [];
  const recentMessages = stats.recentMessages ?? [];
  const clientIps = stats.clientIps ?? [];

  elements.activeConnections.textContent = stats.activeConnections ?? 0;
  elements.totalConnectionsSeen.textContent = stats.totalConnectionsSeen ?? 0;
  elements.messageCount.textContent = stats.messageCount ?? 0;
  elements.activeClientCount.textContent = activeClients.length;
  elements.knownClientCount.textContent = knownClients.length;
  elements.recentMessageCount.textContent = recentMessages.length;
  elements.clientIps.textContent = clientIps.length ? clientIps.join(', ') : 'No connected clients';
  elements.lastUpdated.textContent = `Updated ${formatDate(stats.generatedAt)}`;

  renderClientList(elements.activeClients, activeClients, 'No active clients');
  renderClientList(elements.knownClients, knownClients, 'No known clients yet', { known: true });
  renderMessages(recentMessages);
}

async function loadStats() {
  try {
    const response = await fetch('/stats', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const stats = await response.json();
    renderStats(stats);
    setStatus('online', 'Connected');
  } catch (error) {
    setStatus('offline', `Offline: ${error.message}`);
  }
}

await loadStats();
setInterval(loadStats, 3000);
