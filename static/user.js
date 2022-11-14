'use strict';

let currentPath = $('body').attr('currentPath') || '/';
let progresses = [];

$(window).on('load', () => {
	if (!localStorage.getItem('guest')) {
		const modal = $('#guest-mode-modal');
		if (modal.length > 0) {
			modal.prop('checked', true);
			localStorage.setItem('guest', true);
		}
	}
});

$('.files').on('load', () => {
	$('.loading').hide();
	$('.filesParent').show();
});

function reloadIframe() {
	$('.files').attr('src', currentPath + '?file=true');
}

function reloadStorage(e) {
	let targetEl = e.currentTarget;
	if (targetEl && !targetEl.matches(':focus'))
		$.post('/storage', (data) => {
			const percentage = data.used / data.total;
			const storagePercentage = $('.storage-percentage');
			storagePercentage.val(percentage);
			if (percentage < 0.8) storagePercentage.addClass('progress-success');
			else if (percentage < 0.9) storagePercentage.addClass('progress-warning');
			else storagePercentage.addClass('progress-error');
			$('.used-storage').text(`${data.used}MB Used`);
			$('.left-storage').text(`${Math.max(data.total - data.used, 0)}MB Left`);
		}).fail(() => alert('There is an error getting storage percentage!'));
}

function hideProgressBar() {
	$('.filesParent').hide();
	$('.loading').show();
}

function logout() {
	$.post('/auth/logout', () => location.reload(true)).fail(() => alert('There is an error logging out!'));
}

function changePassword() {
	$('.loadingOverlay').removeClass('hidden');
	const currentPassword = $('.current-password').val();
	const newPassword = $('.new-password').val();

	$.ajax({
		url: '/account/password',
		method: 'PATCH',
		data: { currentPassword, newPassword },
		error: (error) => {
			$('.change-password-error').text(error.responseText);
			$('.loadingOverlay').addClass('hidden');
		},
		success: () => location.reload(true),
	});
}

function deleteAccount() {
	$('.loadingOverlay').removeClass('hidden');
	$.ajax({
		url: '/account/delete',
		method: 'DELETE',
		error: (error) => {
			$('.delete-account-error').text(error.responseText);
			$('.loadingOverlay').addClass('hidden');
		},
		success: () => location.reload(true),
	});
}

function checkAndCloseDropDown(e) {
	let targetEl = e.currentTarget;
	if (targetEl && targetEl.matches(':focus')) {
		setTimeout(() => {
			targetEl.blur();
		}, 0);
	}
}

function checkAllChanged(event) {
	// check if the checkbox is checked
	if ($(event.target).is(':checked')) {
		// if it is, check all checkboxes
		$('.files').get(0).contentWindow.postMessage({ checkedAll: true }, '*');
	} else {
		// if it isn't, uncheck all checkboxes
		$('.files').get(0).contentWindow.postMessage({ checkedAll: false }, '*');
	}
}

window.parent.onmessage = async (event) => {
	if (typeof event.data === 'string') {
		currentPath = event.data;
		hideProgressBar();
		$('.checkAll').prop('checked', false);
		$('.files').attr('src', event.data + '?file=true');
		$('.dir').append(
			`<li><a onclick="handleDir('${currentPath}')" ondrop="drop(event, '${currentPath}')" ondragover="dragover(event)">${currentPath
				.split('/')
				.pop()}</a></li>`,
		);
	}
	if (event.data?.drag) {
		if (
			Object.keys(event.data).length > 100 &&
			!confirm(
				"You're trying to upload a folder contain more than 100 subfolders in 1 go, server errors might occur. Still continue?",
			)
		)
			return;

		let cacheFolders = {};
		for (const key in event.data) {
			if (key === 'drag' || event.data[key].length === 0) continue;
			// Create all the folders necessary
			const dirs = key.split('/');
			let looped = [];
			for (let i = 0; i < dirs.length; i++) {
				const dir = dirs[i];
				looped.push(dir);
				if (!cacheFolders[i]) cacheFolders[i] = [];
				if (cacheFolders[i].includes(dir)) continue;
				await createFolder(`${currentPath}/${looped.join('/')}`)
					.then(() => {
						cacheFolders[i].push(dir);
					})
					.catch(async (jqXHR) => {
						if (jqXHR.status === 405) cacheFolders[i].push(dir);
						else
							await createFolder(`${currentPath}/${looped.join('/')}`)
								.then(() => {
									cacheFolders[i].push(dir);
								})
								.catch(() => {});
					});
			}
			// Upload files
			uploadFiles(`${currentPath}${key}`, event.data[key]);
		}
		reloadIframe();
	}
	if (event.data?.checkedAll !== undefined) {
		$('.checkAll').prop('checked', event.data.checkedAll);
	}
};

