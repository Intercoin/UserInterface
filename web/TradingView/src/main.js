import Datafeed from './datafeed.js';

console.log({ Datafeed });
window.tvWidget = new TradingView.widget({
	symbol: 'uniswapv2:WETH/USDT', // default symbol
	interval: '1', // default interval
	fullscreen: true, // displays the chart in the fullscreen mode
	container: 'tv_chart_container',
	datafeed: Datafeed,
	library_path: 'charting_library/',
	debug: true,
	disabled_features: ['header_symbol_search', 'header_saveload'],
});
