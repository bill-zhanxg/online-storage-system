let currentPath = $('body').attr('currentPath') || '';
$('.noneClick').on('click', (event) => event.stopPropagation());

let mousePos = { x: -1, y: -1 };
let clientY = -1;
$(document).mousemove(function (event) {
	mousePos.x = event.pageX;
	mousePos.y = event.pageY;
	clientY = event.clientY;
});

// Handle Context Menu
function rightClick(id, event) {
	if (event.button === 2) {
		event.preventDefault();
		handleDropDown(id);
	}
}

async function handleDropDown(id) {
	let dropdown = $(`#${id}`);

	const direction = mousePos.x < window.innerWidth / 2 ? 'left' : 'right';
	dropdown.addClass(direction);

	const height = clientY < window.innerHeight / 2 ? true : false;
	dropdown.css({
		top: height ? mousePos.y + 1 : mousePos.y - 230,
		left: direction === 'left' ? mousePos.x : mousePos.x - 160,
	});

	if (dropdown.hasClass('hidden')) {
		dropdown.show('slide', { direction }, 100);
	} else {
		dropdown.hide('slide', { direction }, 100);
	}
	dropdown.toggleClass('hidden');
}

function closeMenu(menu) {
	const direction = menu.hasClass('left') ? 'left' : 'right';
	menu.hide('slide', { direction }, 100);
	menu.removeClass(direction);
	menu.addClass('hidden');
}

$(document).mousedown((event) => {
	const contextMenus = $('.context-menu');
	for (const contextMenuRaw of contextMenus) {
		const contextMenu = $(contextMenuRaw);
		if (
			!contextMenu.is(event.target) &&
			contextMenu.has(event.target).length === 0 &&
			!contextMenu.hasClass('hidden')
		) {
			closeMenu(contextMenu);
		}
	}
});

function intoDir(folderName) {
	window.parent.postMessage(folderName, '*');
	top.history.pushState(null, null, folderName);
}

window.onmessage = (event) => {
	if (typeof event.data === 'string') $('.loadingCopyMove').removeClass('hidden');
	if (event.data?.checkedAll !== undefined) {
		$('.checkItem').prop('checked', event.data.checkedAll);
		handleCheckboxState();
	}
};

$('.checkItem').on('change', handleCheckboxState);

function handleCheckboxState(event) {
	const checked = $('.checkItem:checked');
	const bulkAction = $('.bulkAction');
	if (checked.length === 0) {
		bulkAction.addClass('hidden');
	} else {
		bulkAction.removeClass('hidden');
	}
	if (event) {
		if ($('.checkItem').length === checked.length) window.parent.postMessage({ checkedAll: true }, '*');
		else window.parent.postMessage({ checkedAll: false }, '*');
	}
}

function selectChange() {}

let draggedFileName;
function drag(event, filename) {
	draggedFileName = filename;
	event.dataTransfer.setData('filename', filename);
}

function handleFileDragover(isOpen) {
	const fileDragover = $('.fileDragover');
	if (isOpen) fileDragover.removeClass('hidden');
	else fileDragover.addClass('hidden');
}

function dragover(event, filename, isDirectory) {
	event.preventDefault();
	if (event.dataTransfer.types.includes('Files')) handleFileDragover(true);
	else {
		const target = event.target;
		if (filename === null) {
			if ($(target).is('body') || $(target).hasClass('filePanel')) event.dataTransfer.dropEffect = 'none';
			return;
		}
		if (!isDirectory || filename === draggedFileName) event.dataTransfer.dropEffect = 'none';
		else if (event.ctrlKey) event.dataTransfer.dropEffect = 'copy';
		else event.dataTransfer.dropEffect = 'move';
	}
}

function drop(event, filename) {
	event.preventDefault();
	if (event.dataTransfer.types.includes('Files') || !event.dataTransfer.getData('filename').trim()) return;
	const draggedFilename = event.dataTransfer.getData('filename');
	$('.loadingCopyMove').removeClass('hidden');
	event.ctrlKey
		? copyFile(`${currentPath}/${draggedFilename}`, `${currentPath}/${filename}/${draggedFilename}`)
		: updateFile(`${currentPath}/${draggedFilename}`, `${currentPath}/${filename}/${draggedFilename}`);
}

