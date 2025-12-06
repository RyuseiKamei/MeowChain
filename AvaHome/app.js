//----------------------------------------------------------------------------------------------------------------------
// ethers.js ライブラリを使用して、MetaMaskとの接続やトークン残高取得を行う
const tokenAddress = "0x1342178ba36980b57926dEf14209E4763E9Af6BC"; // 独自トークンのコントラクトアドレス
const tokenABI = [
    // トークンの残高を取得するための標準的なERC-20のbalanceOf関数のABI（Application Binary Interface）
    "function balanceOf(address owner) view returns (uint256)"
];

let provider;  // Web3プロバイダ（MetaMask）を保持する変数
let signer;    // MetaMaskで選択されたアカウントを指すsignerオブジェクトを保持する変数


//----------------------------------------------------------------------------------------------------------------------
// ページ読み込み時にlocalStorageからウォレットアドレスとトークン残高を読み込む
window.addEventListener("DOMContentLoaded", () => {
    const savedWalletAddress = localStorage.getItem("walletAddress");
    const savedTokenBalance = localStorage.getItem("tokenBalance");

    if (savedWalletAddress) {
        document.getElementById("walletAddress").innerText = `ウォレットアドレス : ${savedWalletAddress}`;
    }

    if (savedTokenBalance) {
        document.getElementById("tokenBalance").innerText = savedTokenBalance;

        // 残高が500以上なら「商品を購入」ボタンを表示
        if (parseFloat(savedTokenBalance) >= 1) {
            document.getElementById("purchaseButton").style.display = "block";
        }
        
        // 残高が0以上なら「商品を購入」ボタンを表示
        if (parseFloat(savedTokenBalance) >= 0) {
            document.getElementById("nftButton").style.display = "block";
        }
    }
});


//----------------------------------------------------------------------------------------------------------------------
// MetaMaskのネットワークをAvalanche Fujiに切り替える
async function switchToFujiNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa869' }] // Avalanche FujiテストネットのチェーンID
        });
    } catch (switchError) {
        // ネットワークがMetaMaskにまだ追加されていない場合
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: '0xa869',
                            chainName: 'Avalanche Fuji Testnet',
                            rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                            nativeCurrency: {
                                name: 'Avalanche',
                                symbol: 'AVAX',
                                decimals: 18
                            },
                            blockExplorerUrls: ['https://testnet.snowtrace.io']
                        }
                    ]
                });
            } catch (addError) {
                console.error('ネットワーク追加エラー:', addError);
            }
        } else {
            console.error('ネットワーク切り替えエラー:', switchError);
        }
    }
}


//----------------------------------------------------------------------------------------------------------------------
// AvalancheTestnetを追加するための関数
async function addAvaTest(){
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
                {
                    chainId: '0xa869',
                    chainName: 'Avalanche Fuji Testnet',
                    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                    nativeCurrency: {
                        name: 'Avalanche',
                        symbol: 'AVAX',
                        decimals: 18
                    },
                    blockExplorerUrls: ['https://testnet.snowtrace.io']
                }
            ]
        });
    } catch (addError) {
        console.error('ネットワーク追加エラー:', addError);
    }
}



//----------------------------------------------------------------------------------------------------------------------
// MetaMaskと接続するための関数
async function connectMetaMask() {
    // MetaMaskがインストールされているか確認
    if (window.ethereum) {
        try {
            await addAvaTest();

            // MetaMaskにネットワークを切り替える
            await switchToFujiNetwork();

            // MetaMaskを通じてユーザーにウォレットアクセスをリクエスト
            await window.ethereum.request({ method: "eth_requestAccounts" });
            
            // MetaMaskを通じてユーザーにウォレットアクセスをリクエスト
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

            // アカウントが存在するか確認
            if (accounts.length === 0) {
                throw new Error("アカウントが見つかりません");
            }

            // ethers.jsを使ってMetaMaskのWeb3プロバイダを初期化
            provider = new ethers.providers.Web3Provider(window.ethereum);

            // signerオブジェクトを取得
            signer = provider.getSigner();

            // 接続されたウォレットアドレスを取得
            const walletAddress = accounts[0]; // accounts変数を正しく参照

            // ウォレットアドレスを表示
            document.getElementById("walletAddress").innerText = `ウォレットアドレス : ${walletAddress}`;
            
            // ウォレットアドレスをlocalStorageに保存
            localStorage.setItem("walletAddress", walletAddress);
            
            // トークン残高を取得
            await getTokenBalance(walletAddress);
        } catch (error) {
            console.error("MetaMask接続エラー:", error);
            //alert("ネットワークが追加されていません");
        }
    } else {
        alert("MetaMaskアプリと接続します");
        // MetaMaskがインストールされていない場合、スマホ用のMetaMaskアプリへ誘導
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/android/i.test(userAgent)) {
            // Androidの場合、MetaMaskアプリへのリンク
            window.open("https://metamask.app.link/dapp/shoken.com/MeowChain/AvaHome", "_blank");
        } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            // iOSの場合、MetaMaskアプリへのリンク
            window.open("https://metamask.app.link/dapp/shoken.com/MeowChain/AvaHome", "_blank");
        } else {
            alert("MetaMaskがインストールされていません。MetaMaskをインストールしてください。");
        }
    }
}


