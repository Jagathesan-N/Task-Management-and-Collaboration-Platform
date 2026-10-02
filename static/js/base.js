/* ════════════════════════════════════════
   BASE.JS — Sidebar, modals, toasts, polling
════════════════════════════════════════ */

/* ── Sidebar ── */
function openSidebar() {
  document.getElementById('main-sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('main-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// Close sidebar when a nav link or button is tapped on mobile
document.querySelectorAll('#main-sidebar a, #main-sidebar button').forEach(function (el) {
  el.addEventListener('click', function () {
    if (window.innerWidth < 768) closeSidebar();
  });
});


/* ── Delete Project Modal ── */
function openDeleteModal(btn) {
  var id   = btn.dataset.id;
  var name = btn.dataset.name;
  document.getElementById('deleteProjectName').textContent = '"' + name + '"';
  document.getElementById('deleteForm').action = '/projects/' + id + '/delete/';
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  document.getElementById('deleteModal').classList.remove('flex');
}

document.getElementById('deleteModal').addEventListener('click', function (e) {
  if (e.target === this) closeDeleteModal();
});


/* ════════════════════════════════════════
   INVITE GUEST MODAL
════════════════════════════════════════ */
(function () {
  var addGuestBtn   = document.getElementById('addGuestBtn');
  var modal         = document.getElementById('addGuestModal');
  var closeBtn      = document.getElementById('closeGuestModal');
  var cancelBtn     = document.getElementById('cancelGuestModal');
  var createBtn     = document.getElementById('createUserBtn');
  var sendInviteBtn = document.getElementById('sendInviteBtn');

  if (!addGuestBtn || !modal) return;

  // ── helpers ──────────────────────────────────────────────────────
  function getFormUrl() {
    var pid = addGuestBtn.dataset.projectId ? addGuestBtn.dataset.projectId : '0';
    return '/send-invite/' + pid + '/';
  }

  function getCsrf() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
  }

  function showToast(message, isSuccess) {
    var container = document.getElementById('toast-container');
    var color  = isSuccess ? '#22c55e' : '#ef4444';
    var bg     = isSuccess ? '#f0fdf4' : '#fef2f2';
    var icon   = isSuccess ? 'fa-check'  : 'fa-xmark';
    var title  = isSuccess ? (message.toLowerCase().includes('sent') ? 'Invite Sent!' : 'Success') : 'Error';

    var toast = document.createElement('div');
    toast.style.cssText =
      'opacity:0;transform:translateX(30px);transition:opacity 0.3s ease,transform 0.3s ease;' +
      'background:#fff;border:1px solid #e2e8f0;border-left:4px solid ' + color + ';' +
      'border-radius:14px;padding:14px 18px;width:320px;display:flex;align-items:center;' +
      'gap:12px;box-shadow:0 12px 40px rgba(0,0,0,0.1);';
    toast.innerHTML =
      '<div style="width:36px;height:36px;border-radius:10px;background:' + bg + ';color:' + color + ';' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      '<i class="fa-solid ' + icon + '" style="font-size:14px;"></i></div>' +
      '<div style="flex:1;"><p style="font-size:13px;font-weight:600;color:#1e293b;margin:0;">' + title + '</p>' +
      '<p style="font-size:12px;color:#64748b;margin:3px 0 0;">' + message + '</p></div>' +
      '<button onclick="this.parentElement.remove()" style="color:#cbd5e1;font-size:16px;cursor:pointer;background:none;border:none;">&#10005;</button>';

    container.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      setTimeout(function () { toast.remove(); }, 300);
    }, 5000);
  }

  function postAction(action, callback) {
    var email    = document.getElementById('invite-email').value.trim();
    var username = document.getElementById('invite-username').value.trim();
    var password = document.getElementById('invite-password').value.trim();

    if (!username || !password) {
      showToast('Username and password are required.', false);
      return;
    }
    if (action === 'invite' && !email) {
      showToast('Email address is required.', false);
      return;
    }

    var fd = new FormData();
    fd.append('email',               email);
    fd.append('username',            username);
    fd.append('password',            password);
    fd.append('action',              action);
    fd.append('csrfmiddlewaretoken', getCsrf());

    fetch(getFormUrl(), {
      method: 'POST',
      body: fd,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        showToast(data.message, data.success);
        if (callback) callback(data);
      })
      .catch(function (err) { showToast('Network error: ' + err.message, false); });
  }

  // ── open ─────────────────────────────────────────────────────────
  addGuestBtn.addEventListener('click', function () {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });

  // ── close ────────────────────────────────────────────────────────
  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    ['invite-email', 'invite-username', 'invite-password'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('invite-hint').textContent =
      'Step 1: Click Create to save user credentials, then click Send Invite.';
  }

  if (closeBtn)  closeBtn.addEventListener('click',  closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  // ── CREATE ───────────────────────────────────────────────────────
  if (createBtn) {
    createBtn.addEventListener('click', function () {
      postAction('create', function (data) {
        if (data.success) {
          document.getElementById('invite-hint').innerHTML =
            '✅ User created! Now click <strong>Send Invite</strong> to email the credentials.';
        }
      });
    });
  }

  // ── SEND INVITE ──────────────────────────────────────────────────
  if (sendInviteBtn) {
    sendInviteBtn.addEventListener('click', function () {
      postAction('invite', function (data) {
        if (data.success) {
          document.getElementById('invite-hint').innerHTML =
            '✅ Invite sent! You can close this or send another invite.';
        }
      });
    });
  }
})();


