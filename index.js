const { Client, Databases, Query, ID } = require('node-appwrite');
const nodemailer = require('nodemailer');
const zip = require('express-easy-zip');
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const busboy = require('connect-busboy');
const cheerio = require('cheerio');
const app = express();
const config = require('./config.json');
const iconMapping = require('./iconMapping.json');
const { createHash } = require('crypto');
const SMTPTransport = require('nodemailer/lib/smtp-transport');
const { v4 } = require('uuid');
const domain = 'localhost:3001';
// const domain = 'storage.bill-zhanxg.com';
const port = 3001;

process.on('uncaughtException', (err, origin) => {
	console.log(err);
});

const transporter = nodemailer.createTransport({
	host: 'smtp.office365.com',
	port: 587,
	auth: {
		user: config.email_user,
		pass: config.email_password,
	},
});
/**
 * @param {string} receiver - The email address of the user
 * @param {number} code - The uuid of the document
 * @returns {SMTPTransport.SentMessageInfo}
 */
async function sendMail(receiver, code) {
	const info = await transporter.sendMail({
		from: `Online Storage System <${config.email_user}>`,
		to: receiver,
		subject: 'Verification for Online Storage System',
		text: `Open this link in your browser to validate your account on Online Storage System: https://${domain}/verify?code=${code}`,
		html: `
			<div style="background-color: white;">
				<div
					style="
						background-color: #f3f3f3;
						display: flex;
						align-items: center;
						justify-content: center;
						flex-direction: column;
						padding-bottom: 50px;
						margin: 30px 150px 30px 150px;
					"
				>
					<h1>Online Storage System</h1>
					<div style="background-color: white; display: flex; align-items: center; justify-content: center; padding: 50px; flex-direction: column;">
						<h2>Please validate your email</h2>
						<h5>Click on the link to validate your account on <span style="color: #2354beee;">Online Storage System</span>.<br /><span style="color: red;">NOTE: Please do not share this link with other people!</span></h5>
						<a href="https://${domain}/verify?code=${code}" target="_blank">https://${domain}/verify?code=${code}</a>
						<h5>If you don't recognize this email, just ignore it. No changes have been made to your account!</h5>
					</div>
				</div>
			</div>
		`,
	});

	return new Promise((resolve, reject) => {
		if (info.rejected.length > 0) reject(info);
		resolve(info);
	});
}

const appwrite = new Client()
	.setEndpoint(config.appwrite_endpoint)
	.setProject(config.appwrite_project)
	.setKey(config.appwrite_key);
const database = new Databases(appwrite);

app.use(
	session({
		secret: config.secret,
		resave: false,
		saveUninitialized: true,
	}),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));
app.use(
	busboy({
		highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
	}),
);

