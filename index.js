'use strict';

const { Client, Databases, Query, ID } = require('node-appwrite');
const nodemailer = require('nodemailer');
const zip = require('express-easy-zip');
const express = require('express');
const session = require('express-session');
const sessionstore = require('sessionstore');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const busboy = require('connect-busboy');
const cheerio = require('cheerio');
const fastFolderSize = require('util').promisify(require('fast-folder-size'));
const app = express();
const util = require('./util');
const config = require('./config.json');
const iconMapping = require('./iconMapping.json');
const { createHash } = require('crypto');
const SMTPTransport = require('nodemailer/lib/smtp-transport');
const { v4 } = require('uuid');
const port = 3001;
// const domain = `localhost:${port}`;
const domain = 'storage.bill-zhanxg.com';

process.on('uncaughtException', (err, origin) => {
	console.log(err);
});

// Cache HTMLs
const HTMLs = {
	admin: fs.readFileSync(path.join(__dirname + '/views/admin.html')),
	iframe: fs.readFileSync(path.join(__dirname + '/views/iframe.html')),
	login: fs.readFileSync(path.join(__dirname + '/views/login.html')),
	notFound: fs.readFileSync(path.join(__dirname + '/views/not-found.html')),
	passwordReset: fs.readFileSync(path.join(__dirname + '/views/password-reset.html')),
	reset: fs.readFileSync(path.join(__dirname + '/views/reset.html')),
	signup: fs.readFileSync(path.join(__dirname + '/views/signup.html')),
	user: fs.readFileSync(path.join(__dirname + '/views/user.html')),
};

const transporter = nodemailer.createTransport({
	host: config.smtp_host,
	port: config.smtp_port,
	auth: {
		user: config.email_user,
		pass: config.email_password,
	},
});
/**
 * @param {string} receiver - The email address of the user
 * @param {string} code - The uuid of the document
 * @returns {SMTPTransport.SentMessageInfo}
 */