/* ════════════════════════════════════════
   MANAGE USERS MODAL
════════════════════════════════════════ */
(function () {
  var openBtn      = document.getElementById('manageUsersBtn');
  var modal        = document.getElementById('manageUsersModal');
  var closeBtn     = document.getElementById('closeManageModal');
  var closeFooter  = document.getElementById('closeManageModalFooter');
  var searchInput  = document.getElementById('userSearchInput');
  var tableBody    = document.getElementById('usersTableBody');
  var resetPanel   = document.getElementById('resetPwPanel');
  var resetName    = document.getElementById('resetTargetName');
  var newPassInput = document.getElementById('newPasswordInput');
  var confirmReset = document.getElementById('confirmResetBtn');
  var cancelReset  = document.getElementById('cancelResetBtn');
  var delModal     = document.getElementById('confirmDelUserModal');
  var delName      = document.getElementById('delUserName');
  var cancelDel    = document.getElementById('cancelDelUser');
  var confirmDel   = document.getElementById('confirmDelUser');

  if (!openBtn || !modal) return;

  var allUsers = [], resetUserId = null, deleteUserId = null;

  function getCsrf() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
  }

  function showToast(message, ok) {
    var c     = document.getElementById('toast-container');
    var color = ok ? '#22c55e' : '#ef4444';
    var bg    = ok ? '#f0fdf4' : '#fef2f2';
    var icon  = ok ? 'fa-check' : 'fa-xmark';
    var t = document.createElement('div');
    t.style.cssText =
      'opacity:0;transform:translateX(30px);transition:opacity .3s,transform .3s;background:#fff;' +
      'border:1px solid #e2e8f0;border-left:4px solid ' + color + ';border-radius:14px;' +
      'padding:14px 18px;width:320px;display:flex;align-items:center;gap:12px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.1);';
    t.innerHTML =
      '<div style="width:36px;height:36px;border-radius:10px;background:' + bg + ';color:' + color +
      ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      '<i class="fa-solid ' + icon + '" style="font-size:14px;"></i></div>' +
      '<div style="flex:1;"><p style="font-size:13px;font-weight:600;color:#1e293b;margin:0;">' +
      (ok ? 'Success' : 'Error') + '</p><p style="font-size:12px;color:#64748b;margin:3px 0 0;">' +
      message + '</p></div>' +
      '<button onclick="this.parentElement.remove()" style="color:#cbd5e1;font-size:16px;cursor:pointer;background:none;border:none;">&#10005;</button>';
    c.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(0)'; });
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transform = 'translateX(30px)';
      setTimeout(function () { t.remove(); }, 300);
    }, 5000);
  }

  function avatarBg(name) {
    var cols = ['#4f46e5','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2'];
    var h = 0;
    for (var i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return cols[Math.abs(h) % cols.length];
  }

  function renderUsers(users) {
    if (!users.length) {
      tableBody.innerHTML = '<div class="flex items-center justify-center py-12 text-zinc-400 text-sm">No users found.</div>';
      return;
    }
    tableBody.innerHTML = '';
    users.forEach(function (u) {
      var initials = (u.first_name && u.last_name)
        ? (u.first_name[0] + u.last_name[0]).toUpperCase()
        : u.username.slice(0, 2).toUpperCase();

      var row = document.createElement('div');
      row.className = 'flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 transition';
      row.innerHTML =
        '<div style="width:38px;height:38px;border-radius:12px;background:' + avatarBg(u.username) +
        ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">' + initials + '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<p class="text-sm font-semibold text-zinc-800 truncate">' + (u.first_name || '') + ' ' + (u.last_name || '') +
          ' <span class="text-zinc-400 font-normal">@' + u.username + '</span></p>' +
          '<p class="text-xs text-zinc-400 truncate">' + (u.email || 'No email') + '</p>' +
        '</div>' +
        '<span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ' +
          (u.is_staff ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500') + '">' +
          (u.is_staff ? 'Admin' : 'Member') + '</span>' +
        '<div class="flex gap-2 flex-shrink-0">' +
          '<button class="reset-btn text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition" data-id="' + u.id + '" data-name="' + u.username + '"><i class="fa-solid fa-key mr-1"></i>Reset PW</button>' +
          (!u.is_staff
            ? '<button class="del-btn text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition" data-id="' + u.id + '" data-name="' + u.username + '"><i class="fa-solid fa-trash-can mr-1"></i>Delete</button>'
            : '') +
        '</div>';
      tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.reset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        resetUserId = btn.dataset.id;
        resetName.textContent = '@' + btn.dataset.name;
        newPassInput.value = '';
        resetPanel.classList.remove('hidden');
        newPassInput.focus();
      });
    });

    tableBody.querySelectorAll('.del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteUserId = btn.dataset.id;
        delName.textContent = '@' + btn.dataset.name;
        delModal.classList.remove('hidden');
        delModal.classList.add('flex');
      });
    });
  }

  function loadUsers() {
    tableBody.innerHTML =
      '<div class="flex items-center justify-center py-12 text-zinc-400 text-sm">' +
      '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading…</div>';
    fetch('/manage-users/list/')
      .then(function (r) { return r.json(); })
      .then(function (d) { allUsers = d.users; renderUsers(allUsers); })
      .catch(function () {
        tableBody.innerHTML =
          '<div class="flex items-center justify-center py-12 text-red-400 text-sm">Failed to load users.</div>';
      });
  }

  searchInput.addEventListener('input', function () {
    var q = searchInput.value.toLowerCase();
    renderUsers(allUsers.filter(function (u) {
      return u.username.toLowerCase().includes(q) ||
             (u.first_name || '').toLowerCase().includes(q) ||
             (u.last_name  || '').toLowerCase().includes(q) ||
             (u.email      || '').toLowerCase().includes(q);
    }));
  });

  openBtn.addEventListener('click', function () {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    resetPanel.classList.add('hidden');
    searchInput.value = '';
    loadUsers();
  });

  function closeManage() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    resetPanel.classList.add('hidden');
  }

  closeBtn.addEventListener('click', closeManage);
  closeFooter.addEventListener('click', closeManage);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeManage(); });

  cancelReset.addEventListener('click', function () {
    resetPanel.classList.add('hidden');
    resetUserId = null;
  });

  confirmReset.addEventListener('click', function () {
    var pw = newPassInput.value.trim();
    if (pw.length < 6) { showToast('Password must be at least 6 characters.', false); return; }
    fetch('/manage-users/' + resetUserId + '/reset-password/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        showToast(d.message, d.success);
        if (d.success) { resetPanel.classList.add('hidden'); resetUserId = null; newPassInput.value = ''; }
      })
      .catch(function () { showToast('Network error.', false); });
  });

  cancelDel.addEventListener('click', function () {
    delModal.classList.add('hidden');
    delModal.classList.remove('flex');
    deleteUserId = null;
  });

  confirmDel.addEventListener('click', function () {
    fetch('/manage-users/' + deleteUserId + '/delete/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() }
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        showToast(d.message, d.success);
        delModal.classList.add('hidden');
        delModal.classList.remove('flex');
        deleteUserId = null;
        if (d.success) loadUsers();
      })
      .catch(function () { showToast('Network error.', false); });
  });
})();


