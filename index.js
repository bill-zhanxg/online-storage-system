const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const busboy = require('connect-busboy');
const cheerio = require('cheerio');
const app = express();
const config = require('./config.json');
const iconMapping = require('./iconMapping.json');
const port = 3001;

process.on('uncaughtException', (err, origin) => {
    console.log(err);
});

app.use(session({
    secret: config.secret,
    resave: false,
    saveUninitialized: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));
app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
}));

const connection = mysql.createPool({
    // connectionLimit: 10,
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

app.get('/signup', (req, res) => {
    if (req.session.loggedin) {
        res.redirect('/');
    }
    else {
        res.sendFile(path.join(__dirname + '/views/signup.html'));
    }
})

app.use('/auth', (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        res.send('Too many characters!');
        res.end();
    }
    else {
        console.log(err.type);
        next();
    }
});

app.post('/auth', (req, res) => {
    // Capture the input fields
    let username = req.body.username;
    let password = req.body.password;

    // Code for none MySQL server
    req.session.loggedin = true;
    req.session.data = { id: 1, username: 'myUsername', password: 'myPassword', email: 'myEmail@gmail.com' };
    req.session.save();
    res.end();
    return;

    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        let sql = connection.query(`SELECT * FROM accounts WHERE (username = ? OR email = ?) AND password = ?`, [username, username, password], function (error, results, fields) {
            // If there is an issue with the query, output the error
            if (error) {
                send('There is an error with MySQL database, please let Bill.IHCha knows!');
                throw error;
            }
            // If the account exists
            if (results.length > 0) {
                // Authenticate the user
                req.session.loggedin = true;
                req.session.data = results[0];
                res.end();
            }
            else {
                send('Invalid Username or Password!');
            }
        });
    } else {
        send('Please enter Username and Password!');
    }

    function send(text) {
        res.send(text);
        res.end();
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.end();
})

app.post('/account/create', (req, res) => {

});

// File API
function checkPath(id, dir, extra = []) {
    if (!fs.existsSync('storedFiles')) fs.mkdirSync('storedFiles');
    let userPath = path.join('storedFiles', `${id}`);
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath);
    dir = dir || '';
    let unsafePath = path.join(dir, ...extra);
    while (true) {
        let check = unsafePath.indexOf('..\\');
        if (check !== -1) unsafePath = unsafePath.slice(0, check) + unsafePath.slice(check + 3);
        else break;
    }
    let finalPath = path.join(__dirname, userPath, unsafePath);
    return finalPath;
}