const iframeHTML = `
	<head>
		<link rel="stylesheet" href="https://use.fontawesome.com/releases/v6.1.1/css/all.css" />
		<link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
		<script src="https://cdn.tailwindcss.com"></script>
	</head>
	<body ondragover="dragover(event, null)">
		<div class="hidden loadingCopyMove h-full w-full fixed z-10 left-0 top-0 overflow-x-hidden flex justify-center items-center" style="background-color: rgba(0, 0, 0, 0.65)">
			<img src="/loading.gif" alt="funny GIF" width="10%" />
		</div>
		<div onclick="handleFileDragover(false);" ondragleave="handleFileDragover(false);" ondrop="dropFiles(event);" class="hidden fileDragover border-dashed border-[15px] border-blue-500 rounded h-full w-full fixed z-10 left-0 top-0 overflow-x-hidden flex justify-center items-center" style="background-color: rgba(0, 0, 0, 0.65)">
			<h1 class="text-white text-2xl">Drag file(s) here to upload!</h1>
		</div>

		<input type="checkbox" id="rename-file-modal" class="modal-toggle" />
		<label for="rename-file-modal" class="modal cursor-pointer">
			<label class="modal-box relative">
				<h3 class="font-bold text-lg py-4">File Name</h3>
				<input
					type="text"
					placeholder="File path"
					class="filename input input-bordered w-full max-w-xl"
					oldName=""
					onkeypress="if (event.keyCode == 13) { renameFile(); }"
				/>
				<div class="modal-action">
					<label class="btn w-full" onclick="renameFile();">Rename File</label>
				</div>
			</label>
		</label>
		<input type="checkbox" id="move-file-modal" class="modal-toggle" />
		<label for="move-file-modal" class="modal cursor-pointer">
			<label class="modal-box relative">
				<h3 class="font-bold text-lg py-4">New path</h3>
				<input
					type="text"
					placeholder="File path"
					class="pathname input input-bordered w-full max-w-xl"
					value=""
					onkeypress="if (event.keyCode == 13) { bulkMove(); }"
				/>
				<div class="modal-action">
					<label class="btn w-full" onclick="bulkMove();">Bulk Move File</label>
				</div>
			</label>
		</label>

		<div class="filePanel flex flex-col gap-2 mx-8 text-xl"></div>

		<div class="bulkAction fixed bottom-0 left-0 border-4 p-10 hidden">
			<div class="flex flex-row gap-2">
				<label class="btn btn-primary" onclick="bulkDownload();">Download</label>
				<label class="btn btn-primary" for="move-file-modal">Move</label>
				<label class="btn btn-primary" onclick="bulkDelete();">Delete</label>
			</div>
		</div>

		<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
		<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1/jquery-ui.min.js"></script>
		<script src="/fileIframe.js"></script>
	</body>
`;
// TODO ^^ Bulk action styling

app.get('/verify', async (req, res, next) => {
	const code = req.query.code;
	if (req.session.loggedin || code === undefined) return next();

	const documents = await database.listDocuments(
		config.appwrite_database_id,
		config.appwrite_unverified_collection_id,
		[Query.equal('id', code)],
	);

	// TODO: design the html if the code is invalid
	if (documents.total === 0) return res.send(`html`);
	const { $id, email, password } = documents.documents[0];
	const id = (await database.listDocuments(config.appwrite_database_id, config.appwrite_collection_id)).total + 1;
	database.deleteDocument(config.appwrite_database_id, config.appwrite_unverified_collection_id, $id);
	database.createDocument(config.appwrite_database_id, config.appwrite_collection_id, ID.unique(), {
		id,
		email,
		password,
	});
	req.session.loggedin = true;
	req.session.data = { id, email: email, password: password };
	req.session.save();
	res.redirect('/');
	res.end();
});

app.use(zip());
app.get('/download', async (req, res, next) => {
	/**
	 * @type {{
	 * 	root: string;
	 * 	files: string[];
	 * }}
	 */
	let path = req.query.path;
	if (!(req.session.loggedin || path === undefined)) return next();
	try {
		path = JSON.parse(path);
		if (typeof path.root !== 'string') throw new Error('Invalid path');
		if (!(path.files instanceof Array)) throw new Error('Invalid files');
	} catch (err) {
		return res.status(400).end();
	}
	// Check if path is only 1 array and if it is check if it's a file, if it is then download without zip it
	if (path.files.length === 1) {
		const filePath = checkPath(req.session.data.id, path.root, [path.files[0]]);
		if (!fs.existsSync(filePath)) return res.status(404).end();
		let stat = await fs.promises.stat(filePath).catch(() => null);
		if (!stat) res.status(500).end();
		if (req.method === 'HEAD') return res.status(200).end();
		if (stat.isFile()) return res.download(filePath);
	}
	if (req.method === 'HEAD') return res.status(200).end();
	// Download as zip
	res.zip({
		files: path.files.map((p) => {
			const filePath = checkPath(req.session.data.id, path.root, [p]);
			if (!path.files[1]) p = '/';
			return {
				path: filePath,
				name: p,
			};
		}),
		filename: ((path.files[1] && (path.root.split('/').pop() || 'Home')) || path.files[0] || 'attachments') + '.zip',
	});
});

