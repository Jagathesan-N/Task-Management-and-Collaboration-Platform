/* ===================================================
   chat.js  –  all UI logic for the chat page
   Place at: static/js/chat.js
   Depends on:
     - CHAT_USER_IDS (array) injected by the template
=================================================== */

/* ── State ── */
let currentRecipientId   = null;
let currentRecipientName = 'Everyone';
let activeDeleteMsgId    = null;
let activeGroupId        = null;
let activeGroupName      = null;
let groupPollTimer       = null;
let allMembers           = [];
let selectedMemberIds    = new Set();

/* ── CSRF helper ── */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        for (let cookie of document.cookie.split(';')) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.slice(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/* ════════════════════════════════════════
   DELETE POPUP
════════════════════════════════════════ */
function showDeletePopup(event, msgId, isMine) {
    event.stopPropagation();
    activeDeleteMsgId = msgId;

    const popup          = document.getElementById('delete-popup');
    const overlay        = document.getElementById('delete-overlay');
    const forEveryoneBtn = document.getElementById('delete-for-everyone-btn');

    forEveryoneBtn.style.display = isMine ? 'flex' : 'none';

    const x = Math.min(event.clientX, window.innerWidth - 220);
    const y = event.clientY + window.scrollY - 10;
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';

    popup.classList.remove('hidden');
    overlay.classList.remove('hidden');

    document.getElementById('delete-for-me-btn').onclick = () => {
        closeDeletePopup();
        if (activeGroupId) {
            fetch(`/chat/group-messages/${activeDeleteMsgId}/delete-for-me/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            }).then(() => fetchGroupMessages(activeGroupId));
        } else {
            fetch(`/chat/delete-for-me/${activeDeleteMsgId}/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            }).then(() => loadMessages());
        }
    };

    document.getElementById('delete-for-everyone-btn').onclick = () => {
        closeDeletePopup();
        if (activeGroupId) {
            fetch(`/chat/group-messages/${activeDeleteMsgId}/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            }).then(() => fetchGroupMessages(activeGroupId));
        } else {
            fetch(`/chat/delete/${activeDeleteMsgId}/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            }).then(() => loadMessages());
        }
    };
}

function closeDeletePopup() {
    document.getElementById('delete-popup').classList.add('hidden');
    document.getElementById('delete-overlay').classList.add('hidden');
}

/* ════════════════════════════════════════
   MOBILE CHAT SIDEBAR HELPERS
════════════════════════════════════════ */
function toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const backdrop = document.getElementById('chat-sidebar-backdrop');
    
    if (!sidebar) {
        console.error("Sidebar element not found!");
        return;
    }

    const isOpen = sidebar.classList.contains('flex');

    if (!isOpen) {
        // Open
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        closeChatSidebar();
    }
}

function closeChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const backdrop = document.getElementById('chat-sidebar-backdrop');
    
    if (sidebar) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
    }
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
}

/* ════════════════════════════════════════
   DM / BROADCAST
════════════════════════════════════════ */
function selectRecipient(id, name) {
    activeGroupId   = null;
    activeGroupName = null;
    clearInterval(groupPollTimer);

    currentRecipientId   = id;
    currentRecipientName = name;

    document.getElementById('chat-header-name').textContent = name;
    document.getElementById('chat-header-sub').textContent  = id ? 'Direct message' : 'Broadcast to all members';
    document.getElementById('to-label').textContent         = name;
    document.getElementById('header-icon').className        = id ? 'fa-solid fa-user text-sm' : 'fa-solid fa-users text-sm';

    const deleteBtn = document.getElementById('delete-group-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
    const leaveBtn = document.getElementById('leave-group-btn');
    if (leaveBtn) leaveBtn.classList.add('hidden');
    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) clearBtn.classList.remove('hidden');

    hideGroupMembersPanel();
    document.getElementById('header-chevron').classList.add('hidden');
    document.getElementById('group-header-clickable').style.cursor = 'default';

    document.querySelectorAll('.recipient-btn, .group-btn').forEach(b =>
        b.classList.remove('active-recipient', 'bg-white', 'shadow-sm'));
    const active = document.getElementById(`recipient-btn-${id === null ? 'null' : id}`);
    if (active) active.classList.add('active-recipient', 'bg-white', 'shadow-sm');

    const formData = new FormData();
    if (id) formData.append('sender_id', id);
    fetch('/chat/mark-read/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: formData
    }).then(() => loadUnreadCounts());

    // Auto-close sidebar on mobile/narrow tablet after selecting
    if (window.innerWidth <= 720) closeChatSidebar();

    loadMessages();
}

