'use strict';

var webpage = require('webpage');
var system = require('system');
var page = require('webpage').create();

var cfg = JSON.parse(system.args[1]);

if (!cfg.width) {
	cfg.width = 1360;
};

// открываем и готовим страницу
page.open(cfg.url, function (status) {

	// если возникла проблема с загрузкой
	if (status !== 'success') {
		console.error('Could not open file');
		phantom.exit();
		return;
	}

	// выставляем область видимости по-умолчанию
	page.viewportSize = {
		width: cfg.width,
		height: 768
	};
});

// действия по загрузке документа
page.onLoadFinished = function () {

	// отрисовка документа
	setTimeout(function () {

		// определение высоты документа
		var documentHeight = page.evaluate(function () {
			return document.documentElement.scrollHeight;
		});

		// изменение высоты области видимости
		page.viewportSize = {
			width: cfg.width,
			height: documentHeight
		};
		
		var base64 = page.renderBase64('PNG');

		console.log(base64)
		phantom.exit();
	}, 500);
};
