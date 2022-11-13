'use strict';

function formatBytes(bytes) {
	if (bytes < 1000) bytes = `${bytes} Byte${bytes > 1 ? 's' : ''}`;
	else if (bytes < 1000000) bytes = `${Math.round(bytes / 1000)} KB`;
	else if (bytes < 1.0e9) bytes = `${Math.round(bytes / 1000000)} MB`;
	else if (bytes < 1.0e12) bytes = `${Math.round(bytes / 1.0e9)} GB`;
	else bytes = `${Math.round(bytes / 1.0e12)} TB`;
	return bytes;
}

function formatDate(date) {
	return (
		new Date(date).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) +
		', ' +
		new Date(date).toLocaleDateString('en-AU')
	);
}

module.exports = { formatBytes, formatDate };