async function sendMail(receiver, code, verify = true) {
	const info = await transporter.sendMail({
		from: `Online Storage System <${config.email_user}>`,
		to: receiver,
		subject: `${verify ? 'Verification' : 'Password reset'} for Online Storage System`,
		text: `${
			verify
				? 'Open this link in your browser to validate your account on Online Storage System'
				: 'Open this link in your browser to reset your password'
		}: https://${domain}/verify?code=${code}`,
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
						<h2>${verify ? 'Please validate your email' : 'Password reset'}</h2>
						<h5>Click on the link to ${
							verify ? 'validate your account' : 'reset your password'
						} on <span style="color: #2354beee;">Online Storage System</span>.<br /><span style="color: red;">NOTE: Please do not share this link with other people!</span></h5>
						<a href="https://${domain}/${verify ? 'verify' : 'password-reset'}?code=${code}" target="_blank">https://${domain}/${
			verify ? 'verify' : 'password-reset'
		}?code=${code}</a>
						<h5>If you don't recognize this email, please ignore it. No changes have been made to your account!</h5>
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
const databases = new Databases(appwrite);

const ss = sessionstore.createSessionStore();
app.use(
	session({
		secret: config.secret,
		resave: false,
		saveUninitialized: true,
		store: ss,
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

app.get('/verify', async (req, res, next) => {
	const code = req.query.code;
	// Check if bing bot is trying to get embed
	if (req.session.loggedin || code === undefined || req.headers.accept === '*/*') return next();

	const documents = await databases.listDocuments(
		config.appwrite_database_id,
		config.appwrite_unverified_collection_id,
		[Query.equal('id', code)],
	);

	if (documents.total < 1)
		return res.setHeader('content-type', 'text/html; charset=UTF-8').send(`
			<link rel="stylesheet" href="https://use.fontawesome.com/releases/v6.1.1/css/all.css" />
			<script src="https://cdn.tailwindcss.com"></script>
			<link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" />
			<body>
				<div class="flex flex-col justify-center items-center h-[100vh]">
					<div class="text-center bg-base-200 py-8 px-12 rounded-xl">
						<p class="text-5xl font-bold">
							<i class="fa-solid fa-triangle-exclamation"></i> 405 <i class="fa-solid fa-triangle-exclamation"></i>
						</p>
						<p class="text-3xl">Invalid Code</p>
						<b>Think it's an error? <a
							class="text-blue-300 underline"
							href="/"
							rel="noopener"
							target="_blank"
							>Login now!</a>
						</b>
					</div>
				</div>
			</body>
	`);
	const { $id, email, password } = documents.documents[0];
	const id =
		(await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id)).documents.pop()?.id +
			1 || 1;
	databases.deleteDocument(config.appwrite_database_id, config.appwrite_unverified_collection_id, $id);
	databases.createDocument(config.appwrite_database_id, config.appwrite_collection_id, ID.unique(), {
		id,
		email,
		password,
	});
	req.session.loggedin = true;
	req.session.data = { id, email, password };
	req.session.save();
	res.redirect('/');
});

// Serve Static HTML
app.get('/password-reset', async (req, res, next) => {
	if (req.session.loggedin || !req.query.code || req.headers.accept === '*/*') return next();
	res.setHeader('content-type', 'text/html; charset=UTF-8').send(HTMLs.passwordReset);
});

// Send Email
app.post('/password-reset', async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	let email = req.body.email;
	if (!email) return send('Please fill the email field before reset password!');
	if (!email.includes('@')) email += '@chairo.vic.edu.au';
	const docs = await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
		Query.equal('email', email),
	]);
	if (docs.total < 1) return send("The email you have entered isn't in the database!");
	const { $id } = docs.documents[0];
	const result = await databases
		.createDocument(config.appwrite_database_id, config.appwrite_password_reset_collection_id, $id, {
			code: v4(),
		})
		.catch(async (err) => {
			if (err.type !== 'document_already_exists') return err.message;
			else {
				const docs = await databases.listDocuments(
					config.appwrite_database_id,
					config.appwrite_password_reset_collection_id,
					[Query.equal('$id', $id)],
				);
				return docs.documents[0];
			}
		});
	if (typeof result === 'string') return send(result);
	sendMail(email, result.code, false)
		.then(() => send('Please reset your password via the email received.\nThe email will most likely be in your junk folder\nand it may take more than 1 minute for the email to arrive!'))
		.catch(() => send('Failed to send verification email!\nMake sure the email you entered is correct!'));
});

// Reset Password
app.patch('/password-reset', async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	// Check if the code exist in the database
	const code = req.body.code;
	let password = req.body.password;
	if (!code) return send('Please do not open this page as a saved HTML page! (Can not find code query in URL)');
	if (!password) return send('The password field can not be empty!');
	const resetDocs = await databases.listDocuments(
		config.appwrite_database_id,
		config.appwrite_password_reset_collection_id,
		[Query.equal('code', code)],
	);
	if (resetDocs.total < 1) return send("The code doesn't exist in the database!");
	await databases.deleteDocument(
		config.appwrite_database_id,
		config.appwrite_password_reset_collection_id,
		resetDocs.documents[0].$id,
	);
	databases
		.updateDocument(config.appwrite_database_id, config.appwrite_collection_id, resetDocs.documents[0].$id, {
			password: createHash('sha3-512').update(password).digest('hex'),
		})
		.then(() => res.sendStatus(200))
		.catch(() => send('Can not find the account associate with the code! Try </signup, create a new one>?'));
});

app.get('/reset', async (req, res, next) => {
	if (req.session.loggedin) return next();
	res.setHeader('content-type', 'text/html; charset=UTF-8').send(HTMLs.reset);
});

app.delete('/account/reset', async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	const email = req.body.email;
	if (!email) return send('Please fill in all fields!');
	const docs = await databases.listDocuments(config.appwrite_database_id, config.appwrite_unverified_collection_id, [
		Query.equal('email', email),
	]);
	if (docs.total < 1) return send('Email does not exist in the database, maybe try </signup, create an account>?');
	await databases.deleteDocument(
		config.appwrite_database_id,
		config.appwrite_unverified_collection_id,
		docs.documents[0].$id,
	);
	res.sendStatus(200);
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
		return res.sendStatus(400);
	}
	// Check if path is only 1 array and if it is check if it's a file, if it is then download without zip it
	if (path.files.length === 1) {
		const filePath = checkPath(req.session.data.id, path.root, [path.files[0]]);
		if (!fs.existsSync(filePath)) return res.sendStatus(404);
		let stat = await fs.promises.stat(filePath).catch(() => null);
		if (!stat) res.sendStatus(500);
		if (req.method === 'HEAD') return res.sendStatus(200);
		if (stat.isFile()) return res.download(filePath);
	}
	if (req.method === 'HEAD') return res.sendStatus(200);
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
	res.setHeader('content-type', 'text/html; charset=UTF-8').send(HTMLs.signup);
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

const apiRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 5 * 60, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headersD
});
const authRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 5 * 60 * 10, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headersD
});

app.post('/auth', authRateLimit, async (req, res) => {
	// Capture the input fields
	let email = req.body.email;
	const password = req.body.password;
	if (email === undefined || password === undefined) return res.sendStatus(400);
	if (!email.trim() && !password.trim()) {
		req.session.loggedin = true;
		req.session.data = { id: 0, email: 'guest@mail.com', password: null };
		req.session.save();
		return res.end();
	}
	if (!email.includes('@')) email += '@chairo.vic.edu.au';

	const hashedPassword = createHash('sha3-512').update(password).digest('hex');

	const documents = await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
		Query.equal('email', email),
		Query.equal('password', hashedPassword),
	]);

	if (documents.total === 0) {
		const prevDocs = await databases.listDocuments(
			config.appwrite_database_id,
			config.appwrite_unverified_collection_id,
			[Query.equal('email', email)],
		);
		const send = (text) => res.status(400).send(text).end();
		if (prevDocs.total > 0)
			send(
				'Please verify your account via the email received to activate your\naccount. The email will most likely be in your junk folder\nand it may take more than 1 minute for the email to arrive!',
			);
		else send('Incorrect Email and/or Password! Try <reset password>!');
		return;
	}
	const user = documents.documents[0];
	req.session.loggedin = true;
	req.session.data = { id: user.id, email: user.email, password: user.password };
	req.session.save();
	res.end();
});

app.post('/signup', authRateLimit, async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	let email = req.body.email;
	const password = req.body.password;
	if (email === undefined || password === undefined) return res.sendStatus(400);
	if (!email.trim() && !password.trim()) return send('Please fill in all fields!');
	if (email.includes('@')) {
		const domain = email.split('@').pop();
		if (domain !== 'chairo.vic.edu.au') return send('Only Chairo emails are supported at this time!');
	} else email += '@chairo.vic.edu.au';
	if (email.includes('+')) email = email.substring(0, email.indexOf('+'));

	const hashedPassword = createHash('sha3-512').update(password).digest('hex');

	const prevDocs = await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id);
	const unverifiedDocs = await databases.listDocuments(
		config.appwrite_database_id,
		config.appwrite_unverified_collection_id,
		[Query.equal('email', email)],
	);
	if (prevDocs.documents.some((doc) => doc.email === email)) return send('Email already exists! Try </, logging in>!');
	if (unverifiedDocs.total > 0) {
		sendMail(unverifiedDocs.documents[0].email, unverifiedDocs.documents[0].id)
			.then(() =>
				send(
					'Please verify your account via the email received to activate your\naccount. The email will most likely be in your junk folder and\nit may take more than 1 minute for the email to arrive!\nSomeone else used this email? </reset, Reset your account!>',
				),
			)
			.catch(() =>
				send(
					'Email already exists, failed to send verification email!\nMake sure the email you entered is correct!\nSomeone else used this email? </reset, Reset your account!>',
				),
			);
		return;
	}
	const id = v4();
	databases.createDocument(config.appwrite_database_id, config.appwrite_unverified_collection_id, ID.unique(), {
		id,
		email,
		password: hashedPassword,
	});
	sendMail(email, id);
	res.sendStatus(200);
});