app.get('*', async (req, res) => {
    let file = req.query.file ? true : false;
    if (!req.session.loggedin) return file ? res.status(401).end() : res.sendFile(path.join(__dirname + '/views/login.html'));

    let userId = req.session.data.id;
    let dir = req.params[0];
    
    let folders = [];
    for (let folder of dir.split('/')) {
        if (!folder.trim()) continue;
        folders.push(folder);
    }
    let currentPath = folders.length > 0 ? `/${folders.join('/')}` : ''

    if (file) {
        if (!fs.existsSync(checkPath(userId, dir))) return res.sendFile(path.join(__dirname + '/views/not-found.html'));
        let $ = cheerio.load('<link rel="stylesheet" href="https://use.fontawesome.com/releases/v6.1.1/css/all.css"><link href="https://cdn.jsdelivr.net/npm/daisyui@2.24.0/dist/full.css" rel="stylesheet" type="text/css" /><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2/dist/tailwind.min.css" rel="stylesheet" type="text/css" /><div class="filePanel flex flex-col gap-2 mx-8 text-xl"></div><script src="https://code.jquery.com/jquery-3.6.0.min.js"></script><script src="/fileIframe.js"></script>');
    
        if ((await fs.promises.stat(checkPath(userId, dir))).isDirectory()) {
            fs.readdir(checkPath(userId, dir), async (err, files) => {
                if (err) {
                    // Return error element
                    console.log(err)
                }
                else {
                    function appendElement(filename, size, time, icon) {
                        $('.filePanel').append(`
                        <div draggable="true" ondragstart="drag(event)" ondrop="drop(event)" ondragover="event.preventDefault()" onclick="intoDir('${currentPath}/${filename}');" class="fileitem cursor-pointer flex justify-between items-center bg-base-200 border-[2px] border-base-300 px-4 py-2 rounded-xl">
    
                            <div class="flex justify-start items-center gap-4">
                                <input type="checkbox" class="noneClick checkbox checkitem" />
                                <p class="foldername"><i class="fa-solid fa-${icon} pr-2"></i>${filename}</p>
                            </div>
                
                            <div class="flex justify-between items-center gap-4 lg:gap-8">
                                <p>${size}</p>
                                <p>${time}</p>
                                <div class="noneClick dropdown dropdown-end dropdown-top">
                                    <label tabindex="0" class="btn btn-info m-1" id="dropdown" onmousedown="closeDropDown(event)"><i class="fa-solid fa-ellipsis-vertical"></i></label>
                                    <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-300 rounded-box w-52" id="dropdown-menu">
                                        <li><a>Do something</a></li>
                                        <li><a>Do something too</a></li>
                                        <li><a class="bg-red-500 text-base-300">just don't press it.</a></li>
                                    </ul>
                                </div>
                            </div>
                
                         </div>`)
                    }
                    for (let file of files) {
                        let stat = await fs.promises.stat(checkPath(userId, dir, [file]));
                        let size = stat.size;
                        if (size < 1000) size = `${size} Byte${size > 1 ? 's' : ''}`;
                        else if (size < 1000000) size = `${Math.round(size / 1000)} KB`;
                        else if (size < 1.0000E+9) size = `${Math.round(size / 1000000)} MB`;
                        else if (size < 1.0000E+12) size = `${Math.round(size / 1.0000E+9)} GB`;
                        else size = `${Math.round(size / 1.0000E+12)} TB`;
                        appendElement(file, size, 'today', stat.isDirectory() ? 'folder' : iconMapping[path.extname(file).slice(1)] || 'file');
                    }
                    if (files.length < 1) $('.filePanel').append('<h1 class="px-14">There is nothing here! Click "Create Folder" to create a folder!</h1>')
                    $('.createFolder').attr('onclick', `createFolder()`);
                    $('body').attr('currentPath', currentPath);
                    res.send($.html());
                }
            })
        }
        else {
            // File
            res.sendFile(checkPath(userId, dir));
        }
    }
    else {
        let $ = cheerio.load(await fs.promises.readFile(path.join(__dirname + '/views/user.html')));
    
        let append = [];
        for (let folder of folders) {
            append.push(folder);
            $('.dir').append(`<li><a onclick="handleDir('/${append.join('/')}')">${folder}</a></li>`);
        }
        $('body').attr('currentPath', currentPath);
        $('.files').attr('src', `${currentPath ? currentPath : '/'}?file=true`);
        res.send($.html());
    }
});

app.use('*', (req, res, next) => {
    if (!req.session.loggedin) return res.status(401).end();
    res.code = code => res.status(code).end();
    next();
});

app.post('/folder/create', (req, res) => {
    let folderPath = req.body.path;
    if (!folderPath) return res.code(400);
    folderPath = checkPath(req.session.data.id, folderPath);
    if (fs.existsSync(folderPath)) return res.code(405);
    fs.mkdir(folderPath, err => {
        if (err) return res.code(500);
        res.code(200);
    });
});

app.post('/files/upload', (req, res) => {
    req.pipe(req.busboy); // Pipe it trough busboy

    req.busboy.on('field', (key, value) => {
        req.body[key] = value;
    });

    let files = [];
    let streams = [];

    req.busboy.on('file', (fieldname, file, info) => {
        let path = req.body.path;
        if (path === undefined) return res.code(400);
        let name = info.filename || 'New file';
        let filePath = checkPath(req.session.data.id, path, [name]);
        files.push(filePath);
        let stream = fs.createWriteStream(filePath);
        streams.push(stream);
        // Pipe it trough
        file.pipe(stream);
    });

    req.socket.on('error', () => {
        streams.forEach(stream => stream.end());
        for (let file of files) fs.unlink(file, () => { });
        res.code(500);
    });

    req.busboy.on('finish', () => {
        streams.forEach(stream => stream.end());
        res.code(200);
    });
});

app.delete('/files/delete', (req, res) => {
    console.log(checkPath(req.session.data.id, req.body.path));
    fs.rm(checkPath(req.session.data.id, req.body.path), { recursive: true }, err => {
        if (err) return res.code(500);
        res.code(200);
    });
});

// Update the file name
app.put('/files/update', (req, res) => {
    let oldPath = path.join(checkPath(), req.body.oldPath);
    let newPath = path.join(checkPath(), req.body.newPath);

    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.json({ success: false });
        return res.json({ success: true });
    })
});

// Update the file content
app.patch('/files/update', (req, res) => {
    let oldPath = path.join(checkPath(), req.body.oldPath);
    let newPath = path.join(checkPath(), req.body.newPath);

    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.json({ success: false });
        return res.json({ success: true });
    })
});

app.listen(port, () => {
    console.log('HTTP Server running on port ' + port);
});

console.log('Server started!');