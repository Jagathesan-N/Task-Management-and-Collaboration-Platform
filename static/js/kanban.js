/* ════════════════════════════════════════
   KANBAN.JS — Drag-drop, assignees, comments
════════════════════════════════════════ */

/* ── Drag-to-reorder columns ── */
document.addEventListener('DOMContentLoaded', function () {
    var csrfToken = document.getElementById('csrf-token').value;

    function updateStatus(projectId, newStatus) {
        fetch('/projects/' + projectId + '/update-status/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrfToken
            },
            body: 'status=' + encodeURIComponent(newStatus)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) console.error(data.error || 'Failed to update status');
        })
        .catch(function (err) { console.error('Error:', err); });
    }

    document.querySelectorAll('.kanban-column').forEach(function (column) {
        new Sortable(column, {
            group: { name: 'projects', pull: true, put: true },
            animation: 200,
            draggable: '.project-card',
            onEnd: function (evt) {
                var projectId = evt.item.dataset.id;
                var newStatus = evt.to.dataset.status;
                if (projectId && newStatus) updateStatus(projectId, newStatus);
            }
        });
    });
});


/* ════════════════════════════════════════
   GLOBAL FLOATING ASSIGNEE DROPDOWN
════════════════════════════════════════ */

var _activeDropdownSource = null;
var _floatingPanel = null;

/* Create the floating panel only after DOM is ready.
   When JS is a separate file, the panel must be created inside
   DOMContentLoaded — otherwise document.body is null at parse time
   and appendChild silently fails, breaking the scroll. */
document.addEventListener('DOMContentLoaded', function () {
    _floatingPanel = document.createElement('div');
    _floatingPanel.id = 'floating-assignee';
    _floatingPanel.style.cssText =
        'display:none; position:fixed; z-index:9999;' +
        'width:220px; max-height:260px; overflow-y:auto;' +
        'background:#fff; border:1px solid #e4e4e7;' +
        'border-radius:1rem; box-shadow:0 8px 30px rgba(0,0,0,0.12);';
    document.body.appendChild(_floatingPanel);
});

function closeFloatingPanel() {
    _floatingPanel.style.display = 'none';
    _floatingPanel.innerHTML = '';
    _activeDropdownSource = null;
}

/* Close when clicking outside */
document.addEventListener('click', function (e) {
    if (!_floatingPanel.contains(e.target) && e.target !== _activeDropdownSource) {
        closeFloatingPanel();
    }
});


/* ── Open the + dropdown ── */
function toggleAddDropdown(btn) {
    /* If already open for this button, close it */
    if (_activeDropdownSource === btn) {
        closeFloatingPanel();
        return;
    }

    /* Clone the hidden dropdown content from the template div next to btn */
    var templateDiv = btn.nextElementSibling;
    _floatingPanel.innerHTML = templateDiv.innerHTML;
    _activeDropdownSource = btn;

    /* Position below the button */
    var rect   = btn.getBoundingClientRect();
    var panelW = 220;
    var left   = rect.right - panelW;
    if (left < 4) left = 4;

    /* Flip up if not enough space below */
    var spaceBelow = window.innerHeight - rect.bottom - 8;
    if (spaceBelow < 150 && rect.top > 200) {
        _floatingPanel.style.top       = (rect.top - 8) + 'px';
        _floatingPanel.style.transform = 'translateY(-100%)';
    } else {
        _floatingPanel.style.top       = (rect.bottom + 6) + 'px';
        _floatingPanel.style.transform = 'none';
    }
    _floatingPanel.style.left    = left + 'px';
    _floatingPanel.style.display = 'block';
}


/* ── Read current member IDs from the hidden store div ── */
function getCurrentMemberIds(projectId) {
    var store = document.querySelector('.member-ids[data-project-id="' + projectId + '"]');
    if (!store) return [];
    var raw = store.dataset.ids;
    return raw ? raw.split(',').map(function (id) { return id.trim(); }).filter(Boolean) : [];
}

/* ── Update the hidden store div with new id list ── */
function setCurrentMemberIds(projectId, ids) {
    var store = document.querySelector('.member-ids[data-project-id="' + projectId + '"]');
    if (store) store.dataset.ids = ids.join(',');
}

/* ── Build a single avatar bubble ── */
function buildAvatar(projectId, memberId, username) {
    var initial = username.charAt(0).toUpperCase();
    var wrap    = document.createElement('div');
    wrap.className       = 'relative group';
    wrap.dataset.memberId = memberId;
    wrap.title           = username;
    wrap.innerHTML =
        '<div class="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ' +
        'border-2 border-white shadow bg-indigo-100 text-indigo-700 select-none cursor-default">' +
        initial + '</div>' +
        '<button onclick="removeMember(' + projectId + ', ' + memberId + ')" ' +
        'title="Remove ' + username + '" ' +
        'class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white ' +
        'text-[10px] font-bold leading-none items-center justify-center shadow ' +
        'hidden group-hover:flex transition-all">×</button>';
    return wrap;
}

/* ── Send full member list to backend ── */
function syncMembers(projectId, memberIds, onSuccess) {
    var csrfToken = document.getElementById('csrf-token').value;
    var body = memberIds.length
        ? memberIds.map(function (id) { return 'member_ids=' + encodeURIComponent(id); }).join('&')
        : 'member_ids=';

    fetch('/projects/' + projectId + '/assign-member/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken
        },
        body: body
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success) {
            setCurrentMemberIds(projectId, memberIds);
            if (onSuccess) onSuccess();
        } else {
            console.error('Assign failed:', data.error);
        }
    })
    .catch(function (err) { console.error('Error:', err); });
}

