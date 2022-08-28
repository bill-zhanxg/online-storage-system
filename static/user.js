let currentPath = $('body').attr('currentPath') || '/';
const progress = [];

$('.files').on('load', () => {
    $('.loading').hide();
    $('.files').show();
});

function hideProgressBar() {
    $('.files').hide();
    $('.loading').show();
}

function logout() {
    $.post("/auth/logout", () => document.location.reload(true)).fail(() => alert('There is an error logging out!'));
}

window.parent.onmessage = event => {
    if (typeof (event.data) !== 'string') return;
    currentPath = event.data;
    hideProgressBar();
    $('.files').attr('src', event.data + '?file=true');
    $('.dir').append(`<li><a onclick="handleDir('${currentPath}')">${currentPath.split('/').pop()}</a></li>`)
}

function handleDir(dir) {
    currentPath = dir;
    top.history.pushState(null, null, currentPath);
    hideProgressBar();
    $('.files').attr('src', currentPath + '?file=true');
    let dirE = $('.dir');
    dirE.empty();
    dirE.append('<input type="checkbox" class="checkbox mx-4" />');
    dirE.append('<li><a onclick="handleDir(\'/\')">Home</a></li>');
    let folders = [];
    for (let folder of currentPath.split('/')) {
        if (!folder.trim()) continue;
        folders.push(folder);
        dirE.append(`<li><a onclick="handleDir(\'/${folders.join('/')}\')">${folder}</a></li>`)
    }
}

function createFolder() {
    newFolder(`${currentPath}/test`);
}

function fileSelector() {
    let input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = e => {
        uploadFile(currentPath, e.target.files);
    }
    input.click();
}

function testDelete() {
    deleteFile(`${currentPath}/test`);
}

function newFolder(path) {
    $.ajax({
        url: '/folder/create',
        method: 'POST',
        data: { path: path },
        statusCode: {
            401: () => {
                alert('Error creating file: you\'re not logged in!');
                location.reload(true);
            },
        },
        success: () => {
            location.reload(true);
        }
    });
}

function updateProgress() {
    let progressBar = $('.uploadDiv');
    if (progress.length === 0) return progressBar.addClass('hidden');
    if (progressBar.hasClass('hidden')) progressBar.removeClass('hidden');
    const percent = Math.round(progress.reduce((a, b) => a + b, 0) * 100 / progress.length);
    progressBar.attr('data-tip', `${percent}% Complete`);
    $('.upload-progress').css('--value', `${percent}`);
}

function uploadFile(path, files) {
    let data = new FormData();
    data.append('path', path);
    for (let file of files) {
        console.log(file);
        data.append('file', file);
    }

    let arrayIndex = progress.length;
    progress[arrayIndex] = 0;

    $.ajax({
        xhr: function () {
            var xhr = new XMLHttpRequest();
            //Upload progress
            xhr.upload.addEventListener("progress", event => {
                if (event.lengthComputable) {
                    progress[arrayIndex] = event.loaded / event.total;
                    updateProgress();
                }
            }, false);
            return xhr;
        },
        url: '/files/upload',
        method: 'POST',
        data: data,
        contentType: false,
        processData: false,
        statusCode: {
            401: () => {
                alert('Error uploading file: you\'re not logged in!');
            },
            500: () => {
                alert('Unable to uploade this file: Server error occurred!');
            },
        },
        complete: () => {
            location.reload(true);
        },
        finally: () => {
            progress.splice(arrayIndex, 1);
            updateProgress();
        }
    });
}

function updateFile(prevLocation, location) {
    $.ajax({
        url: '/files/update',
        method: 'PUT',
        data: { prevLocation: prevLocation, location: location },
        statusCode: {
            401: () => {
                alert('Error moving/renaming file: you\'re not logged in!');
            },
        },
        complete: () => {
            location.reload(true);
        }
    });
}

function deleteFile(path) {
    $.ajax({
        url: '/files/delete',
        method: 'DELETE',
        data: { path: path },
        statusCode: {
            401: () => {
                alert('Error deleting file: you\'re not logged in!');
            },
            500: () => {
                alert('Unable to delete this file: Server error occurred!');
            },
        },
        complete: () => {
            location.reload(true);
        }
    });
}