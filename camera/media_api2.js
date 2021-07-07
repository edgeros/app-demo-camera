/*
 * Copyright (c) 2021 EdgerOS Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: media_api2.js media api module.
 *
 * Author: Cheng.yongbin
 *
 */

var WebMedia = require('webmedia');
var CameraSource = require('@edgeros/jsre-camera-src');
const {Manager} = require('@edgeros/jsre-medias');
var checkPerm = require('./util').checkPerm;

/* 
 * Register media source. 
 */
const sourceName = 'camera-flv';
WebMedia.registerSource(sourceName, CameraSource);

/*
 * createSrcHandle(mediaOpts)
 * mediaOpts:
 * 	faceEnable {Boolean} default: true
 * 	fps {Integer} default: 1.5
 */
function createSrcHandle(mediaOpts) {
	var faceEnable = typeof mediaOpts.faceEnable === 'boolean' ? mediaOpts.faceEnable : true;
	var fps = typeof mediaOpts.fps === 'boolean' ? mediaOpts.fps : 1.5;

	return function(opts) {
		return {
			source: sourceName,
			inOpts: {
				host: opts.host,
				port: opts.port,
				path: opts.path,
				user: opts.user,
				pass: opts.pass
			},
			outOpts: {
				faceDetecOpts: {
					enable: faceEnable,
					fps: fps
				}
			}
		}
	}
}

/*
 * camOpenAI(media, enable)
 */
function camOpenAI(media, enable) {
	if (typeof enable !== 'boolean') {
		throw new TypeError('Argument error.');
	}
	if (media.ser) {
		media.source.openAI(enable);
	}
}

/*
 * camAutoMove(media, auto)
 */
function camAutoMove(media, auto) {
	if (media.enableMove) {
		media._autoMove = auto;
		media.source.autoMove = auto;
	}
}

/*
 * onCliOpen(media, client)
 */
function onCliOpen(media, client) {
	console.info(`Client ${client.id} open.`);
	client._aiOpened = false;
	var self = media;

	/*
	 * call: open
	 * reply: isOpen
	 */
	client.on('camera-ai', async (client, open, cb) => {
		try {
			await checkPerm(['ainn']);
		} catch (err) {
			return cb(client._aiOpened);
		}

		if (open && !client._aiOpened) {
			client._aiOpened = true;
			self._aiVisitors++;
			if (self._aiVisitors > 0) {
				camOpenAI(self, true);
			}
		} else if (!open && client._aiOpened) {
			client._aiOpened = false;
			self._aiVisitors--;
			if (self._aiVisitors === 0) {
				camOpenAI(self, false);
			}
		}
		cb(open);
	});

	/*
	 * call: autoMove
	 * reply: {result, msg, autoMode}
	 */
	client.on('camera-mode', (client, autoMove, cb) => {
		console.log('Recv camera-mode message.');
		if (!self.enableMove) {
			return cb({result: false, msg: 'Cam disenable move.'});
		}
		if (self.camLock) {
			return cb({result: false, msg: 'Cam lock.'});
		}
		self.camLock = true;
		if (self._autoMove !== autoMove) {
			camAutoMove(self, autoMove);
			self.ser.sendEvent('camera-sync', autoMove);
		}
		cb({result: true, msg: 'ok', autoMode: autoMove});
		self.camLock = false;
	});

	/*
	 * reply: {result, msg}
	 */
	client.on('camera-home', (client, cb) => {
		console.log('Recv camera-home message.');
		if (self._autoMove) {
			return cb({result: false, msg: 'Camera auto move.'});
		}
		self.camHome((err) => {
			if (err) {
				cb({result: false, msg: err.message});
			} else {
				cb({result: true, msg: 'ok'});
			}
		});
	});

	/*
	 * call: {x, y}
	 * reply: {result, msg}
	 */
	client.on('camera-move', (client, data, cb) => {
		if (self._autoMove) {
			cb({result: false, msg: 'Camera auto move.'});
			return;
		}
		self.camMove(data.x, data.y, (err) => {
			if (err) {
				cb({result: false, msg: err.message});
			} else {
				cb({result: true, msg: 'ok'});
			}
		});
	});

	/*
	 * reply: {result, msg}
	 */
	client.on('camera-stop', (client, cb) => {
		if (self._autoMove) {
			cb({result: false, msg: 'Camera auto move.'});
			return;
		}
		self.camStop((err) => {
			if (err) {
				cb({result: false, msg: err.message});
			} else {
				cb({result: true, msg: 'ok'});
			}
		});
	});
}