app.post('/auth/logout', authRateLimit, (req, res) => {
	req.session.destroy();
	res.end();
});

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
	if (!req.session.loggedin)
		return file ? res.sendStatus(401) : res.setHeader('content-type', 'text/html; charset=UTF-8').send(HTMLs.login);

	let userId = req.session.data.id;
	let dir = req.params[0];

	let folders = [];
	for (let folder of dir.split('/')) {
		if (!folder.trim()) continue;
		folders.push(folder);
	}
	let currentPath = folders.length > 0 ? `/${folders.join('/')}` : '';

	if (file) {
		if (!fs.existsSync(checkPath(userId, dir)))
			return res.setHeader('content-type', 'text/html; charset=UTF-8').send(HTMLs.notFound);
		const $ = cheerio.load(HTMLs.iframe);

		if ((await fs.promises.stat(checkPath(userId, dir))).isDirectory()) {
			fs.readdir(checkPath(userId, dir), async (err, files) => {
				if (err) {
					$('.filePanel').append('<h1 class="px-14">An error occurred, please refresh this page!</h1>');
					res.setHeader('content-type', 'text/html; charset=UTF-8').send($.html());
				} else {
					let id = 0;
					function appendElement(filename, size, icon, isDirectory, dir, creationTime, lastModifiedTime, accessTime) {
						const filePath = `${currentPath}/${filename}`;
						$('.filePanel').append(`
							<div draggable="true" ondragstart="drag(event, '${filename}')" ondragend="delete draggedFileName;" ondrop="drop(event, '${filename}')" ondragover="dragover(event, '${filename}', ${isDirectory})" onclick="${
							isDirectory ? `intoDir('${filePath}')` : `downloadSingleFile('${filePath}')`
						};" oncontextmenu="rightClick('${id}', event);" class="fileitem cursor-pointer flex justify-between items-center bg-base-200 border-[2px] border-base-300 px-4 py-2 rounded-xl">

								<div class="flex justify-start items-center gap-4 overflow-x-auto">
									<input type="checkbox" class="noneClick checkItem checkbox" filename="${filename}" />
									<p class="foldername truncate"><i class="fa-solid fa-${icon} pr-2"></i>${filename}</p>
								</div>

								<div class="flex justify-between items-center gap-4 lg:gap-8">
									${size ? `<p class="whitespace-nowrap">${size}</p>` : ''}
									<p class="truncate">${lastModifiedTime}</p>
									<label tabindex="0" class="noneClick btn btn-info m-1" onclick="handleDropDown('${id}')"><i class="fa-solid fa-ellipsis-vertical"></i></label>
								</div>
							</div>
							<ul id="${id}" class="noneClick context-menu menu menu-compact bg-base-200 w-40 p-2 rounded-box absolute hidden">
								<li><a onclick="downloadFile(['${filename}']); closeMenu($('#${id}'));">Download</a></li>
								<li><a onclick="renameFileModal('${filename}'); closeMenu($('#${id}'));">Move/Rename</a></li>
								<li><a onclick="duplicateFile('${filename}', ${isDirectory}); closeMenu($('#${id}'));">Duplicate</a></li>
								<li><label for="props-file-modal-${id}" onclick="closeMenu($('#${id}'));">Properties</label></li>
								<li><a class="bg-red-500 text-white hover:bg-red-600 active:bg-red-500" onclick="deleteFile('${filename}'); closeMenu($('#${id}'));">Delete</a></li>
								<li><a onclick="closeMenu($('#${id}'))">Close Menu</a></li>
							</ul>

							<input type="checkbox" id="props-file-modal-${id}" class="modal-toggle" />
							<label for="props-file-modal-${id}" class="modal cursor-pointer">
								<label class="modal-box relative">
									<div class="grid grid-cols-3">
										<div class="col-span-1">
											<h3 class="text-lg pb-4">Name: </h3>
											<hr/>
											<h3 class="text-lg pt-4">Location: </h3>
											<h3 class="text-lg pb-4">Size: </h3>
											<hr/>
											<h3 class="text-lg pt-4">Creation At: </h3>
											<h3 class="text-lg">Last Modify At: </h3>
											<h3 class="text-lg">Last Access At: </h3>
										</div>
										<div class="col-span-2">
											<h3 class="text-lg pb-4">${filename}</h3>
											<hr/>
											<h3 class="text-lg pt-4">${dir}</h3>
											<h3 class="text-lg pb-4">${size}</h3>
											<hr/>
											<h3 class="text-lg pt-4">${creationTime}</h3>
											<h3 class="text-lg">${lastModifiedTime}</h3>
											<h3 class="text-lg">${accessTime}</h3>
										</div>
									</div>
									<div class="modal-action">
										<label class="btn w-full" for="props-file-modal-${id}">Close</label>
									</div>
								</label>
							</label>
						`);
						id++;
					}
					for (let file of files) {
						let stat = await fs.promises.stat(checkPath(userId, dir, [file])).catch(() => null);
						if (!stat) continue;
						let size = stat.isDirectory() ? await fastFolderSize(checkPath(userId, dir, [file])) : stat.size;
						if (size !== null) size = util.formatBytes(size);
						appendElement(
							file,
							size,
							stat.isDirectory() ? 'folder' : iconMapping[path.extname(file).slice(1)] || 'file',
							stat.isDirectory(),
							'Home' + path.join(dir, file),
							util.formatDate(stat.birthtime),
							util.formatDate(stat.mtime),
							util.formatDate(stat.atime),
						);
					}
					if (files.length < 1)
						$('.filePanel').append('<h1 class="px-14">There is nothing here! Click "NEW FILE" to create a file!</h1>');
					$('body').attr('currentPath', currentPath);
					$('.pathname').val(currentPath + '/');
					res.setHeader('content-type', 'text/html; charset=UTF-8').send($.html());
				}
			});
		} else {
			// Files
			res.download(checkPath(userId, dir));
		}
	} else {
		let $ = cheerio.load(HTMLs.user);

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
		$('.email').text(req.session.data.email.toUpperCase());
		if (req.session.data.id === 0) {
			$('.guest-disable-btn').addClass('btn-disabled').css({ 'background-color': '#e5e7eb', color: 'black' });
			$('.body').append(`
					<input type="checkbox" id="guest-mode-modal" class="modal-toggle" />
					<label for="guest-mode-modal" class="modal cursor-pointer">
						<label class="modal-box relative">
							<h3 class="font-bold text-lg">Guest Mode</h3>
							<p class="py-4">
								Hello, you're currently in guest mode! In this mode, you're able to do anything that normal users can do
								except change the password and the delete account. Please be mindful that everyone on the internet has
								access to this storage, which means everyone will be able to view, download or delete the file you upload
								here. To create an account, sign out and create one!
							</p>
							<div class="modal-action">
								<label class="btn w-full" for="guest-mode-modal">Got it!</label>
							</div>
						</label>
					</label>
				`);
		}
		res.setHeader('content-type', 'text/html; charset=UTF-8').send($.html());
	}
});

