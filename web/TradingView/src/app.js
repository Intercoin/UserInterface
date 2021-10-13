import { parseFullSymbol } from './helpers.js';
const { ethers, utils } = window.ethers;

 // Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const evmChains = window.evmChains;

// Web3modal instance
let web3Modal
let provider;
let web3ModalProvider;

let selectedAccount;

let token1Decimals = 18;
let token2Decimals = 18;

let token1Symbol = '';
let token2Symbol = '';

const UNISWAP_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const PANCAKESWAP_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

let pairAddress = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc';

let subscriptionItem;

let chainName = 'Ethereum';

const TOKEN_ADDRESS = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
}

/**
 * Setup the orchestra
 */

class BigDecimal {
  static decimals = 16;
  constructor(value) {
      let [ints, decis] = String(value).split(".").concat("");
      decis = decis.padEnd(BigDecimal.decimals, "0");
      this.bigint = BigInt(ints + decis);
  }
  static fromBigInt(bigint) {
      return Object.assign(Object.create(BigDecimal.prototype), { bigint });
  }
  divide(divisor) { // You would need to provide methods for other operations
      return BigDecimal.fromBigInt(this.bigint * BigInt("1" + "0".repeat(BigDecimal.decimals)) / divisor.bigint);
  }
  toString() {
      const s = this.bigint.toString().padStart(BigDecimal.decimals+1, "0");
      return s.slice(0, -BigDecimal.decimals) + "." + s.slice(-BigDecimal.decimals)
              .replace(/\.?0+$/, "");
  }
}

async function init() {

  console.log("WalletConnectProvider is", WalletConnectProvider);
  console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  /*
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        infuraId: "86e084f647d44d1d81e69a8cb07b98a7",
      }
    },
  };
  */
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        rpc: {
          1: "https://eth.getblock.io/mainnet/?api_key=374714c2-ece7-4df0-85a9-64d6db04b0cb",
          4: "https://eth.getblock.io/testnet/?api_key=374714c2-ece7-4df0-85a9-64d6db04b0cb",
          56: "https://bsc.getblock.io/mainnet/?api_key=374714c2-ece7-4df0-85a9-64d6db04b0cb",
          97: "https://bsc.getblock.io/testnet/?api_key=374714c2-ece7-4df0-85a9-64d6db04b0cb",
        },
      }
    },
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });

}


/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
async function fetchAccountData() {

  // Get a Web3 instance for the wallet
  const web3 = new Web3(web3ModalProvider);
  provider = new ethers.providers.Web3Provider(web3ModalProvider);

  console.log("Web3 instance is", web3);

  // Get connected chain id from Ethereum node
  const chainId = await web3.eth.getChainId();
  // Load chain information over an HTTP API
  const chainData = evmChains.getChain(chainId);
  document.querySelector("#network-name").textContent = chainData.name;

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();

  // MetaMask does not give you all accounts, only the selected account
  console.log("Got accounts", accounts);
  selectedAccount = accounts[0];

  document.querySelector("#selected-account").textContent = selectedAccount;

  // Display fully loaded UI for wallet data
  document.querySelector("#prepare").style.display = "none";
  document.querySelector("#connected").style.display = "block";
}



/**
 * Fetch account data for UI when
 * - User switches accounts in wallet
 * - User switches networks in wallet
 * - User connects wallet initially
 */
async function refreshAccountData() {

  // If any current data is displayed when
  // the user is switching acounts in the wallet
  // immediate hide this data
  document.querySelector("#connected").style.display = "none";
  document.querySelector("#prepare").style.display = "block";

  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  await fetchAccountData(web3ModalProvider);
  document.querySelector("#btn-connect").removeAttribute("disabled")
}


/**
 * Connect wallet button pressed.
 */