/*
 * onCliClose(media, client)
 */
function onCliClose(media, client) {
	console.info(`Client ${client.id} close.`);
	var self = media;
	if (client._aiOpened) {
		self._aiVisitors--;
		if (self._aiVisitors === 0) {
			camOpenAI(self, false);
		}
	}
}

/*
 * MediaApi.
 */
class MediaApi {
	/*
	 * constructor(app, opts)
	 * opts {Object}
	 * 	nets {Object}
	 * 	[mediaTimeout] {Integer}
	 * 	[searchCycle] {Integer}
	 * 	[faceEnable] {Boolean}
	 * 	[fps] {Integer}
	 */
	constructor(app, opts) {
		console.info('MultMedia create');
		opts = typeof opts === 'object' ? opts : {};
		this.mediaMgr = new Manager(app, null, opts, createSrcHandle(opts));
		this.mediaMgr.on('open', (media) => {
			media._aiVisitors = 0;
			media._autoMove = false;

			var source = media.source;
			source.on('camMove', (rx, ry) => {
				media.camMove(rx, ry, () => {});
			});

			source.on('camStop', () => {
				media.camStop(() => {});
			});

			media.on('open', onCliOpen);
			media.on('close', onCliClose);
		});
	}

	/*
	 * getDevList(search, cb)
	 */
	getDevList(search, cb) {
		var mediaMgr = this.mediaMgr;
		if (search) {
			mediaMgr.search();
			setTimeout(() => {
				cb(getDevs());
			}, 1000);
		} else {
			cb(getDevs());
		}

		function getDevs() {
			var devs = [];
			mediaMgr.iterDev((key, dev) => {
				var info = dev.dev;
				var item = {
					devId: key,
					alias: `${info.hostname}:${info.port}${info.path}`,
					report: info.urn,
					streams: getStreams(dev)
				};
				devs.push(item);
			});
			return devs;
		}

		function getStreams(dev) {
			var streams = [];
			mediaMgr.iterStream(dev.key, (token, stream) => {
				streams.push({
					streamId: token,
					alias: stream.url,
					width: stream.width,
					height: stream.height,
					status: stream.media ? true : false
				});
			});
			return streams;
		};
	}

	/*
	 * getStreams(devId, opt, cb)
	 */
	getStreams(devId, opt, cb) {
		var mediaMgr = this.mediaMgr;
		var dev = mediaMgr.findDev(devId);
		if (!dev) {
			return cb([]);
		}
		mediaMgr.createStream(devId, opt, (err, streams) => {
			if (err) {
				return cb([]);
			}
			var ret = [];
			for (var token in streams) {
				var stream = streams[token];
				ret.push({
					streamId: token,
					alias: stream.url,
					width: stream.width,
					height: stream.height,
					status: stream.media ? true: false
				});
			}
			cb(ret);
		});
	}

	/*
	 * loginMedia(devId, token, opt, cb)
	 */
	loginMedia(devId, token, opt, cb) {
		var mediaMgr = this.mediaMgr;
		var media = mediaMgr.findMedia(devId, token);
		if (media) { /* Media already conect. */
			return cb(media);
		}
		return mediaMgr.createMedia(devId, token, opt, (err, media) => {
			if (err && err.type == 'FAIL') {
				cb();
			} else if (err) {
				cb(err);
			} else {
				cb(media);
			}
		});
	}

	/*
	 * closeMedia(devId, token, cb)
	 */
	closeMedia(devId, token, cb) {
		console.log('Recv camera-close message.', devId);
		this.mediaMgr.destroyMedia(devId, token, cb);
	}
}

module.exports = MediaApi;
