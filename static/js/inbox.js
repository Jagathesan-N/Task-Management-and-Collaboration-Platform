/* ===================================================
   inbox.js  –  all UI logic for the inbox page
   Place at: static/js/inbox.js
   Depends on:
     - `shownIds`  (Set)    injected by the template
     - `csrfToken` (string) injected by the template
=================================================== */

/* ── Mark a notification as read ── */
function markAsRead(notifId) {
    fetch(`/notifications/${notifId}/read/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
    }).then(() => {
        const el = document.getElementById(`notif-${notifId}`);
        if (el) {
            el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            el.style.opacity    = '0';
            el.style.transform  = 'translateX(16px)';
            setTimeout(() => { el.remove(); checkEmpty(); }, 300);
        }
    });
}

/* ── Show empty state when all notifications are dismissed ── */
function checkEmpty() {
    const list = document.getElementById('notification-list');
    if (!list.querySelector('[id^="notif-"]')) {
        list.innerHTML = `
            <div id="empty-state" class="empty-box">
                <div class="empty-icon-wrap"><i class="fa-solid fa-inbox"></i></div>
                <h3 class="text-lg font-semibold text-zinc-400">All caught up</h3>
                <p class="text-zinc-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                    When someone assigns you a task or adds you to a project, you'll see it here.
                </p>
            </div>`;
    }
}

/* ── Inject a new notification card at the top of the list ── */
function injectNotification(n) {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove();

    const list = document.getElementById('notification-list');
    const card = document.createElement('div');
    card.id        = `notif-${n.id}`;
    card.className = 'notif-card unread';
    card.innerHTML = `
        <div class="notif-icon icon-blue"><i class="fa-solid fa-bell"></i></div>
        <div class="flex-1 min-w-0">
            <p class="notif-msg">${n.message}</p>
            <p class="time-label"><i class="fa-regular fa-clock fa-xs mr-1"></i>Just now</p>
        </div>
        <button onclick="markAsRead(${n.id})" class="mark-btn">✓ Done</button>
    `;
    list.prepend(card);
}

/* ── Show a toast popup for a new notification ── */
function showToast(n) {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    toast.className = 'toast-card';
    toast.style.cssText = 'opacity:0; transform:translateX(30px);';
    toast.innerHTML = `
        <div class="notif-icon icon-blue" style="width:36px;height:36px;font-size:13px;flex-shrink:0;">
            <i class="fa-solid fa-bell"></i>
        </div>
        <div style="flex:1;">
            <p style="font-size:13px;font-weight:600;color:#1e293b;">New Notification</p>
            <p style="font-size:12px;color:#64748b;margin-top:3px;line-height:1.4;">${n.message}</p>
            <p style="font-size:11px;color:#94a3b8;margin-top:4px;">${n.created_at}</p>
        </div>
        <button onclick="this.closest('.toast-card').remove()"
                style="color:#cbd5e1;font-size:16px;cursor:pointer;line-height:1;padding:0 2px;background:none;border:none;">✕</button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity   = '1';
        toast.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

/* ── Poll for new notifications every 5 seconds ── */
setInterval(() => {
    fetch('/notifications/unread/')
        .then(res => res.json())
        .then(data => {
            data.notifications.forEach(n => {
                if (!shownIds.has(n.id)) {
                    shownIds.add(n.id);
                    injectNotification(n);
                    showToast(n);
                }
            });
        })
        .catch(() => {});
}, 5000);