app.use('*', (req, res, next) => {
	if (!req.session.loggedin) return res.sendStatus(401);
	next();
});

app.post('/files/upload', apiRateLimit, (req, res) => {
	req.busboy.on('field', (key, value) => {
		req.body[key] = value;
	});

	let files = [];
	/** @type {fs.WriteStream[]} */
	let streams = [];

	req.busboy.on('file', async (fieldname, file, info) => {
		let path = req.body.path;
		let size = req.body.size;
		if (path === undefined || size === undefined) return res.sendStatus(400);
		const userSize = await util.getUserSize(fastFolderSize, checkPath, req, databases, Query, config);
		if (userSize.total - userSize.used < size / (1000 * 1000)) {
			file.resume();
			res.sendStatus(405);
			return;
		}
		let name = decodeURI(info.filename) || 'New file';
		let filePath = checkPath(req.session.data.id, path, [name]);
		files.push(filePath);
		let stream = fs.createWriteStream(filePath);
		stream.once('error', () => error());
		streams.push(stream);
		let readBytes = 0;
		file.on('data', (chunk) => {
			readBytes += chunk.length;
			if (userSize.total - userSize.used < readBytes / (1000 * 1000)) {
				file.removeAllListeners();
				file.unpipe();
				file.resume();
				error(405);
			}
		});
		// Pipe it trough
		file.pipe(stream);
	});

	function error(err = 500) {
		for (const stream of streams) stream.destroy();
		files.forEach((file) => fs.unlink(file, () => {}));
		try {
			res.sendStatus(err);
		} catch {}
	}

	req.busboy.once('finish', () => {
		streams.forEach((stream) => stream.end());
		try {
			res.sendStatus(200);
		} catch {}
	});

	req.pipe(req.busboy); // Pipe it trough busboy
});