/* ── × button: remove one avatar, keep the rest ── */
function removeMember(projectId, memberId) {
    var newIds = getCurrentMemberIds(projectId).filter(function (id) { return id != memberId; });

    syncMembers(projectId, newIds, function () {
        var container = document.querySelector('.member-ids[data-project-id="' + projectId + '"]')
                                 .closest('.assignee-container');
        var avatarRow = container.querySelector('.avatar-row');
        var bubble    = avatarRow.querySelector('[data-member-id="' + memberId + '"]');
        if (bubble) bubble.remove();

        /* Update template dropdown checkmark */
        var templateDrop = container.querySelector('.assignee-dropdown');
        var row = templateDrop.querySelector('[data-member-id-ref="' + memberId + '"]');
        if (row) {
            row.dataset.assigned = 'false';
            row.querySelector('.assigned-check').classList.add('opacity-0');
        }
        closeFloatingPanel();
    });
}

/* ── Dropdown row: toggle a member on or off ── */
function toggleMember(projectId, memberId, username, rowEl) {
    var container    = document.querySelector('.member-ids[data-project-id="' + projectId + '"]')
                                .closest('.assignee-container');
    var templateDrop = container.querySelector('.assignee-dropdown');
    var templateRow  = templateDrop.querySelector('[data-member-id-ref="' + memberId + '"]');
    var isAssigned   = templateRow
        ? templateRow.dataset.assigned === 'true'
        : rowEl.dataset.assigned === 'true';

    var ids = getCurrentMemberIds(projectId);

    if (isAssigned) {
        ids = ids.filter(function (id) { return id != memberId; });
        syncMembers(projectId, ids, function () {
            var bubble = container.querySelector('.avatar-row [data-member-id="' + memberId + '"]');
            if (bubble) bubble.remove();
            if (templateRow) {
                templateRow.dataset.assigned = 'false';
                templateRow.querySelector('.assigned-check').classList.add('opacity-0');
            }
            closeFloatingPanel();
        });
    } else {
        if (ids.indexOf(String(memberId)) === -1) ids.push(String(memberId));
        syncMembers(projectId, ids, function () {
            var avatarRow   = container.querySelector('.avatar-row');
            var plusWrapper = avatarRow.querySelector('.plus-wrapper');
            avatarRow.insertBefore(buildAvatar(projectId, memberId, username), plusWrapper);
            if (templateRow) {
                templateRow.dataset.assigned = 'true';
                templateRow.querySelector('.assigned-check').classList.remove('opacity-0');
            }
            closeFloatingPanel();
        });
    }
}


/* ════════════════════════════════════════
   COMMENT MODAL
════════════════════════════════════════ */

var _activeProjectId = null;

function openComments(event, projectId, projectName) {
    event.stopPropagation();
    _activeProjectId = projectId;
    document.getElementById('comment-modal-title').textContent = projectName;
    document.getElementById('comment-modal-sub').textContent   = 'Team comments & updates';
    document.getElementById('comment-input').value             = '';
    document.getElementById('comment-modal').classList.remove('hidden');
    loadComments(projectId);
}

function closeComments() {
    document.getElementById('comment-modal').classList.add('hidden');
    _activeProjectId = null;
}

function loadComments(projectId) {
    var list = document.getElementById('comment-list');
    list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-8">Loading…</p>';

    fetch('/projects/' + projectId + '/comments/')
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
            var comments = data.comments || [];
            if (comments.length === 0) {
                list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-8">No comments yet. Add one below!</p>';
                return;
            }
            list.innerHTML = comments.map(function (c) {
                return '<div class="flex gap-3">' +
                    '<div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">' +
                        c.author[0].toUpperCase() +
                    '</div>' +
                    '<div class="flex-1 bg-zinc-50 rounded-2xl px-4 py-3">' +
                        '<div class="flex items-center gap-2 mb-1">' +
                            '<span class="text-xs font-semibold text-zinc-700">' + c.author + '</span>' +
                            '<span class="text-xs text-zinc-400">' + c.created_at + '</span>' +
                        '</div>' +
                        '<p class="text-sm text-zinc-700 whitespace-pre-wrap">' + c.text + '</p>' +
                    '</div>' +
                '</div>';
            }).join('');
            list.scrollTop = list.scrollHeight;
        })
        .catch(function () {
            list.innerHTML = '<p class="text-sm text-red-400 text-center py-8">Failed to load comments.</p>';
        });
}

function submitComment() {
    var input     = document.getElementById('comment-input');
    var text      = input.value.trim();
    if (!text || !_activeProjectId) return;

    var csrfToken = document.getElementById('csrf-token').value;
    var formData  = new FormData();
    formData.append('text', text);

    fetch('/projects/' + _activeProjectId + '/comments/add/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        body: formData
    })
    .then(function (resp) { return resp.json(); })
    .then(function (data) {
        if (data.success) {
            input.value = '';
            loadComments(_activeProjectId);
        } else {
            alert(data.error || 'Could not add comment.');
        }
    });
}