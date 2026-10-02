/* ════════════════════════════════════════
   HOME.JS — Project detail modal + filter/sort
════════════════════════════════════════ */

/* ── Status & Priority lookup maps ── */
var STATUS_MAP = {
    yet_to_start: { label: '🟡 Yet to Start', bg: '#fffbeb', color: '#b45309' },
    on_hold:      { label: '🔵 In Progress',  bg: '#eff6ff', color: '#1d4ed8' },
    in_review:    { label: '🟠 In Review',    bg: '#fff7ed', color: '#c2410c' },
    completed:    { label: '🟢 Completed',    bg: '#ecfdf5', color: '#065f46' }
};

var PRIORITY_MAP = {
    high:   { label: 'HIGH',   bg: '#fee2e2', color: '#dc2626' },
    medium: { label: 'MEDIUM', bg: '#fef3c7', color: '#d97706' },
    low:    { label: 'LOW',    bg: '#dcfce7', color: '#16a34a' }
};


/* ════════════════════════════════════════
   PROJECT DETAIL MODAL
════════════════════════════════════════ */

function openProjectModal(cardEl) {
    var d       = cardEl.querySelector('.modal-data').dataset;
    var members = cardEl.querySelector('.modal-members-data').innerText.trim();
    var docs    = cardEl.querySelector('.modal-docs-data').innerText.trim();
    var st = STATUS_MAP[d.status]     || {};
    var pr = PRIORITY_MAP[d.priority] || {};

    /* ── Members HTML ── */
    var membersHtml = members
        ? members.split('|||').map(function (name) {
            var ini = name.trim().split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
            return '<span style="display:inline-flex;align-items:center;gap:7px;background:#eef2ff;' +
                   'border:1px solid #c7d2fe;border-radius:20px;padding:5px 12px 5px 6px;margin:3px;">' +
                   '<span style="width:26px;height:26px;border-radius:50%;background:#4f46e5;color:#fff;' +
                   'font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;">' + ini + '</span>' +
                   '<span style="font-size:13px;color:#1e1b4b;">' + name.trim() + '</span></span>';
          }).join('')
        : '<p style="font-size:13px;color:#a1a1aa;">No members assigned.</p>';

    /* ── Documents HTML ── */
    var docsHtml = docs
        ? '<div style="margin-bottom:20px;">' +
              '<p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Attachments</p>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                  docs.split('|||').map(function (e) {
                      var parts = e.split(':::');
                      var url   = parts[0];
                      var name  = parts[1];
                      return '<a href="' + url + '" target="_blank" ' +
                             'style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;' +
                             'font-size:12px;font-weight:500;background:#eff6ff;color:#2563eb;' +
                             'border:1px solid #bfdbfe;text-decoration:none;">📎 ' + (name || 'Document') + '</a>';
                  }).join('') +
              '</div>' +
          '</div>'
        : '';

    /* ── Admin actions HTML ── */
    var adminHtml = d.isAdmin === 'true'
        ? '<div style="display:flex;justify-content:flex-end;gap:10px;padding-top:16px;border-top:1px solid #f4f4f5;margin-top:4px;">' +
              '<a href="' + d.editUrl + '" style="font-size:13px;padding:8px 18px;border-radius:10px;border:1px solid #c7d2fe;' +
              'background:transparent;color:#4f46e5;text-decoration:none;font-weight:500;">✏️ Edit</a>' +
              '<button onclick="modalDeleteProject(\'' + d.projectId + '\')" ' +
              'style="font-size:13px;padding:8px 18px;border-radius:10px;border:1px solid #fecaca;' +
              'background:transparent;color:#dc2626;cursor:pointer;font-weight:500;">🗑️ Delete</button>' +
          '</div>'
        : '';

    /* ── Compose full modal body ── */
    document.getElementById('project-detail-body').innerHTML =
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px;">' +
            '<h2 style="font-size:24px;font-weight:700;color:#18181b;line-height:1.3;">' + d.title + '</h2>' +
            '<a href="' + d.kanbanUrl + '" style="flex-shrink:0;font-size:12px;padding:6px 14px;border-radius:8px;' +
            'background:#4f46e5;color:#fff;text-decoration:none;font-weight:500;white-space:nowrap;">Open Board ↗</a>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">' +
            (st.label ? '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' : '') +
            (pr.label ? '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;background:' + pr.bg + ';color:' + pr.color + ';">' + pr.label + ' Priority</span>' : '') +
        '</div>' +
        '<div style="margin-bottom:20px;">' +
            '<p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Description</p>' +
            '<p style="font-size:15px;color:#3f3f46;line-height:1.75;">' + d.description + '</p>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;">' +
            (d.due
                ? '<div style="background:#fafafa;border-radius:10px;padding:12px 14px;flex:1;min-width:140px;">' +
                  '<p style="font-size:11px;color:#a1a1aa;margin-bottom:4px;">Due Date</p>' +
                  '<p style="font-size:14px;font-weight:600;color:#1c1917;">📅 ' + d.due + '</p></div>'
                : '') +
            '<div style="background:#fafafa;border-radius:10px;padding:12px 14px;flex:1;min-width:140px;">' +
                '<p style="font-size:11px;color:#a1a1aa;margin-bottom:4px;">Members</p>' +
                '<p style="font-size:14px;font-weight:600;color:#1c1917;">👥 ' + d.membersCount + ' member' + (d.membersCount == 1 ? '' : 's') + '</p>' +
            '</div>' +
        '</div>' +
        '<div style="margin-bottom:20px;">' +
            '<p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Team Members</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + membersHtml + '</div>' +
        '</div>' +
        docsHtml +
        adminHtml;

    /* ── Show overlay ── */
    var overlay = document.getElementById('project-detail-overlay');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
    document.getElementById('project-detail-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

function modalDeleteProject(id) {
    closeProjectModal();
    var btn = document.querySelector('.project-card-item button[data-id="' + id + '"]');
    if (btn) openDeleteModal(btn);
}

/* Close on Escape key */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeProjectModal();
});


