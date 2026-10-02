/* ===================================================
   project_form.js  –  UI logic for the project form page
   Place at: static/js/project_form.js
=================================================== */

/* ── Date validation: enforce today as min, keep due >= start ── */
(function () {
    var today     = new Date().toISOString().split('T')[0];
    var startDate = document.querySelector('input[name="start_date"]');
    var dueDate   = document.querySelector('input[name="due_date"]');

    if (startDate) {
        startDate.setAttribute('min', today);
        startDate.addEventListener('change', function () {
            if (dueDate) {
                dueDate.setAttribute('min', this.value || today);
                if (dueDate.value && dueDate.value < this.value) {
                    dueDate.value = '';
                }
            }
        });
    }

    if (dueDate) {
        dueDate.setAttribute('min', today);
    }
})();


/* ── Multi-file upload with remove support ── */
var selectedFiles = [];

function onFilesSelected(input) {
    for (var i = 0; i < input.files.length; i++) {
        selectedFiles.push(input.files[i]);
    }
    renderFileList();
    syncInputFiles();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    syncInputFiles();
    renderFileList();
}

function syncInputFiles() {
    var dt = new DataTransfer();
    selectedFiles.forEach(function (f) { dt.items.add(f); });
    document.getElementById('doc-upload').files = dt.files;
}

function renderFileList() {
    var list = document.getElementById('file-list');
    list.innerHTML = '';
    selectedFiles.forEach(function (file, index) {
        var li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML =
            '<span>📄 ' + file.name + '</span>' +
            '<button type="button" onclick="removeFile(' + index + ')">✕ Remove</button>';
        list.appendChild(li);
    });
}
