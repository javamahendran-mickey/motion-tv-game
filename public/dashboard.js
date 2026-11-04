(function () {
  'use strict';

  // DOM Elements
  const statTotalIdeas = document.getElementById('stat-total-ideas');
  const statActiveAgents = document.getElementById('stat-active-agents');
  const statCompletedIdeas = document.getElementById('stat-completed-ideas');
  const statSystemHealth = document.getElementById('stat-system-health');
  const badgeAgentCount = document.getElementById('badge-agent-count');
  const agentsFleetContainer = document.getElementById('agents-fleet-container');
  const functionalityTableBody = document.getElementById('functionality-table-body');
  const ideasListContainer = document.getElementById('ideas-list-container');
  const terminalFeed = document.getElementById('terminal-feed');

  // Action Buttons
  const btnRunAll = document.getElementById('btn-run-all');
  const btnNewIdea = document.getElementById('btn-new-idea');
  const btnTerminateAll = document.getElementById('btn-terminate-all');
  const btnRetestAll = document.getElementById('btn-retest-all');
  const btnEditIdeasFile = document.getElementById('btn-edit-ideas-file');
  const btnReloadIdeas = document.getElementById('btn-reload-ideas');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  // Modals
  const modalAddIdea = document.getElementById('modal-add-idea');
  const btnCloseAddModal = document.getElementById('btn-close-add-modal');
  const btnCancelAdd = document.getElementById('btn-cancel-add');
  const btnSubmitIdea = document.getElementById('btn-submit-idea');
  const ideaTitleInput = document.getElementById('idea-title-input');
  const ideaDescInput = document.getElementById('idea-desc-input');

  const modalEditIdeas = document.getElementById('modal-edit-ideas');
  const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnSaveRawIdeas = document.getElementById('btn-save-raw-ideas');
  const ideasRawTextarea = document.getElementById('ideas-raw-textarea');

  let ws = null;
  let currentState = {
    tasks: [],
    agents: [],
    logs: [],
    stats: { totalIdeas: 0, completedIdeas: 0, activeAgents: 0, maxAgents: 4, healthyStates: 0 }
  };

  // WebSocket Connection
  function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'dashboard_register'
      }));
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        }
        const msg = JSON.parse(raw);

        if (msg.type === 'orchestrator_state') {
          currentState = msg.state;
          renderDashboard();
        } else if (msg.type === 'raw_ideas_content') {
          ideasRawTextarea.value = msg.content || '';
          modalEditIdeas.classList.add('active');
        }
      } catch (e) {
        console.error('Error parsing dashboard event:', e);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }

  // Render Whole Dashboard from State
  function renderDashboard() {
    const { tasks, agents, logs, stats } = currentState;

    // 1. Update Metrics Cards
    statTotalIdeas.textContent = stats.totalIdeas;
    statActiveAgents.textContent = `${stats.activeAgents} / ${stats.maxAgents}`;
    statCompletedIdeas.textContent = `${stats.completedIdeas} (${stats.totalIdeas > 0 ? Math.round((stats.completedIdeas / stats.totalIdeas) * 100) : 0}%)`;
    badgeAgentCount.textContent = `${stats.activeAgents} RUNNING`;

    if (stats.healthyStates === stats.totalIdeas && stats.totalIdeas > 0) {
      statSystemHealth.textContent = '100% HEALTHY';
      statSystemHealth.className = 'metric-value glow-green';
    } else if (stats.activeAgents > 0) {
      statSystemHealth.textContent = 'IMPLEMENTING';
      statSystemHealth.className = 'metric-value glow-cyan';
    } else {
      statSystemHealth.textContent = `${stats.healthyStates}/${stats.totalIdeas} VERIFIED`;
      statSystemHealth.className = 'metric-value glow-gold';
    }

    // 2. Render Active Subagents Fleet
    renderSubagentsFleet(agents);

    // 3. Render Functionality Working State Matrix
    renderFunctionalityMatrix(tasks);

    // 4. Render Ideas Backlog
    renderIdeasBacklog(tasks);

    // 5. Render Live Logs
    renderLogs(logs);
  }

  // Render Subagents
  function renderSubagentsFleet(agents) {
    if (!agents || agents.length === 0) {
      agentsFleetContainer.innerHTML = `
        <div class="empty-placeholder">
          <span class="placeholder-icon">💤</span>
          <p>No subagents running currently. Click <b>"Spawn Agent"</b> on any idea or <b>"RUN ALL IDEAS"</b> to mobilize workers!</p>
        </div>
      `;
      return;
    }

    let html = '';
    agents.forEach((agent) => {
      html += `
        <div class="agent-fleet-card active">
          <div class="agent-card-top">
            <div class="agent-identity">
              <div class="agent-avatar">🤖</div>
              <div>
                <div class="agent-name">${escapeHtml(agent.name)}</div>
                <div class="agent-role">${escapeHtml(agent.role)} • Active ${agent.uptimeSeconds}s</div>
              </div>
            </div>
            <button class="agent-btn-terminate" data-agent-id="${agent.id}">⏹️ TERMINATE AGENT</button>
          </div>
          <div class="agent-task-title">🎯 Target: <b>${escapeHtml(agent.taskTitle)}</b></div>
          <div class="progress-track">
            <div class="progress-bar" style="width: ${agent.progress}%"></div>
          </div>
        </div>
      `;
    });

    agentsFleetContainer.innerHTML = html;

    // Attach Terminate Handlers
    document.querySelectorAll('.agent-btn-terminate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const agentId = btn.dataset.agentId;
        terminateAgent(agentId);
      });
    });
  }

  // Render Functionality Matrix
  function renderFunctionalityMatrix(tasks) {
    if (!tasks || tasks.length === 0) {
      functionalityTableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding: 20px; color: #8e9bb0;">No tasks loaded yet.</td></tr>
      `;
      return;
    }

    let html = '';
    tasks.forEach((task) => {
      let stateBadge = '';
      if (task.workingState === 'healthy') {
        stateBadge = `<span class="state-badge state-healthy">✅ VERIFIED & WORKING</span>`;
      } else if (task.workingState === 'testing') {
        stateBadge = `<span class="state-badge state-testing">⚡ IMPLEMENTING & TESTING</span>`;
      } else if (task.workingState === 'error') {
        stateBadge = `<span class="state-badge state-error">❌ FAILED TEST</span>`;
      } else {
        stateBadge = `<span class="state-badge state-unverified">⏳ QUEUED</span>`;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff;">${escapeHtml(task.title)}</div>
            ${task.testResults ? `<div style="font-size: 0.72rem; color: #00f59b; font-family: monospace;">✓ ${escapeHtml(task.testResults.syntaxCheck)}</div>` : ''}
          </td>
          <td>${stateBadge}</td>
          <td>
            <div style="display:flex; align-items:center; gap: 8px;">
              <div class="progress-track" style="width: 80px;">
                <div class="progress-bar" style="width: ${task.progress || 0}%"></div>
              </div>
              <span style="font-size: 0.75rem; color: #8e9bb0;">${task.progress || 0}%</span>
            </div>
          </td>
          <td>
            ${task.agentId ? `<span style="color: #00f0ff; font-weight:700;">${task.agentId}</span>` : '<span style="color:#64748b;">Unassigned</span>'}
          </td>
          <td>
            ${task.status === 'in_progress'
              ? `<button class="mini-btn" style="color: #ff3366;" onclick="window.dashboardTerminateByTask('${task.agentId}')">⏹️ Kill Agent</button>`
              : `<button class="mini-btn-cyan" onclick="window.dashboardSpawnAgent('${task.id}')">🚀 Spawn Agent</button>`
            }
          </td>
        </tr>
      `;
    });

    functionalityTableBody.innerHTML = html;
  }

  // Render Ideas Backlog
  function renderIdeasBacklog(tasks) {
    if (!tasks || tasks.length === 0) {
      ideasListContainer.innerHTML = `
        <div class="empty-placeholder">
          <p>No ideas found in <code>ideas.txt</code>. Click <b>"Add Idea"</b> to create one!</p>
        </div>
      `;
      return;
    }

    let html = '';
    tasks.forEach((task, index) => {
      const isDone = task.status === 'completed';
      const isRunning = task.status === 'in_progress';

      html += `
        <div class="idea-item-card">
          <div class="idea-info">
            <div class="idea-title">${index + 1}. ${escapeHtml(task.title)}</div>
            <div class="idea-status-tag">Status: <b>${task.status.toUpperCase()}</b> • Added ${task.createdTime || 'today'}</div>
          </div>
          <div>
            ${isDone
              ? `<span style="color:#00f59b; font-size: 0.8rem; font-weight:800;">VERIFIED ✅</span>`
              : (isRunning
                  ? `<span style="color:#00f0ff; font-size: 0.8rem; font-weight:800;">ACTIVE ⚡</span>`
                  : `<button class="mini-btn-cyan" onclick="window.dashboardSpawnAgent('${task.id}')">🚀 Implement</button>`)
            }
          </div>
        </div>
      `;
    });

    ideasListContainer.innerHTML = html;
  }

  // Render Live Logs
  function renderLogs(logs) {
    if (!logs || logs.length === 0) return;

    let html = '';
    logs.forEach((log) => {
      let msgClass = 'log-msg-info';
      if (log.type === 'success') msgClass = 'log-msg-success';
      else if (log.type === 'warn') msgClass = 'log-msg-warn';
      else if (log.type === 'error') msgClass = 'log-msg-error';

      html += `
        <div class="log-entry">
          <span class="log-time">[${log.timestamp}]</span>
          <span class="log-agent">&lt;${escapeHtml(log.agentId)}&gt;</span>
          <span class="${msgClass}">${escapeHtml(log.message)}</span>
        </div>
      `;
    });

    terminalFeed.innerHTML = html;
  }

  // Actions
  window.dashboardSpawnAgent = (taskId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'spawn_agent',
        taskId: taskId,
        role: 'CoderAgent'
      }));
    }
  };

  window.dashboardTerminateByTask = (agentId) => {
    terminateAgent(agentId);
  };

  function terminateAgent(agentId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'terminate_agent',
        agentId: agentId
      }));
    }
  }

  btnRunAll.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'run_all_ideas' }));
    }
  });

  btnTerminateAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to terminate ALL running subagents?')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminate_all_agents' }));
      }
    }
  });

  btnRetestAll.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'retest_all' }));
    }
  });

  btnReloadIdeas.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reload_ideas' }));
    }
  });

  btnClearLogs.addEventListener('click', () => {
    terminalFeed.innerHTML = '';
  });

  // Modal: Add Idea
  btnNewIdea.addEventListener('click', () => {
    ideaTitleInput.value = '';
    ideaDescInput.value = '';
    modalAddIdea.classList.add('active');
    ideaTitleInput.focus();
  });

  btnCloseAddModal.addEventListener('click', () => modalAddIdea.classList.remove('active'));
  btnCancelAdd.addEventListener('click', () => modalAddIdea.classList.remove('active'));

  btnSubmitIdea.addEventListener('click', () => {
    const title = ideaTitleInput.value.trim();
    const desc = ideaDescInput.value.trim();
    if (!title) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'add_idea',
        title: title,
        description: desc
      }));
    }
    modalAddIdea.classList.remove('active');
  });

  // Modal: Edit ideas.txt
  btnEditIdeasFile.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get_raw_ideas' }));
    }
  });

  btnCloseEditModal.addEventListener('click', () => modalEditIdeas.classList.remove('active'));
  btnCancelEdit.addEventListener('click', () => modalEditIdeas.classList.remove('active'));

  btnSaveRawIdeas.addEventListener('click', () => {
    const content = ideasRawTextarea.value;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'save_raw_ideas',
        content: content
      }));
    }
    modalEditIdeas.classList.remove('active');
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Start Connection
  connectWebSocket();
})();