app.get('/signup', (req, res, next) => {
	if (req.session.loggedin || req.query.file) return next();
	res.sendFile(path.join(__dirname + '/views/signup.html'));
});

app.use('/auth', (err, req, res, next) => {
	if (err.type === 'entity.too.large') {
		res.send('Too many characters!');
		res.end();
	} else {
		console.log(err.type);
		next();
	}
});

app.post('/auth', async (req, res) => {
	// Capture the input fields
	let email = req.body.email;
	const password = req.body.password;
	if (email === undefined || password === undefined) return res.status(400).end();
	if (!email.trim() && !password.trim()) {
		req.session.loggedin = true;
		req.session.data = { id: 0, email: null, password: null };
		req.session.save();
		return res.end();
	}
	if (!email.includes('@')) email += '@chairo.vic.edu.au';

	const hash = createHash('sha3-512');
	const hashedPassword = hash.update(password).digest('hex');

	const documents = await database.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
		Query.equal('email', email),
		Query.equal('password', hashedPassword),
	]);

	if (documents.total === 0) {
		const prevDocs = await database.listDocuments(config.appwrite_database_id, config.appwrite_unverified_collection_id, [
			Query.equal('email', email),
		]);
		const send = (text) => res.status(400).send(text).end();
		// TODO: grammar check
		if (prevDocs.total > 0) send('Please verify your account via the email received before you\'re able to use your account. The email may be in your junk folder!');
		else send('Incorrect Email and/or Password!');
		return;
	}
	const user = documents.documents[0];
	req.session.loggedin = true;
	req.session.data = { id: user.id, email: user.email, password: user.password };
	req.session.save();
	res.end();
});

app.post('/signup', async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	let email = req.body.email;
	const password = req.body.password;
	if (email === undefined || password === undefined) return res.status(400).end();
	if (!email.trim() && !password.trim()) return send('Please fill in all fields!');
	email += '@chairo.vic.edu.au';
	// TODO: escape email tag such as: zhanxz+randomtag@chairo.vic.edu.au

	const hash = createHash('sha3-512');
	const hashedPassword = hash.update(password).digest('hex');

	const prevDocs = await database.listDocuments(config.appwrite_database_id, config.appwrite_collection_id);
	const unverifiedDocs = await database.listDocuments(
		config.appwrite_database_id,
		config.appwrite_unverified_collection_id,
		[Query.equal('email', email)],
	);
	if (prevDocs.documents.some((doc) => doc.email === email)) return send('Email already exists!');
	if (unverifiedDocs.total > 0) {
		sendMail(unverifiedDocs.documents[0].email, unverifiedDocs.documents[0].id)
			.then(() => res.status(200).end())
			.catch(() =>
				send('Email already exists, failed to send verification email! Make sure the email you entered is correct!'),
			);
		return;
	}
	const id = v4();
	database.createDocument(config.appwrite_database_id, config.appwrite_unverified_collection_id, ID.unique(), {
		id,
		email,
		password: hashedPassword,
	});
	sendMail(email, id);
	res.status(200).end();
});

// TODO: Signup with SHA3-512 password hashing

app.post('/auth/logout', (req, res) => {
	req.session.destroy();
	res.end();
});

app.post('/account/create', (req, res) => {});

// File API
function checkPath(id, dir, extra = []) {
	if (!fs.existsSync('storedFiles')) fs.mkdirSync('storedFiles');
	let userPath = path.join('storedFiles', `${id}`);
	if (!fs.existsSync(userPath)) fs.mkdirSync(userPath);
	dir = dir || '';
	let unsafePath = path.join(dir, ...extra);
	const safePath = path.join(__dirname, userPath, path.normalize(unsafePath).replace(/^(\.\.(\/|\\|$))+/, ''));
	return safePath;
}