function handleDir(dir) {
	currentPath = dir;
	top.history.pushState(null, null, currentPath);
	hideProgressBar();
	reloadIframe();
	let dirE = $('.dir');
	dirE.empty();
	dirE.append('<input type="checkbox" class="checkAll checkbox mx-4" onchange="checkAllChanged(event);" />');
	dirE.append(`<li><a onclick="handleDir('/')" ondrop="drop(event, '')" ondragover="dragover(event)">Home</a></li>`);
	let folders = [];
	for (let folder of currentPath.split('/')) {
		if (!folder.trim()) continue;
		folders.push(folder);
		dirE.append(
			`<li><a onclick="handleDir('/${folders.join('/')}')" ondrop="drop(event, '${folders.join(
				'/',
			)}')" ondragover="dragover(event)">${folder}</a></li>`,
		);
	}
}

function fileSelector() {
	let input = document.createElement('input');
	input.type = 'file';
	input.multiple = true;
	input.onchange = (e) => {
		uploadFiles(currentPath, e.target.files);
	};
	input.click();
}

function emptyFile() {
	const filename = $('.filename');
	const errorElement = $('.create-file-error');
	if (!filename.val().trim()) return errorElement.text("File name can't be empty!");
	const file = new File([], filename.val());
	uploadFiles(currentPath, [file]);
	$('#create-file-modal').prop('checked', false);
	errorElement.text('');
}
$('#create-file-modal').on('change', (event) => {
	if (event.target.checked) $('.filename').select();
});

$('#create-folder-modal').on('change', (event) => {
	if (event.target.checked) $('.foldername').select();
});

function newFolder() {
	const disallowNames = ['.', '..'];
	const foldername = $('.foldername');
	const errorElement = $('.create-folder-error');
	const value = foldername.val().trim();
	if (!value) return errorElement.text("Folder name can't be empty!");
	if (disallowNames.includes(value)) return errorElement.text('Folder name not allowed!');
	createFolder(`${currentPath}/${value}`)
		.then(() => {
			reloadIframe();
			errorElement.text('');
			$('#create-folder-modal').prop('checked', false);
		})
		.catch((jqXHR) => {
			switch (jqXHR.status) {
				case 405:
					errorElement.text('Unable to create folder: Folder already exists!');
					break;
				case 500:
					errorElement.text('Unable to create folder: Server error occurred, please try again!');
					break;
				default:
					errorElement.text('Unable to create folder: Unknown error occurred, please try again!');
					break;
			}
		});
}

function createFolder(path) {
	return new Promise((success, error) => {
		$.ajax({
			url: '/folder/create',
			method: 'POST',
			data: { path },
			statusCode: {
				401: () => {
					alert("Error creating file: you're not logged in!");
					location.reload(true);
				},
			},
			error,
			success,
		});
	});
}

// Upload
let uploadId = 0;
let uploadFinished = 0;
/** @type {unknown[]} */
let errorQueue = [];
/** @type {{ id: number; file: File; xhr: XMLHttpRequest } | undefined} */
let uploading;
/** @type {{ id: number; path: string; files: File }[]} */
let uploadQueue = [];

$(window).on('beforeunload', () => {
	if (uploading) return 'All uploads will be stopped if you exit now, continue?';
});

function uploadFiles(path, files) {
	const id = uploadId;
	uploadId++;
	const progressBar = $('.uploadDiv');
	if (progressBar.hasClass('hidden')) progressBar.removeClass('hidden');
	// Add element
	$('.uploadList').append(`
		<div id="${id}" class="flex flex-col gap-2 p-4 bg-base-200 rounded-xl">
			<div class="flex justify-between items-center">
				<div>
					<p><span class="font-bold">Path:</span> ${path ? path.replaceAll('//', '/') : '/'}</p>
					<p><span class="font-bold">File names:</span> ${Array.from(files)
						.map((o) => o.name)
						.join(', ')}</p>
				</div>
				<div class="flex flex-row gap-4 justify-between items-center">
					<p class="percentage">0% Completed</p>
					<label class="btn btn-error" onclick="cancelUpload(${id})"><i class="fa-solid fa-xmark"></i></label>
				</div>
			</div>
			<progress class="upload-progress progress progress-info w-full bg-base-500" value="0" max="1"></progress>
		</div>
	`);

	if (uploading) {
		uploadQueue.push({ id, path, files });
	} else {
		startUpload(id, path, files);
	}
}

