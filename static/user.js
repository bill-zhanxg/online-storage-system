function logout() {
    $.post("/auth/logout", () => document.location.reload(true)).fail(() => alert('There is an error logging out!'));
}

$('.noneClick').on('click', event => event.stopPropagation());

function closeDropDown(event) {
    let targetEl = event.currentTarget;
    if (targetEl && targetEl.matches(':focus')) {
        setTimeout(function () {
            targetEl.blur();
        }, 0);
    }
}

function intoDir(folderName) {
    window.location = `${folderName}`;
}

function createFolder() {
    let currentPath = $('body').attr('currentPath') || '';
    newFolder(`${currentPath}/test`);
}

function fileSelector() {
    let input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = e => {
        uploadFile($('body').attr('currentPath') || '', e.target.files);
    }
    input.click();
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

function uploadFile(path, files) {
    let data = new FormData();
    data.append('path', path)
    for (let file of files) {
        console.log(file);
        data.append('file', file);
    }

    $.ajax({
        xhr: function () {
            var xhr = new XMLHttpRequest();
            //Upload progress
            xhr.upload.addEventListener("progress", event => {
                if (event.lengthComputable) {
                    var percentComplete = event.loaded / event.total;
                    //Do something with upload progress
                    console.log(percentComplete);
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
                location.reload(true);
            },
        },
        success: result => {
            // location.reload(true);
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
                location.reload(true);
            },
        },
        success: result => {
            location.reload(true);
        }
    });
}

function deleteFile(file) {
    $.ajax({
        url: '/files/delete',
        method: 'DELETE',
        data: { file: file },
        statusCode: {
            401: () => {
                alert('Error deleting file: you\'re not logged in!');
                location.reload(true);
            },
        },
        success: result => {
            location.reload(true);
        }
    });
}