async function onConnect() {

  console.log("Opening a dialog", web3Modal);
  try {
    web3ModalProvider = await web3Modal.connect();
  } catch(e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  checkNetwork(web3ModalProvider.chainId);
  // Subscribe to accounts change
  web3ModalProvider.on("accountsChanged", (accounts) => {
    fetchAccountData();
  });

  // Subscribe to chainId change
  web3ModalProvider.on("chainChanged", (chainId) => {
    console.log({ chainId });
    checkNetwork(chainId);
    fetchAccountData();
  });

  // Subscribe to networkId change
  web3ModalProvider.on("networkChanged", (networkId) => {
    fetchAccountData();
  });

  await refreshAccountData();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", web3ModalProvider);

  // TODO: Which providers have close method?
  if(web3ModalProvider.close) {
    await web3ModalProvider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    web3ModalProvider = null;
  }

  selectedAccount = null;

  // Set the UI back to the initial state
  document.querySelector("#prepare").style.display = "block";
  document.querySelector("#connected").style.display = "none";
}

/**
 * 
 * Check network and update select box
 */
function checkNetwork(chainId) {
  console.log({ chainId });
  
  if(chainId == 0x38) {
    chainName = 'Binance';
    const ethOption1 = document.querySelector("#select1 option[name='WETH']");
    const ethOption2 = document.querySelector("#select2 option[name='WETH']");
    const usdcOption1 = document.querySelector("#select1 option[name='USDC']");
    const usdcOption2 = document.querySelector("#select2 option[name='USDC']");
    const bnbOption1 = document.querySelector("#select1 option[name='BNB']");
    const bnbOption2 = document.querySelector("#select2 option[name='BNB']");
    const busdOption1 = document.querySelector("#select1 option[name='BUSD']");
    const busdOption2 = document.querySelector("#select2 option[name='BUSD']");
    ethOption1.disabled = true;
    ethOption2.disabled = true;
    usdcOption1.disabled = true;
    usdcOption2.disabled = true;
    bnbOption1.disabled = false;
    bnbOption2.disabled = false;
    busdOption1.disabled = false;
    busdOption2.disabled = false;
  } else if ( chainId == 0x01) {
    chainName = 'Ethereum';
    const bnbOption1 = document.querySelector("#select1 option[name='BNB']");
    const bnbOption2 = document.querySelector("#select2 option[name='BNB']");
    const busdOption1 = document.querySelector("#select1 option[name='BUSD']");
    const busdOption2 = document.querySelector("#select2 option[name='BUSD']");
    const ethOption1 = document.querySelector("#select1 option[name='WETH']");
    const ethOption2 = document.querySelector("#select2 option[name='WETH']");
    const usdcOption1 = document.querySelector("#select1 option[name='USDC']");
    const usdcOption2 = document.querySelector("#select2 option[name='USDC']");
    bnbOption1.disabled = true;
    bnbOption2.disabled = true;
    busdOption1.disabled = true;
    busdOption2.disabled = true;
    ethOption1.disabled = false;
    ethOption2.disabled = false;
    usdcOption1.disabled = false;
    usdcOption2.disabled = false;
  }
}
async function onChangeNetwork() {
  console.log('change network', chainName);
  if (chainName == 'Ethereum') {
    try {
      await web3ModalProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }]
      });
      chainName = 'Binance';
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (error.code === 4902) {
        try {
          await web3ModalProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
            chainId: '0x38',
            chainName: 'Binance Smart Chain',
            nativeCurrency: {
                name: 'Binance Coin',
                symbol: 'BNB',
                decimals: 18
            },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com']
            }]
            })
            .catch((error) => {
            console.log(error)
            });
        } catch (addError) {
          // handle "add" error
        }
      }
      // handle other "switch" errors
    }
  } else {
    await web3ModalProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }]
    });
    chainName = 'Ethereum';
  }
  
  
}

async function onSelectToken(evt) {
  evt.preventDefault();
  
  console.log(window.tvWidget);
  provider.off('block');

  const token1 = document.querySelector("#select-token input[name='token1']").value;
  const token2 = document.querySelector("#select-token input[name='token2']").value;

  let factoryUrl;
  let lpUrl;

  if (chainName == 'Ethereum') {
    factoryUrl = 'https://super-vic114.github.io/LiquidityGraph/contracts/uniswap-factory.abi.json';
    lpUrl = 'https://super-vic114.github.io/LiquidityGraph/contracts/uniswap-lp.abi.json';
  } else {
    factoryUrl = 'https://super-vic114.github.io/LiquidityGraph/contracts/pancakeswap-factory.abi.json';
    lpUrl = 'https://super-vic114.github.io/LiquidityGraph/contracts/pancakeswap-lp.abi.json';
  }
  
  console.log({factoryUrl});
  const factoryFile = await fetch(factoryUrl);
  const factoryAbi = await factoryFile.json();
  const signer = provider.getSigner();
  const factory = new ethers.Contract(
    chainName == 'Ethereum' ? UNISWAP_FACTORY_ADDRESS : PANCAKESWAP_FACTORY_ADDRESS , 
    factoryAbi, 
    signer
  );

  const res = await factory.getPair(token1, token2);
  pairAddress = res;

  console.log({ pairAddress });

  // Get Uniswap LP Contract ABI

  const lpFile = await fetch(lpUrl);
  const lpAbi = await lpFile.json();
  const contract = new ethers.Contract(pairAddress, lpAbi, signer);

  await getTokenInfos(contract);
  
  // Generate Symbol
  const symbol = `${chainName == 'Ethereum' ? 'uniswapv2' : 'Binance'}:${token1Symbol.toUpperCase()}/${token2Symbol.toUpperCase()}`;
  console.log({ symbol });
  window.tvWidget.setSymbol(symbol, subscriptionItem.resolution, () => {
    console.log('callback is called');
    // console.log({ params });
  });
  provider.on("block", blockNumber => onBlock(contract, blockNumber));
};

