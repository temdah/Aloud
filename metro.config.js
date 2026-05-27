const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The PDF.js library + worker are shipped as opaque assets (custom extension)
// so Metro bundles them as readable files instead of trying to parse them as
// JS source. They are read at runtime and handed to the extraction WebView.
config.resolver.assetExts.push('pdfjsbundle', 'html');

module.exports = config;
