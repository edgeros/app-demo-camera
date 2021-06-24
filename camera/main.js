/*
 * Copyright (c) 2021 EdgerOS Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: main.js demo application.
 *
 * Author: Cheng.yongbin
 *
 */

var WebApp = require('webapp');
var util = require('./util');

/* 
 * WebApp.
 */
var app = WebApp.createApp();

/*
 * Set static path.
 */
app.use(WebApp.static('./public'));

/*
 * Meia server.
 */
var server = undefined;

/*
 * Create Meia server.
 */
function createMediaSer() {
	console.log('Create media server.');
	if (server) {
		return Promise.resolve(server);
	}
	return util.getIfnames()
	.then((ifnames) => {
		var MediaApi = require('./media_api'); /* or: require('./media_api2') */
		server = new MediaApi(app, {
			faceEnable: true,
			fps: 1.5,
			nets: [
				{ifname: ifnames.lan, localPort: 0},
				{ifname: ifnames.wan, localPort: 0}
			],
			mediaTimeout: 1800000,
			searchCycle: 20000
		});
		console.log('Create media server success.');
		return server;
	})
	.catch((e) => {
		server = undefined;
		console.error(e.message);
		throw e;
	});
}

/*
 * Is server starting. 
 */
var starting = false;

/*
 * Start Meia server.
 */
function startServer() {
	if (server) {
		return Promise.resolve(server);
	}
	if (starting) {
		return Promise.reject(new Error('Server starting.'));
	} else {
		starting = true;
	}

	var perms = ['network'];
	return util.checkPerm(perms)
	.then((ret) => {
		return createMediaSer();
	})
	.then((ser) => {
		starting = false;
		console.log('Start server success.');
		return ser;
	})
	.catch((err) => {
		starting = false;
		console.warn('Start server fail:', err.message);
		throw err;
	});
}

/*
 * Init start mult-meida server.
 */
Task.nextTick(() => {
	startServer().catch((err) => {
		console.error(err.message);
	});
});

/* 
 * req: null
 * res: [{devId, alias, report, status}...]
 */
app.get('/api/list', async (req, res) => {
	if (!server) {
		try {
			await startServer();
		} catch (err) {
			return res.json([]);
		}
	}
	var devs = server.getMediaList();
	res.send(JSON.stringify(devs));
});

/*
 * req: devId
 * res: {result, msg, login, videoUrl, enableMove, autoMode}
 */
app.get('/api/select', async (req, res) => {
	console.log('Recv camera-select message.');
	if (!server) {
		return res.json({
			result: false,
			code: 50001,
			msg: '流媒体启动失败！'
		});
	}

	try {
		await util.checkPerm(['rtsp']);
	} catch(err) {
		return res.json({
			result: false,
			code: 40307,
			msg: '缺少 rtsp 权限！'
		});
	}

	var ret = {result: false, code: 20000, msg: 'error', login: false};
	var deviceId = req.query.devId;
	if (!deviceId) {
		ret.msg = `无效的设备: ${deviceId}`;
		ret.code = 50002;
		console.warn(ret.msg);
		res.send(JSON.stringify(ret));
		return;
	}

	server.selectMedia(deviceId, (media) => {
		if (media instanceof Error) {
			ret.msg = `无效的设备: ${deviceId}`;
			ret.code = 50002;
			console.warn(ret.msg);
		} else if (!media) {
			ret.result = true;
			ret.msg = 'Need login camera.';
			ret.login = true;
		} else {
			ret.result = true;
			ret.msg = 'ok';
			ret.videoUrl = '/' + media.sid;
			ret.enableMove = media.enableMove;
			ret.autoMode = media.autoMove;
		}
		res.send(JSON.stringify(ret));
	});
});

/*
 * req: {devId, username, password}
 * res: {result, msg, videoUrl, enableMove, autoMove}
 */
app.post('/api/login', (req, res) => {
	console.log('Recv camera-login message.');
	if (!server) {
		return res.json({
			result: false,
			code: 50001,
			msg: '流媒体启动失败！'
		});
	}

	var ret = {result: false, code: 20000, msg: 'error'};
	var data = [];
	req.on('data', (buf) => {
		data.push(buf);
	});

	req.on('end', async () => {
		try {
			await util.checkPerm(['rtsp']);
			data = Buffer.concat(data);
			var info = JSON.parse(data.toString());
			var deviceId = info.devId;
			if (!deviceId) {
				ret.msg = `无效的设备: ${deviceId}`;
				ret.code =  50002;
				console.warn(ret.msg);
				res.send(JSON.stringify(ret));
				return;
			}

			server.loginMedia(info, (media) => {
				if (!media || media instanceof Error) {
					ret.msg = `设备 ${deviceId} 登录失败！`;
					ret.code = 50003;
					console.warn(ret.msg);
				} else {
					ret.result = true;
					ret.msg = 'ok';
					ret.videoUrl = '/' + media.sid;
					ret.enableMove = media.enableMove;
					ret.autoMode = media.autoMove;
				}
				res.send(JSON.stringify(ret));
			});

		} catch(e) {
			ret.result = false;
			ret.msg = e.message;
			console.warn(ret.msg);
			res.send(JSON.stringify(ret));
			return;
		}
	});
});

/*
 * app start
 */
app.start();

/* Event loop. */
require('iosched').forever();