/* ════════════════════════════════════════
   FILTER & SORT
════════════════════════════════════════ */

function applyFilters() {
    var status   = document.getElementById('filter-status').value;
    var priority = document.getElementById('filter-priority').value;
    var sort     = document.getElementById('filter-sort').value;
    var grid     = document.getElementById('projects-grid');
    var cards    = Array.prototype.slice.call(grid.querySelectorAll('.project-card-item'));

    /* Filter */
    var visible = cards.filter(function (card) {
        var matchStatus   = !status   || card.dataset.status   === status;
        var matchPriority = !priority || card.dataset.priority === priority;
        return matchStatus && matchPriority;
    });

    /* Hide all */
    cards.forEach(function (c) { c.style.display = 'none'; });

    /* Sort visible */
    if (sort === 'name-asc') {
        visible.sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name); });
    } else if (sort === 'name-desc') {
        visible.sort(function (a, b) { return b.dataset.name.localeCompare(a.dataset.name); });
    } else if (sort === 'due-asc') {
        visible.sort(function (a, b) { return (a.dataset.due || '9999').localeCompare(b.dataset.due || '9999'); });
    } else if (sort === 'due-desc') {
        visible.sort(function (a, b) { return (b.dataset.due || '').localeCompare(a.dataset.due || ''); });
    } else if (sort === 'members-desc') {
        visible.sort(function (a, b) { return Number(b.dataset.members) - Number(a.dataset.members); });
    }

    /* Re-append in sorted order and show */
    visible.forEach(function (c) { grid.appendChild(c); c.style.display = ''; });

    /* Show / hide empty-state */
    document.getElementById('no-results').classList.toggle('hidden', visible.length > 0);
}

function clearFilters() {
    document.getElementById('filter-status').value   = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-sort').value     = '';
    applyFilters();
}