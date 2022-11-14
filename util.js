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

async function getUserSize(fastFolderSize, checkPath, req, databases, Query, config) {
	const megaBytes = Math.round((await fastFolderSize(checkPath(req.session.data.id))) / (1000 * 1000)).toString();
	const total =
		req.session.id === 0
			? 1000
			: (
					await databases.listDocuments(config.appwrite_database_id, config.appwrite_collection_id, [
						Query.equal('email', req.session.data.email),
					])
			  ).documents[0]?.storage || 1000;
	return { used: megaBytes, total };
}

module.exports = { formatBytes, formatDate, getUserSize };