app.get('*', async (req, res) => {
	let file = req.query.file ? true : false;
	// TODO: check if the user is in unverified collection
	if (!req.session.loggedin)
		return file ? res.status(401).end() : res.sendFile(path.join(__dirname + '/views/login.html'));

	let userId = req.session.data.id;
	let dir = req.params[0];

	let folders = [];
	for (let folder of dir.split('/')) {
		if (!folder.trim()) continue;
		folders.push(folder);
	}
	let currentPath = folders.length > 0 ? `/${folders.join('/')}` : '';

	if (file) {
		if (!fs.existsSync(checkPath(userId, dir))) return res.sendFile(path.join(__dirname + '/views/not-found.html'));
		const $ = cheerio.load(iframeHTML);

		if ((await fs.promises.stat(checkPath(userId, dir))).isDirectory()) {
			fs.readdir(checkPath(userId, dir), async (err, files) => {
				if (err) {
					$('.filePanel').append('<h1 class="px-14">An error occurred, please refresh this page!</h1>');
					res.send($.html());
				} else {
					// TODO: Design the Properties menu
					let id = 0;
					function appendElement(filename, size, time, icon, isDirectory) {
						$('.filePanel').append(`
							<div draggable="true" ondragstart="drag(event, '${filename}')" ondragend="delete draggedFileName;" ondrop="drop(event, '${filename}')" ondragover="dragover(event, '${filename}', ${isDirectory})" onclick="intoDir('${currentPath}/${filename}');" oncontextmenu="rightClick('${id}', event);" class="fileitem cursor-pointer flex justify-between items-center bg-base-200 border-[2px] border-base-300 px-4 py-2 rounded-xl">

								<div class="flex justify-start items-center gap-4 overflow-x-auto">
									<input type="checkbox" class="noneClick checkItem checkbox" filename="${filename}" />
									<p class="foldername truncate"><i class="fa-solid fa-${icon} pr-2"></i>${filename}</p>
								</div>

								<div class="flex justify-between items-center gap-4 lg:gap-8">
									${size ? `<p class="whitespace-nowrap">${size}</p>` : ''}
									<p class="truncate">${time}</p>
									<label tabindex="0" class="noneClick btn btn-info m-1" onclick="handleDropDown('${id}')"><i class="fa-solid fa-ellipsis-vertical"></i></label>
								</div>
							</div>
							<ul id="${id}" class="noneClick context-menu menu menu-compact bg-base-200 w-40 p-2 rounded-box absolute hidden">
								<li><a onclick="downloadFile(['${filename}']); closeMenu($('#${id}'));">Download</a></li>
								<li><a onclick="renameFileModal('${filename}'); closeMenu($('#${id}'));">Rename</a></li>
								<li><a onclick="duplicateFile('${filename}', ${isDirectory}); closeMenu($('#${id}'));">Duplicate</a></li>
								<li><a onclick="deleteFile('${filename}'); closeMenu($('#${id}'));">Properties</a></li>
								<li><a class="bg-red-500 text-white hover:bg-red-600 active:bg-red-500" onclick="deleteFile('${filename}'); closeMenu($('#${id}'));">Delete</a></li>
								<li><a onclick="closeMenu($('#${id}'))">Close Menu</a></li>
							</ul>
						`);
						id++;
					}
					for (let file of files) {
						let stat = await fs.promises.stat(checkPath(userId, dir, [file])).catch(() => null);
						if (!stat) continue;
						let size = stat.isDirectory() ? null : stat.size;
						if (size !== null)
							if (size < 1000) size = `${size} Byte${size > 1 ? 's' : ''}`;
							else if (size < 1000000) size = `${Math.round(size / 1000)} KB`;
							else if (size < 1.0e9) size = `${Math.round(size / 1000000)} MB`;
							else if (size < 1.0e12) size = `${Math.round(size / 1.0e9)} GB`;
							else size = `${Math.round(size / 1.0e12)} TB`;
						appendElement(
							file,
							size,
							new Date(stat.mtime).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) +
								', ' +
								new Date(stat.mtime).toLocaleDateString('en-AU'),
							stat.isDirectory() ? 'folder' : iconMapping[path.extname(file).slice(1)] || 'file',
							stat.isDirectory(),
						);
					}
					if (files.length < 1)
						$('.filePanel').append('<h1 class="px-14">There is nothing here! Click "NEW FILE" to create a file!</h1>');
					$('body').attr('currentPath', currentPath);
					$('.pathname').val(currentPath + '/');
					res.send($.html());
				}
			});
		} else {
			// File
			// TODO: error handling
			const fileStream = fs.createReadStream(checkPath(userId, dir));
			fileStream.pipe(res);
		}
	} else {
		let $ = cheerio.load(await fs.promises.readFile(path.join(__dirname + '/views/user.html')));

		let append = [];
		for (let folder of folders) {
			append.push(folder);
			$('.dir').append(
				`<li><a onclick="handleDir('/${append.join('/')}')" ondrop="drop(event, '${append.join(
					'/',
				)}')" ondragover="dragover(event)">${folder}</a></li>`,
			);
		}
		$('body').attr('currentPath', currentPath);
		$('.files').attr('src', `${currentPath ? currentPath : '/'}?file=true`);
		res.send($.html());
	}
});