//----------------------------------------------------------------------------------------------------------------------
// トークン残高の取得
async function getTokenBalance(walletAddress) {
    // ethers.jsを使用してトークンコントラクトをインスタンス化
    const contract = new ethers.Contract(tokenAddress, tokenABI, provider);
    try {
        console.log("ウォレットアドレス:", walletAddress); // デバッグ用にウォレットアドレスを出力
        console.log("トークンコントラクトアドレス:", tokenAddress); // デバッグ用にコントラクトアドレスを出力
        
        // ウォレットアドレスが正しい形式かどうかをチェック
        if (!ethers.utils.isAddress(walletAddress)) {
            // 無効なアドレスの場合はエラーを投げる
            throw new Error("無効なウォレットアドレスです");
        }
        
        // ERC-20コントラクトのbalanceOf関数を呼び出して残高を取得（単位はWei）
        const balance = await contract.balanceOf(walletAddress);
        console.log("取得した残高 (Wei単位):", balance.toString()); // 残高をデバッグ用に出力

        // トークンの小数点以下18桁を考慮して残高をフォーマット（ERC-20トークン標準の小数点以下18桁）
        const formattedBalance = ethers.utils.formatUnits(balance, 5); 

        // トークン残高をlocalStorageに保存
        localStorage.setItem("tokenBalance", formattedBalance);

        // 残高が500以上の場合に「商品を購入」ボタンを表示
        if (parseFloat(formattedBalance) >= 500) {
            document.getElementById("purchaseButton").style.display = "block";
        }
        
        // フォーマットされた残高をHTMLに表示
        document.getElementById("tokenBalance").innerText = formattedBalance;
    } catch (error) {
        // トークン残高取得時のエラー処理
        console.error("トークン残高取得エラー:", error);
    }
}


//----------------------------------------------------------------------------------------------------------------------
// "トークンを獲得"ボタンのクリックイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    const getTokenButton = document.getElementById("getTokenButton");

    if (getTokenButton) {
        getTokenButton.addEventListener("click", function() {
            // ボタンがクリックされたときにindex2.htmlに遷移
            window.location.href = "/AvaWalk/";
        });
    } else {
        console.error('ElementID "getTokenButton"が見つかりません');
    }
});


//----------------------------------------------------------------------------------------------------------------------
// "商品を選択"ボタンのクリックイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    const purchaseButton = document.getElementById("purchaseButton");

    if (purchaseButton) {
        purchaseButton.addEventListener("click", function() {
            // ボタンがクリックされたときにindex2.htmlに遷移
            window.location.href = "index2.html";
        });
    } else {
        console.error('ElementID "purchaseButton"が見つかりません');
    }
});


//----------------------------------------------------------------------------------------------------------------------
// "NFTを購入"ボタンのクリックイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    const nftButton = document.getElementById("nftButton");

    if (nftButton) {
        nftButton.addEventListener("click", function() {
            // ボタンがクリックされたときにindex2.htmlに遷移
            window.location.href = "https://opensea.io/SUNTORY_nft/created";
        });
    } else {
        console.error('ElementID "nftButton"が見つかりません');
    }
});


//----------------------------------------------------------------------------------------------------------------------
// "MetaMaskに接続"ボタンがクリックされたときにconnectMetaMask関数を実行
document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById("connectButton");
    
    if (connectButton) {
        connectButton.addEventListener("click", function() {
            // ボタンがクリックされたときにMetaMaskに接続を実行
            connectMetaMask();
        });
    } else {
        console.error('ElementID "connectButton"が見つかりません');
    }
});


//----------------------------------------------------------------------------------------------------------------------