/**
 * @param {number} id
 * @param {string} path
 * @param {File[]} files
 */
function startUpload(id, path, files) {
	let data = new FormData();
	data.append('path', path);
	data.append(
		'size',
		[...files].reduce((prev, curr) => prev + curr.size, 0),
	);
	for (const file of files) {
		data.append('file', file, encodeURI(file.name));
	}
	uploading = {
		id,
		startTime: Date.now(),
		xhr: $.ajax({
			xhr: function () {
				var xhr = new XMLHttpRequest();
				//Upload progress
				xhr.upload.addEventListener(
					'progress',
					(event) => {
						if (event.lengthComputable) {
							const percent = event.loaded / event.total;
							const totalPercent = Math.round(((percent + uploadFinished) * 100) / uploadId);
							$('.upload-progress').css('--value', `${totalPercent}`);
							$('.uploadDiv').attr('data-tip', `${totalPercent}% Completed`);
							const element = $(`#${uploading.id}`);
							element.find('.upload-progress').attr('value', percent);
							element.find('.percentage').text(`${Math.round(percent * 100)}% Completed`);
						}
					},
					false,
				);
				return xhr;
			},
			url: '/files/upload',
			method: 'POST',
			data,
			contentType: false,
			processData: false,
			statusCode: {
				401: () => {
					alert("Error uploading file: you're not logged in!");
					uploading = undefined;
					location.reload(true);
				},
				405: () => {
					alert('Unable to upload the file(s): Storage is full!');
					emptyUploads();
				},
				500: () => {
					alert('Unable to upload the file: Server error occurred!');
				},
			},
			complete: () => {
				if (uploadQueue.length > 0) {
					$(`#${uploading.id}`).remove();
					uploadFinished++;
					const next = uploadQueue.shift();
					const timeUsed = Date.now() - uploading.startTime;
					setTimeout(() => startUpload(next.id, next.path, next.files), 1000 - timeUsed);
				} else {
					const progressBar = $('.uploadDiv');
					if (!progressBar.hasClass('hidden')) progressBar.addClass('hidden');
					$(`#${uploading.id}`).remove();
					setTimeout(() => $('#upload-files-modal').prop('checked', false), 0);
					uploading = undefined;
					uploadId = 0;
					uploadFinished = 0;
					reloadIframe();
				}
			},
		}),
	};
}

function cancelUpload(id) {
	if (uploading.id === id) uploading.xhr.abort();
	else {
		uploadQueue.splice(
			uploadQueue.findIndex((i) => i.id === id),
			1,
		);
		$(`#${id}`).remove();
	}
}

function emptyUploads() {
	uploadQueue = [];
	if (uploading) uploading.xhr.abort();
	$('.uploadList').empty();
}

// Drag and drop
function dragover(event) {
	event.preventDefault();
	if (event.dataTransfer.types.includes('Files')) return (event.dataTransfer.dropEffect = 'none');
	if (event.ctrlKey) event.dataTransfer.dropEffect = 'copy';
	else event.dataTransfer.dropEffect = 'move';
}

function drop(event, path) {
	event.preventDefault();
	const draggedFilename = event.dataTransfer.getData('filename');
	$('.files').get(0).contentWindow.postMessage('loading', '*');
	event.ctrlKey
		? copyFile(`${currentPath}/${draggedFilename}`, `${path}/${draggedFilename}`)
		: updateFile(`${currentPath}/${draggedFilename}`, `${path}/${draggedFilename}`);
}

function updateFile(oldPath, newPath, force = false) {
	$.ajax({
		url: '/files/update',
		method: 'PUT',
		data: { oldPath, newPath, force },
		statusCode: {
			401: () => {
				alert("Error moving file: you're not logged in!");
				location.reload(true);
			},
			405: () => {
				const input = confirm('This file already exists. Do you want to overwrite it?');
				if (input) updateFile(oldPath, newPath, true);
			},
			500: () => {
				alert('Unable to move this file: Server error occurred!');
			},
		},
		complete: () => reloadIframe(),
	});
}

function copyFile(oldPath, newPath, force = false) {
	$.ajax({
		url: '/files/copy',
		method: 'PUT',
		data: { oldPath, newPath, force },
		statusCode: {
			401: () => {
				alert("Error moving/renaming file: you're not logged in!");
				location.reload(true);
			},
			405: () => {
				const input = confirm('This file already exists. Do you want to overwrite it?');
				if (input) copyFile(oldPath, newPath, true);
			},
			500: () => {
				alert('Unable to copy this file: Server error occurred!');
			},
		},
		complete: () => reloadIframe(),
	});
}