async function dropFiles(event) {
	event.preventDefault();
	handleFileDragover(false);
	$('.loadingCopyMove').removeClass('hidden');

	/** @typedef {{ path: string; fileSystemEntry: FileSystemEntry }} FileEntry */
	/**
	 * @param {DataTransferItem[]} dataTransferItemList
	 * @returns {Promise<{ [key: string]: File[] }>}
	 */
	async function getAllFileEntries(dataTransferItemList) {
		let fileEntries = { '/': [] };
		/** @type {FileEntry[]} */
		let queue = [];
		for (let i = 0; i < dataTransferItemList.length; i++) {
			const fileSystemEntry = dataTransferItemList[i].webkitGetAsEntry();
			queue.push({ path: fileSystemEntry.isFile ? '/' : '', fileSystemEntry });
		}
		while (queue.length > 0) {
			let fileEntry = queue.shift();
			if (fileEntry.fileSystemEntry.isFile) {
				// Handle File here
				if (!fileEntries.hasOwnProperty(fileEntry.path)) fileEntries[fileEntry.path] = [];
				fileEntries[fileEntry.path].push(await getFile(fileEntry.fileSystemEntry));
			} else if (fileEntry.fileSystemEntry.isDirectory) {
				// Handle folder here
				const newFileEntry = await readAllDirectoryEntries(fileEntry);
				queue.push(...newFileEntry);
			}
		}
		return fileEntries;
	}
	/**
	 * @param {{ path: string; fileSystemEntry: FileSystemDirectoryEntry }} fileEntry
	 * @returns {Promise<FileEntry[]>}
	 */
	async function readAllDirectoryEntries(fileEntry) {
		const path = `${fileEntry.path}/${fileEntry.fileSystemEntry.name}`;
		const directoryReader = fileEntry.fileSystemEntry.createReader();
		const readEntries = await readEntriesPromise(directoryReader)
			.then((fileEntryArray) => {
				let entries = [];
				fileEntryArray.forEach((fileEntry) => {
					entries.push({ path: path, fileSystemEntry: fileEntry });
				});
				return entries;
			})
			.catch(() => []);
		return readEntries;
	}
	/**
	 * @param {FileSystemDirectoryReader} directoryReader
	 * @returns {Promise<FileSystemEntry[], Error>}
	 */
	function readEntriesPromise(directoryReader) {
		return new Promise((resolve, reject) => {
			directoryReader.readEntries(resolve, reject);
		});
	}
	/**
	 * @param {FileSystemFileEntry} fileEntry
	 * @returns {Promise<File, Error>}
	 */
	function getFile(fileEntry) {
		return new Promise((resolve, reject) => {
			fileEntry.file(resolve, reject);
		});
	}

	let items = event.dataTransfer.items;
	window.parent.postMessage({ drag: true, ...(await getAllFileEntries(items)) }, '*');
	// window.parent.postMessage(event.dataTransfer.files, '*');
	$('.loadingCopyMove').addClass('hidden');
}

/**
 * @param {string} path
 * @returns {string}
 */
function insertBeforeExtension(path, insert, ignoreExtension = false) {
	// check if ignoreExtension is true
	console.log(path + insert);
	if (ignoreExtension) return path + insert;
	// Get the filename
	const filename = path.split('/').pop();
	// Get the other half of the path
	const pathWithoutFilename = path.substring(0, path.length - filename.length);
	// Get the extension
	const extension = filename.split('.').pop();
	// Get the filename without the extension
	const filenameWithoutExtension = filename.substring(0, filename.length - extension.length - 1);
	// Check if the filename has an extension
	if (filenameWithoutExtension === '') return path + insert;
	// Return the new path
	return `${pathWithoutFilename}${filenameWithoutExtension}${insert}.${extension}`;
}

function updateFile(oldPath, newPath, force = false, reload = true) {
	$.ajax({
		url: '/files/update',
		method: 'PUT',
		data: { oldPath, newPath, force },
		statusCode: {
			401: () => {
				alert("Error moving file: you're not logged in!");
				parent.location.reload(true);
			},
			405: () => {
				if (confirm('This file already exists. Do you want to overwrite it?')) updateFile(oldPath, newPath, true);
			},
			500: () => {
				reload && alert('Unable to move this file: Server error occurred!');
			},
		},
		complete: () => reload && location.reload(),
	});
}