app.use('*', (req, res, next) => {
	if (!req.session.loggedin) return res.status(401).end();
	res.code = (code) => res.status(code).end();
	next();
});

app.post('/files/upload', (req, res) => {
	// return res.code(500);
	req.pipe(req.busboy); // Pipe it trough busboy

	req.busboy.on('field', (key, value) => {
		req.body[key] = value;
	});

	let files = [];
	/** @type {fs.WriteStream[]} */
	let streams = [];

	req.busboy.on('file', (fieldname, file, info) => {
		let path = req.body.path;
		if (path === undefined) return res.code(400);
		let name = decodeURI(info.filename) || 'New file';
		let filePath = checkPath(req.session.data.id, path, [name]);
		files.push(filePath);
		let stream = fs.createWriteStream(filePath);
		stream.on('error', error);
		streams.push(stream);
		// Pipe it trough
		file.pipe(stream);
	});

	req.socket.on('error', error);

	function error() {
		for (const stream of streams) stream.destroy();
		files.forEach((file) => fs.unlink(file, () => {}));
		res.code(500);
	}

	req.busboy.on('finish', () => {
		streams.forEach((stream) => stream.end());
		res.code(200);
	});
});

app.delete('/files/delete', (req, res) => {
	fs.rm(checkPath(req.session.data.id, req.body.path), { recursive: true }, (err) => {
		if (err) return res.code(500);
		res.code(200);
	});
});

// Update the file name
app.put('/files/update', (req, res) => {
	let oldPath = checkPath(req.session.data.id, req.body.oldPath);
	let newPath = checkPath(req.session.data.id, req.body.newPath);
	if (fs.existsSync(newPath) && req.body.force !== 'true') return res.code(405);

	fs.rename(oldPath, newPath, (err) => {
		if (err) return res.code(500);
		return res.code(200);
	});
});

// Copy a file
app.put('/files/copy', (req, res) => {
	let oldPath = checkPath(req.session.data.id, req.body.oldPath);
	let newPath = checkPath(req.session.data.id, req.body.newPath);
	if (fs.existsSync(newPath) && req.body.force !== 'true') return res.code(405);

	fs.cp(oldPath, newPath, { recursive: true }, (err) => {
		if (err) return res.code(500);
		return res.code(200);
	});
});

app.post('/folder/create', (req, res) => {
	let folderPath = req.body.path;
	if (!folderPath) return res.code(400);
	folderPath = checkPath(req.session.data.id, folderPath);
	if (fs.existsSync(folderPath)) return res.code(405);
	fs.mkdir(folderPath, (err) => {
		if (err) return res.code(500);
		res.code(200);
	});
});

// Update the file content
app.patch('/files/update', (req, res) => {
	let filePath = path.join(checkPath(), req.body.path);

	// fs.rename(oldPath, newPath, (err) => {
	// 	if (err) return res.code(500);
	// 	return res.code(200);
	// });
});

app.listen(port, () => {
	console.log('HTTP Server running on port ' + port);
});

console.log('Server started!');