/* ════════════════════════════════════════
   GLOBAL NOTIFICATION POLLING + TOAST + BADGE
════════════════════════════════════════ */
var _shownNotifIds = new Set();

function _updateBadge(count) {
  var badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function _showNotifToast(n) {
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.style.cssText =
    'opacity:0;transform:translateX(30px);transition:opacity 0.3s ease,transform 0.3s ease;' +
    'background:#fff;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:14px;' +
    'padding:14px 18px;width:320px;display:flex;align-items:flex-start;gap:12px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,0.1);margin-bottom:4px;';
  toast.innerHTML =
    '<div style="width:36px;height:36px;border-radius:10px;background:#eff6ff;color:#3b82f6;' +
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
    '<i class="fa-solid fa-bell" style="font-size:13px;"></i></div>' +
    '<div style="flex:1;">' +
      '<p style="font-size:13px;font-weight:600;color:#1e293b;margin:0;">New Notification</p>' +
      '<p style="font-size:12px;color:#64748b;margin:3px 0 0;line-height:1.4;">' + n.message + '</p>' +
      '<p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">' + n.created_at + '</p>' +
    '</div>' +
    '<button onclick="this.parentElement.remove()" style="color:#cbd5e1;font-size:16px;cursor:pointer;background:none;border:none;padding:0 2px;line-height:1;">&#10005;</button>';

  container.appendChild(toast);
  requestAnimationFrame(function () {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(function () { toast.remove(); }, 300);
  }, 6000);
}

// Poll notifications every 5 seconds
setInterval(function () {
  fetch('/notifications/unread/')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _updateBadge(data.notifications.length);
      data.notifications.forEach(function (n) {
        if (!_shownNotifIds.has(n.id)) {
          _shownNotifIds.add(n.id);
          _showNotifToast(n);
        }
      });
    })
    .catch(function () {});
}, 5000);

// Poll chat unread counts every 5 seconds
function _updateChatBadge() {
  fetch('/chat/unread-counts/')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var counts = data.counts;
      var total = counts['broadcast'] || 0;
      Object.keys(counts).forEach(function (k) {
        if (k !== 'broadcast') total += (counts[k] || 0);
      });

      var badge = document.getElementById('sidebar-chat-badge');
      if (!badge) return;
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    })
    .catch(function () {});
}

_updateChatBadge();
setInterval(_updateChatBadge, 5000);