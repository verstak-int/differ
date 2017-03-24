var fs = require('fs-extra');
var path = require('path');
var childProcess = require('child_process');

var phantomjs = require('phantomjs');
var binPath = phantomjs.path;

var PNG = require('pngjs').PNG;
var pixelmatch = require('pixelmatch');

module.exports = differ;

function differ (cfg) {
	getScreenshots(cfg, onScreenshotsReady);
};

// получаем снимки
function getScreenshots (cfg, cb) {
	if (!cfg.what[0]._done) {
		var item = cfg.what[0];

		// получаем снимок
		getScreenshot({
			url: item.url
		}, function (err, stdout, stderr) {

			// сохраняем снимок
			savePng64Sync(stdout, cfg.where, item.name +'.tmp');
			cfg.each(item);
			item._done = 'true';
			cfg.what.push(item);
			cfg.what.splice(0, 1);
			getScreenshots(cfg, cb);
		});
	}
	else {

		// удаляем служебное поле
		cfg.what.map(function (item) {
			delete item._done;
			return item;
		});

		cb(cfg);
	};
};

// по готовности снимков
function onScreenshotsReady (cfg, result) {
	if (!result) {
		result = [];
	};

	if (!cfg.what[0]._done) {
		var item = cfg.what[0];

		var itemPath = {
			tmp: path.join(
				cfg.where,
				item.name +'.tmp.png'
			),
			ref: path.join(
				cfg.where,
				item.name +'.png'
			),
			diff: path.join(
				cfg.where,
				item.name +'.diff.png'
			)
		};

		var isReference = checkFileSync(itemPath.ref);

		if (!isReference) {
			fs.copySync(
				itemPath.tmp,
				itemPath.ref
			);

			result.push({
				item: item,
				path: itemPath,
				type: 'new'
			});

			item._done = 'true';
			cfg.what.push(item);
			cfg.what.splice(0, 1);
			onScreenshotsReady(cfg, result);
		}
		else {

			// читаем изображения
			var img1 = fs.createReadStream(itemPath.tmp).pipe(new PNG()).on('parsed', doneReading);
			var img2 = fs.createReadStream(itemPath.ref).pipe(new PNG()).on('parsed', doneReading),
				filesRead = 0;

			// по окончанию чтения
			function doneReading() {
				if (++filesRead < 2) return;
				var diff = new PNG({width: img1.width, height: img1.height});
				var diffPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {threshold: 0.1});
				var diffStream = fs.createWriteStream(itemPath.diff);

				diffStream
					.on('open', function () {
						diff.pack().pipe(diffStream);
					})
					.on('finish', function () {

						// если изображения отличаются
						if (diffPixels > 0) {
							result.push({
								item: item,
								diffPixels: diffPixels,
								path: itemPath,
								type: 'change'
							});
						}
						else {
							result.push({
								item: item,
								path: itemPath,
								type: 'equal'
							});
						};

						item._done = 'true';
						cfg.what.push(item);
						cfg.what.splice(0, 1);
						onScreenshotsReady(cfg, result);
					});
			};
		};
	}
	else {

		// удаляем служебное поле
		result.map(function (item) {
			delete item.item._done;
			return item;
		});

		// отправляем результат
		cfg.cb(result, cfg);
	};
};

// проверка существования файла
function checkFileSync (filePath) {
	try {
		stats = fs.lstatSync(filePath);
	}
	catch (e) {
		return false;
	};

	if (stats) {
		return true;
	};
};

/**
 * Получить снимок документа по адресу
 * @param  {object} cfg  настройка функции
 * @param  {Function} cb   вызывается после получения снимка
 */
function getScreenshot (cfg, cb) {

	// настраиваем скрипт фантома
	var childArgs = [
		path.join(
			__dirname,
			'phantomjs-script.js'
		),
		JSON.stringify(cfg)
	];

	// стартуем процесс фантома
	childProcess.execFile(binPath, childArgs, {
		maxBuffer: 3 * 1024 * 1024
	}, cb);
};

/**
 * сохранение закодированного изображения синхронно
 * @param  {string} data закодированные данные
 * @param  {string} path куда сохранять файл
 */
function savePng64Sync (data, filePath, fileName) {
	var buffer = new Buffer(data, 'base64');

	fs.outputFileSync(path.join(
		filePath,
		fileName +'.png'
	), buffer);
};