function loadMessages() {
    if (activeGroupId) return;
    fetch('/chat/messages/?recipient=' + (currentRecipientId || ''))
        .then(r => r.json())
        .then(data => { if (!activeGroupId) renderMessages(data.messages); });
}

function renderMessages(messages) {
    const area = document.getElementById('chat-messages');
    if (messages.length === 0) {
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center py-20">
                <i class="fa-solid fa-comments text-6xl text-zinc-300 mb-4"></i>
                <h3 class="text-lg font-medium text-zinc-400">No messages yet</h3>
                <p class="text-zinc-400 text-sm mt-1">Be the first to say something!</p>
            </div>`;
        return;
    }

    area.innerHTML = messages.map(m => {
        if (m.is_mine) {
            return `
            <div class="flex justify-end group" id="msg-${m.id}">
                <div class="max-w-[70%]">
                    <div class="flex items-center justify-end gap-2 mb-1">
                        <span class="text-xs text-zinc-400">${m.created_at}</span>
                        <span class="text-xs font-medium text-indigo-600">You</span>
                        ${m.recipient === 'Everyone' ? '<span class="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">→ Everyone</span>' : ''}
                    </div>
                    <div class="relative bg-indigo-600 text-white px-5 py-3 rounded-3xl rounded-br-none">
                        ${m.is_deleted
                            ? `<p class="text-sm italic text-indigo-200">🚫 This message was deleted</p>`
                            : `<p class="text-sm">${m.message}</p>`}
                        ${!m.is_deleted ? `
                        <button onclick="showDeletePopup(event, ${m.id}, true)"
                                class="absolute -top-2 -right-2 hidden group-hover:flex w-7 h-7 bg-white text-zinc-400 hover:text-red-500 rounded-full shadow items-center justify-center text-xs">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        } else {
            return `
            <div class="flex justify-start group" id="msg-${m.id}">
                <div class="max-w-[70%]">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-medium text-zinc-600">${m.sender}</span>
                        ${m.recipient === 'Everyone' ? '<span class="text-xs bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded-full">→ Everyone</span>' : ''}
                        <span class="text-xs text-zinc-400">${m.created_at}</span>
                    </div>
                    <div class="relative bg-white border border-zinc-200 px-5 py-3 rounded-3xl rounded-bl-none shadow-sm">
                        ${m.is_deleted
                            ? `<p class="text-sm italic text-zinc-400">🚫 This message was deleted</p>`
                            : `<p class="text-sm text-zinc-800">${m.message}</p>`}
                        ${!m.is_deleted ? `
                        <button onclick="showDeletePopup(event, ${m.id}, false)"
                                class="absolute -top-2 -right-2 hidden group-hover:flex w-7 h-7 bg-white text-zinc-400 hover:text-orange-500 rounded-full shadow items-center justify-center text-xs">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        }
    }).join('');

    area.scrollTop = area.scrollHeight;
}

/* ════════════════════════════════════════
   GROUPS
════════════════════════════════════════ */
function selectGroup(groupId, groupName) {
    currentRecipientId   = null;
    currentRecipientName = null;
    activeGroupId        = groupId;
    activeGroupName      = groupName;

    clearInterval(groupPollTimer);

    document.getElementById('chat-header-name').textContent = groupName;
    document.getElementById('chat-header-sub').textContent  = 'Group chat';
    document.getElementById('to-label').textContent         = groupName;
    document.getElementById('header-icon').className        = 'fa-solid fa-users-rectangle text-sm';

    const deleteBtn = document.getElementById('delete-group-btn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');
    const leaveBtn = document.getElementById('leave-group-btn');
    if (leaveBtn) leaveBtn.classList.remove('hidden');
    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) clearBtn.classList.add('hidden');

    document.getElementById('header-chevron').classList.remove('hidden');
    document.getElementById('group-header-clickable').style.cursor = 'pointer';
    hideGroupMembersPanel();

    document.querySelectorAll('.recipient-btn, .group-btn').forEach(b =>
        b.classList.remove('active-recipient', 'bg-white', 'shadow-sm'));
    const active = document.getElementById(`group-btn-${groupId}`);
    if (active) active.classList.add('active-recipient', 'bg-white', 'shadow-sm');

    // Auto-close sidebar on mobile/narrow tablet after selecting
    if (window.innerWidth <= 720) closeChatSidebar();

    fetchGroupMessages(groupId);
    groupPollTimer = setInterval(() => fetchGroupMessages(groupId), 4000);
}

async function fetchGroupMessages(groupId) {
    if (String(groupId) !== String(activeGroupId)) return;
    const resp = await fetch(`/chat/groups/${groupId}/messages/`);
    const data = await resp.json();
    if (String(groupId) !== String(activeGroupId)) return;
    renderGroupMessages(data.messages || []);
}

function renderGroupMessages(messages) {
    const area = document.getElementById('chat-messages');
    if (messages.length === 0) {
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center py-20">
                <i class="fa-solid fa-comments text-6xl text-zinc-300 mb-4"></i>
                <h3 class="text-lg font-medium text-zinc-400">No messages yet</h3>
                <p class="text-zinc-400 text-sm mt-1">Send the first message!</p>
            </div>`;
        return;
    }

    area.innerHTML = messages.map(m => {
        if (m.is_mine) {
            return `
            <div class="flex justify-end group" id="msg-${m.id}">
                <div class="max-w-[70%]">
                    <div class="flex items-center justify-end gap-2 mb-1">
                        <span class="text-xs text-zinc-400">${m.created_at}</span>
                        <span class="text-xs font-medium text-indigo-600">You</span>
                    </div>
                    <div class="relative bg-indigo-600 text-white px-5 py-3 rounded-3xl rounded-br-none">
                        ${m.is_deleted
                            ? `<p class="text-sm italic text-indigo-200">🚫 This message was deleted</p>`
                            : `<p class="text-sm">${m.message}</p>`}
                        ${!m.is_deleted ? `
                        <button onclick="showDeletePopup(event, ${m.id}, true)"
                                class="absolute -top-2 -right-2 hidden group-hover:flex w-7 h-7 bg-white text-zinc-400 hover:text-red-500 rounded-full shadow items-center justify-center text-xs">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        } else {
            return `
            <div class="flex justify-start group" id="msg-${m.id}">
                <div class="max-w-[70%]">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-6 h-6 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                            ${m.sender ? m.sender[0].toUpperCase() : '?'}
                        </div>
                        <span class="text-xs font-medium text-zinc-600">${m.sender}</span>
                        <span class="text-xs text-zinc-400">${m.created_at}</span>
                    </div>
                    <div class="relative bg-white border border-zinc-200 px-5 py-3 rounded-3xl rounded-bl-none shadow-sm">
                        ${m.is_deleted
                            ? `<p class="text-sm italic text-zinc-400">🚫 This message was deleted</p>`
                            : `<p class="text-sm text-zinc-800">${m.message}</p>`}
                        ${!m.is_deleted ? `
                        <button onclick="showDeletePopup(event, ${m.id}, false)"
                                class="absolute -top-2 -right-2 hidden group-hover:flex w-7 h-7 bg-white text-zinc-400 hover:text-orange-500 rounded-full shadow items-center justify-center text-xs">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        }
    }).join('');

    area.scrollTop = area.scrollHeight;
}

/* ── Send message ── */
function sendMessage() {
    const input = document.getElementById('message-input');
    const text  = input.value.trim();
    if (!text) return;

    if (activeGroupId) {
        const formData = new FormData();
        formData.append('message', text);
        fetch(`/chat/groups/${activeGroupId}/send/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData
        }).then(() => { input.value = ''; fetchGroupMessages(activeGroupId); });
        return;
    }

    const formData = new FormData();
    formData.append('message', text);
    if (currentRecipientId) formData.append('recipient_id', currentRecipientId);
    fetch('/chat/send/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: formData
    }).then(() => { input.value = ''; loadMessages(); });
}

/* ════════════════════════════════════════
   UNREAD BADGES
════════════════════════════════════════ */
function loadUnreadCounts() {
    fetch('/chat/unread-counts/')
        .then(r => r.json())
        .then(data => {
            const counts = data.counts || {};

            updateBadge('null', counts['broadcast'] || 0);

            CHAT_USER_IDS.forEach(uid => {
                updateBadge(String(uid), counts[String(uid)] || 0);
            });

            Object.keys(counts).forEach(key => {
                if (key.startsWith('group_')) {
                    updateGroupBadge(key.replace('group_', ''), counts[key]);
                }
            });

            let total = (counts['broadcast'] || 0);
            Object.keys(counts).forEach(k => {
                if (!isNaN(k) || k.startsWith('group_')) total += (counts[k] || 0);
            });
            const navBadge = document.getElementById('sidebar-chat-badge');
            if (navBadge) {
                navBadge.textContent = total > 99 ? '99+' : total;
                navBadge.classList.toggle('hidden', total === 0);
            }
        });
}

function updateBadge(uid, count) {
    const badge = document.getElementById(`badge-${uid}`);
    if (!badge) return;
    const isActive = (uid === 'null' && currentRecipientId === null && !activeGroupId) ||
                     (uid === String(currentRecipientId));
    if (isActive || count <= 0) {
        badge.classList.add('hidden');
    } else {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    }
}

function updateGroupBadge(groupId, count) {
    const badge = document.getElementById(`grp-badge-${groupId}`);
    if (!badge) return;
    if (String(groupId) === String(activeGroupId) || count <= 0) {
        badge.classList.add('hidden');
    } else {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    }
}

/* ════════════════════════════════════════
   GROUP MEMBERS PANEL
════════════════════════════════════════ */
function toggleGroupMembersPanel() {
    if (!activeGroupId) return;
    const panel   = document.getElementById('group-members-panel');
    const chevron = document.getElementById('header-chevron');
    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
        loadGroupMembers(activeGroupId);
    } else {
        panel.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
    }
}

async function loadGroupMembers(groupId) {
    const container = document.getElementById('group-members-list');
    container.innerHTML = '<p class="text-sm text-zinc-400">Loading…</p>';
    try {
        const resp = await fetch(`/chat/groups/${groupId}/members/`);
        const data = await resp.json();
        container.innerHTML = (data.members || []).map(m => `
            <div class="flex items-center gap-2 bg-white border border-zinc-200 rounded-2xl px-3 py-2 shadow-sm">
                <div class="w-7 h-7 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                    ${m.display[0].toUpperCase()}
                </div>
                <div>
                    <p class="text-sm font-medium text-zinc-800 leading-tight">${m.display}</p>
                    <p class="text-xs text-zinc-400 leading-tight">@${m.username}</p>
                </div>
                ${m.is_creator ? '<span class="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Admin</span>' : ''}
            </div>
        `).join('');
    } catch {
        container.innerHTML = '<p class="text-sm text-red-400">Failed to load members.</p>';
    }
}

function hideGroupMembersPanel() {
    document.getElementById('group-members-panel').classList.add('hidden');
    document.getElementById('header-chevron').style.transform = 'rotate(0deg)';
}

/* ════════════════════════════════════════
   CREATE GROUP MODAL
════════════════════════════════════════ */
async function openCreateGroupModal() {
    selectedMemberIds.clear();
    document.getElementById('group-name-input').value    = '';
    document.getElementById('member-search-input').value = '';
    document.getElementById('group-create-error').classList.add('hidden');
    renderSelectedPreview();

    if (allMembers.length === 0) {
        const resp  = await fetch('/chat/groups/create/');
        const data  = await resp.json();
        allMembers  = data.users || [];
    }
    renderMemberPicker('');
    document.getElementById('create-group-modal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('create-group-modal').classList.add('hidden');
}

function filterMembers(query) {
    renderMemberPicker(query.toLowerCase());
}

function renderMemberPicker(query) {
    const container = document.getElementById('member-picker-list');
    const filtered  = allMembers.filter(u => u.display.toLowerCase().includes(query));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-sm text-zinc-400 px-2 py-1">No members found.</p>';
        return;
    }

    container.innerHTML = filtered.map(u => `
        <label class="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-zinc-50 cursor-pointer">
            <input type="checkbox" class="member-cb rounded" value="${u.id}"
                   ${selectedMemberIds.has(String(u.id)) ? 'checked' : ''}
                   onchange="toggleMember(${u.id}, '${u.display.replace(/'/g,"\\'")}', this.checked)">
            <div class="w-7 h-7 bg-zinc-200 text-zinc-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                ${u.display[0].toUpperCase()}
            </div>
            <span class="text-sm text-zinc-700">${u.display}</span>
        </label>
    `).join('');
}

function toggleMember(id, display, checked) {
    if (checked) selectedMemberIds.add(String(id));
    else selectedMemberIds.delete(String(id));
    renderSelectedPreview();
}

function renderSelectedPreview() {
    const container = document.getElementById('selected-members-preview');
    if (selectedMemberIds.size === 0) { container.innerHTML = ''; return; }
    container.innerHTML = [...selectedMemberIds].map(id => {
        const m = allMembers.find(u => String(u.id) === id);
        if (!m) return '';
        return `<span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
            ${m.display}
            <button onclick="toggleMember(${id},'',false)" class="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
        </span>`;
    }).join('');
}

async function confirmCreateGroup() {
    const name  = document.getElementById('group-name-input').value.trim();
    const errEl = document.getElementById('group-create-error');
    errEl.classList.add('hidden');

    if (!name) {
        errEl.textContent = 'Please enter a group name.';
        errEl.classList.remove('hidden');
        return;
    }
    if (selectedMemberIds.size === 0) {
        errEl.textContent = 'Please select at least one member.';
        errEl.classList.remove('hidden');
        return;
    }

    const resp = await fetch('/chat/groups/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ name, member_ids: [...selectedMemberIds] })
    });
    const data = await resp.json();

    if (data.success) {
        closeCreateGroupModal();
        addGroupToSidebar(data.group_id, data.group_name);
        selectGroup(data.group_id, data.group_name);
    } else {
        errEl.textContent = data.error || 'Could not create group.';
        errEl.classList.remove('hidden');
    }
}

function addGroupToSidebar(groupId, groupName) {
    document.getElementById('no-groups-msg')?.remove();
    const list = document.getElementById('group-list');
    const btn  = document.createElement('button');
    btn.id        = `group-btn-${groupId}`;
    btn.className = 'group-btn w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-left transition hover:bg-white';
    btn.setAttribute('onclick', `selectGroup(${groupId}, '${groupName.replace(/'/g, "\\'")}')`);;
    btn.innerHTML = `
        <div class="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold">G</div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-zinc-800 truncate">${groupName}</p>
            <p class="text-xs text-zinc-400">Group</p>
        </div>
        <span id="grp-badge-${groupId}" class="hidden bg-amber-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1"></span>`;
    list.prepend(btn);
}

/* ════════════════════════════════════════
   LEAVE / DELETE GROUP
════════════════════════════════════════ */
function leaveGroup() {
    if (!activeGroupId) return;
    document.getElementById('leave-group-name').textContent = activeGroupName;
    document.getElementById('leave-confirm-modal').classList.remove('hidden');
}

async function confirmLeaveGroup() {
    document.getElementById('leave-confirm-modal').classList.add('hidden');
    const resp = await fetch(`/chat/groups/${activeGroupId}/leave/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
    });
    const data = await resp.json();
    if (data.success) {
        document.getElementById(`group-btn-${activeGroupId}`)?.remove();
        clearInterval(groupPollTimer);
        activeGroupId   = null;
        activeGroupName = null;
        selectRecipient(null, 'Everyone');
    }
}

function cancelLeaveGroup() {
    document.getElementById('leave-confirm-modal').classList.add('hidden');
}

function deleteGroup() {
    if (!activeGroupId) return;
    document.getElementById('delete-group-name').textContent = activeGroupName;
    document.getElementById('delete-group-confirm-modal').classList.remove('hidden');
}

async function confirmDeleteGroup() {
    document.getElementById('delete-group-confirm-modal').classList.add('hidden');
    const resp = await fetch(`/chat/groups/${activeGroupId}/delete/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
    });
    const data = await resp.json();
    if (data.success) {
        document.getElementById(`group-btn-${activeGroupId}`)?.remove();
        clearInterval(groupPollTimer);
        activeGroupId   = null;
        activeGroupName = null;
        selectRecipient(null, 'Everyone');
    } else {
        alert(data.error || 'Could not delete group.');
    }
}

function cancelDeleteGroup() {
    document.getElementById('delete-group-confirm-modal').classList.add('hidden');
}

/* ════════════════════════════════════════
   CLEAR ALL CHAT
════════════════════════════════════════ */
function clearAllChat() {
    document.getElementById('clear-all-confirm-modal').classList.remove('hidden');
}

function cancelClearAll() {
    document.getElementById('clear-all-confirm-modal').classList.add('hidden');
}

async function confirmClearAll() {
    document.getElementById('clear-all-confirm-modal').classList.add('hidden');
    const formData = new FormData();
    if (currentRecipientId) formData.append('recipient_id', currentRecipientId);
    try {
        const resp = await fetch('/chat/clear-all/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData
        });
        const data = await resp.json();
        if (data.success) {
            document.getElementById('chat-messages').innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-20">
                    <i class="fa-solid fa-comments text-6xl text-zinc-300 mb-4"></i>
                    <h3 class="text-lg font-medium text-zinc-400">No messages yet</h3>
                    <p class="text-zinc-400 text-sm mt-1">Be the first to say something!</p>
                </div>`;
            // Immediately re-poll so any in-flight poll result is superseded
            if (!activeGroupId) loadMessages();
        } else {
            alert(data.error || 'Could not clear chat.');
        }
    } catch (err) {
        alert('Network error. Could not clear chat.');
    }
}

/* ════════════════════════════════════════
   POLLING + INIT
════════════════════════════════════════ */
setInterval(() => { if (!activeGroupId) loadMessages(); }, 4000);
setInterval(loadUnreadCounts, 4000);

selectRecipient(null, 'Everyone');
loadUnreadCounts();