function getNextBarTime(barTime) {
	const date = new Date(barTime * 1000);
  const curResolution = subscriptionItem.resolution;

	if (curResolution.includes('D')) {
		date.setDate(date.getDate() + 1);	
	} else {
		date.setMinutes(date.getMinutes() + curResolution);
	}
	return date.getTime() / 1000;
}


async function onBlock(contract, blockNumber) {
  // Emitted on every block change
  const res = await contract.getReserves({ blockTag: blockNumber });
  console.log(`${blockNumber}:`, res);

  console.log(Number(res._reserve0));
  console.log(Number(res._reserve1));
  // Caculate trade price and time
  const tradePrice = Number(res._reserve1) / Number(res._reserve0) * Math.pow(10, token1Decimals - token2Decimals);
  const tradeTime = res._blockTimestampLast;

  console.log({ tradePrice, tradeTime });

  const lastDailyBar = subscriptionItem.lastDailyBar;
  const nextDailyBarTime = getNextBarTime(lastDailyBar.time);

  let bar;
	if (tradeTime >= nextDailyBarTime) {
		bar = {
			time: nextDailyBarTime,
			open: tradePrice,
			high: tradePrice,
			low: tradePrice,
			close: tradePrice,
		};
		console.log('[socket] Generate new bar', bar);
	} else {
		bar = {
			...lastDailyBar,
			high: Math.max(lastDailyBar.high, tradePrice),
			low: Math.min(lastDailyBar.low, tradePrice),
			close: tradePrice,
		};
		console.log('[socket] Update the latest bar by price', tradePrice);
	}
	subscriptionItem.lastDailyBar = bar;

  subscriptionItem.callback(bar);
  
}

/**
 * Calculate decimals for tokens to get correct reserves
 */

async function getTokenInfos(lpContract) {
  
  // Get token addresses
  const token1Address = await lpContract.token0();
  const token2Address = await lpContract.token1();

  // Create each token contract instance to get decimals
  const file = await fetch('https://super-vic114.github.io/LiquidityGraph/contracts/erc20.abi.json');
  const abi = await file.json();
  
  const signer = provider.getSigner();

  const token1Contract = new ethers.Contract(token1Address, abi, signer);
  const token2Contract = new ethers.Contract(token2Address, abi, signer);

  token1Decimals = await token1Contract.decimals();
  token2Decimals = await token2Contract.decimals();

  token1Symbol = await token1Contract.symbol();
  token2Symbol = await token2Contract.symbol();

  if (token1Symbol == 'WBNB') token1Symbol = 'BNB';
  if (token2Symbol == 'WBNB') token2Symbol = 'BNB';

  console.log({ token1Decimals, token2Decimals });
}

function onSelect1Change() {
  const value = document.querySelector("#select1").value;
  const token1 = document.querySelector("#select-token input[name='token1']");
  token1.value = TOKEN_ADDRESS[value];
}

function onSelect2Change() {
  const value = document.querySelector("#select2").value;
  const token2 = document.querySelector("#select-token input[name='token2']");
  token2.value = TOKEN_ADDRESS[value];
}

/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
  document.querySelector("#select-token").addEventListener("submit", onSelectToken);
  document.querySelector("#btn-change-network").addEventListener("click", onChangeNetwork);
  document.querySelector("#select1").addEventListener("change", onSelect1Change);
  document.querySelector("#select2").addEventListener("change", onSelect2Change);
});

export function subscribeOnStream(
	symbolInfo,
	resolution,
	onRealtimeCallback,
	subscribeUID,
	onResetCacheNeededCallback,
	lastDailyBar,
) {
	const parsedSymbol = parseFullSymbol(symbolInfo.full_name);

	console.log({ parsedSymbol });
  console.log({ symbolInfo });
	
	subscriptionItem = {
    symbolInfo: parsedSymbol,
		subscribeUID,
		resolution,
		lastDailyBar,
    callback: onRealtimeCallback,
	};
}

export function unsubscribeFromStream(subscriberUID) {
	// find a subscription with id === subscriberUID
	
}