app.delete('/files/delete', apiRateLimit, (req, res) => {
	fs.rm(checkPath(req.session.data.id, req.body.path), { recursive: true, force: true }, (err) => {
		if (err) return res.sendStatus(500);
		res.sendStatus(200);
	});
});

// Update the file name
app.put('/files/update', apiRateLimit, (req, res) => {
	let oldPath = checkPath(req.session.data.id, req.body.oldPath);
	let newPath = checkPath(req.session.data.id, req.body.newPath);
	if (fs.existsSync(newPath) && req.body.force !== 'true') return res.sendStatus(405);

	fs.rename(oldPath, newPath, (err) => {
		if (err) return res.sendStatus(500);
		return res.sendStatus(200);
	});
});

// Copy a file
app.put('/files/copy', apiRateLimit, (req, res) => {
	let oldPath = checkPath(req.session.data.id, req.body.oldPath);
	let newPath = checkPath(req.session.data.id, req.body.newPath);
	if (fs.existsSync(newPath) && req.body.force !== 'true') return res.sendStatus(405);

	fs.cp(oldPath, newPath, { recursive: true }, (err) => {
		if (err) return res.sendStatus(500);
		return res.sendStatus(200);
	});
});

app.post('/folder/create', (req, res) => {
	let folderPath = req.body.path;
	if (!folderPath) return res.sendStatus(400);
	folderPath = checkPath(req.session.data.id, folderPath);
	if (fs.existsSync(folderPath)) return res.sendStatus(405);
	fs.mkdir(folderPath, (err) => {
		if (err) return res.sendStatus(500);
		res.sendStatus(200);
	});
});

app.post('/storage', async (req, res) => {
	res.send(await util.getUserSize(fastFolderSize, checkPath, req, databases, Query, config));
});

app.delete('/account/delete', (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	if (req.session.data.id === 0) return send("You can't delete the account in guest mode!");
	fs.rm(checkPath(req.session.data.id), { recursive: true, force: true }, async (err) => {
		if (err) return send('Fail to remove your storage container, please try again later!');
		const user = await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
			Query.equal('email', req.session.data.email),
		]);
		if (user.total < 1) return res.sendStatus(405);
		await databases.deleteDocument(config.appwrite_database_id, config.appwrite_collection_id, user.documents[0].$id);
		await databases
			.deleteDocument(config.appwrite_database_id, config.appwrite_password_reset_collection_id, user.documents[0].$id)
			.catch(() => {});
		// Log all logged in users out
		Object.entries(ss.sessions)
			.map((o) => ({ sid: o[0], session: o[1] }))
			.filter((o) => JSON.parse(o.session).data?.email === req.session.data.email)
			.forEach((session) => ss.destroy(session.sid));
		res.sendStatus(200);
	});
});

app.patch('/account/password', async (req, res) => {
	const send = (text) => res.status(400).send(text).end();
	const currentPass = req.body.currentPassword;
	const newPass = req.body.newPassword;
	if (!(currentPass && newPass)) return send('Please fill in all fields!');
	if (req.session.data.id === 0) return send("You can't change your password in guest mode!");
	const user = await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
		Query.equal('email', req.session.data.email),
		Query.equal('password', createHash('sha3-512').update(currentPass).digest('hex')),
	]);
	if (user.total < 1) return send('The password you have entered is incorrect!');
	await databases.updateDocument(config.appwrite_database_id, config.appwrite_collection_id, user.documents[0].$id, {
		password: createHash('sha3-512').update(newPass).digest('hex'),
	});
	// Log all logged in users out
	Object.entries(ss.sessions)
		.map((o) => ({ sid: o[0], session: o[1] }))
		.filter((o) => JSON.parse(o.session).data?.email === req.session.data.email)
		.forEach((session) => ss.destroy(session.sid));
	res.sendStatus(200);
});

app.listen(port, () => {
	console.log('HTTP Server running on port ' + port);
});

console.log('Server started!');
