/* ===================================================
   calendar.js  –  all UI logic for the calendar view
   Place at: static/js/calendar.js
   Depends on: `dueDates` object injected by the template
=================================================== */

/* dueDates is declared in the template via a <script> block
   so it is available on the global scope by the time this
   external script runs (script tags are evaluated top-to-bottom). */

let currentDate = new Date();
const today     = new Date();

/* ── Build a single priority pill ── */
function buildPill(item) {
    const colorClass =
        item.priority === 'high'   ? 'cal-pill--high'   :
        item.priority === 'medium' ? 'cal-pill--medium'  :
                                     'cal-pill--low';

    const icon = item.type === 'project' ? '📁' : '🔔';

    return `<div class="cal-pill ${colorClass}" title="${item.title}">${icon} ${item.title}</div>`;
}

/* ── Render the full calendar grid ── */
function renderCalendar() {
    const grid  = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById('monthYear').innerText =
        currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    /* Empty leading cells */
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div></div>`;
    }

    /* Day cells */
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday =
            day   === today.getDate()  &&
            month === today.getMonth() &&
            year  === today.getFullYear();

        const mm      = String(month + 1).padStart(2, '0');
        const dd      = String(day).padStart(2, '0');
        const dateKey = `${year}-${mm}-${dd}`;
        const items   = dueDates[dateKey] || [];

        /* First 2 pills always visible */
        let itemsHTML = items.slice(0, 2).map(buildPill).join('');

        /* "+N more" expands remaining items inline */
        if (items.length > 2) {
            const extraHTML = items.slice(2).map(buildPill).join('');
            itemsHTML += `
                <div class="cal-more-toggle"
                     onclick="this.style.display='none';this.nextElementSibling.style.display='block'">
                    +${items.length - 2} more
                </div>
                <div style="display:none">${extraHTML}</div>`;
        }

        /* Determine cell modifier classes */
        const todayClass    = isToday                        ? 'cal-cell--today'     : '';
        const hasItemsClass = items.length > 0 && !isToday  ? 'cal-cell--has-items' : '';

        grid.innerHTML += `
            <div class="cal-cell ${todayClass} ${hasItemsClass}">
                <div class="cal-day-number">${day}</div>
                ${itemsHTML}
            </div>`;
    }
}

/* ── Navigation ── */
function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

/* ── Auto-reload at midnight so "today" stays accurate ── */
setInterval(() => {
    const now = new Date();
    if (now.getDate() !== today.getDate()) {
        location.reload();
    }
}, 60_000);

/* ── Initial render ── */
renderCalendar();