function copyFile(oldPath, newPath, force = false, dupe = false, ignoreExtension, times = 0) {
	$.ajax({
		url: '/files/copy',
		method: 'PUT',
		data: {
			oldPath,
			newPath: dupe && times !== 0 ? insertBeforeExtension(newPath, ` (${times})`, ignoreExtension) : newPath,
			force,
		},
		statusCode: {
			401: () => {
				alert("Error copying file: you're not logged in!");
				parent.location.reload(true);
			},
			405: () => {
				if (dupe) copyFile(oldPath, newPath, force, dupe, ignoreExtension, times + 1);
				else if (confirm('This file already exists. Do you want to overwrite it?')) copyFile(oldPath, newPath, true);
			},
			500: () => {
				alert('Unable to copy this file: Server error occurred!');
			},
		},
		complete: () => location.reload(),
	});
}

function deleteFile(filename, reload = true) {
	reload && $('.loadingCopyMove').removeClass('hidden');
	$.ajax({
		url: '/files/delete',
		method: 'DELETE',
		data: { path: `${currentPath}/${filename}` },
		statusCode: {
			401: () => {
				alert("Error deleting file: you're not logged in!");
				parent.location.reload(true);
			},
			500: () => {
				reload && alert('Unable to delete this file: Server error occurred!');
			},
		},
		complete: () => reload && location.reload(),
	});
}

function renameFileModal(filename) {
	const fileInput = $('.filename');
	fileInput.attr('oldName', filename);
	fileInput.val(`${currentPath}/${filename}`.replaceAll('//', '/').substring(1));
	$('#rename-file-modal').prop('checked', true);
	fileInput.focus();
}
function renameFile() {
	$('.loadingCopyMove').removeClass('hidden');
	const fileInput = $('.filename');
	updateFile(`${currentPath}/${fileInput.attr('oldName')}`, `${fileInput.val()}`);
}

function duplicateFile(filename, ignoreExtension) {
	$('.loadingCopyMove').removeClass('hidden');
	copyFile(
		`${currentPath}/${filename}`,
		`${currentPath}/${insertBeforeExtension(filename, ' Copy', ignoreExtension)}`,
		false,
		true,
		ignoreExtension,
	);
}

function downloadSingleFile(filename) {
	location.href = filename + '?file=true';
}

function downloadFile(filenames) {
	const loading = $('.loadingCopyMove');
	loading.removeClass('hidden');
	const URL = `/download?path={"root":"${currentPath}","files":[${filenames
		.map((filename) => `"${filename}"`)
		.join(',')}]}`;
	fetch(URL, { method: 'HEAD' }).then((response) => {
		switch (response.status) {
			case 200:
				location.href = URL;
				break;
			case 401:
				alert("Error downloading file: you're not logged in!");
				parent.location.reload(true);
				break;
			case 404:
				alert('Unable to download this file: File not found!');
				location.reload();
				break;
			case 500:
				alert('Unable to download this file: Server error occurred!');
				break;
			default:
				alert('Unable to download this file: Unknown error occurred!');
				break;
		}
		loading.addClass('hidden');
	});
}

function getALlSelectedName() {
	let paths = [];
	$('.checkItem:checked').each((i, e) => paths.push($(e).attr('filename')));
	return paths;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bulkDownload = () => downloadFile(getALlSelectedName());
async function bulkMove() {
	$('.loadingCopyMove').removeClass('hidden');
	$('#move-file-modal').prop('checked', false);
	const newPath = $('.pathname').val();
	for (const name of getALlSelectedName()) {
		updateFile(`${currentPath}/${name}`, `${newPath}/${name}`, true, false);
		await wait(100);
	}
	location.reload();
}

async function bulkDelete() {
	$('.loadingCopyMove').removeClass('hidden');
	const names = getALlSelectedName();
	if (!confirm(`Are you sure you want to delete ${names.length} files?`)) return $('.loadingCopyMove').addClass('hidden');;
	for (const name of names) {
		deleteFile(name, false);
		await wait(100);
	}
	location.reload();
}