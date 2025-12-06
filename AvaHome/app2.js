
//----------------------------------------------------------------------------------------------------------------------
const tokenAddress = "0xe92939bbdb5fCa4AE3EE2A2ef3Fe7ABc8975B3b9"; // トークンコントラクトアドレス
const recipientAddress = "0x40B51f534AFD1B94FeA17a676AC04B04E01132b3"; // 送金先ウォレットアドレス

const tokenABI = [
    // トークンの転送に使用するERC-20のtransfer関数のABI
    "function transfer(address to, uint256 amount) public returns (bool)"
];

let provider;
let signer;


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
                            chainName: 'Avalanche Fuji C-Chain',
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
// MetaMaskに接続してサインを取得
async function connectMetaMask() {
    if (window.ethereum) {
        try {

            // MetaMaskにネットワークを切り替える
            await switchToFujiNetwork();
            
            await window.ethereum.request({ method: "eth_requestAccounts" });
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
        } catch (error) {
            console.error("MetaMask接続エラー:", error);
        }
    } else {
        // MetaMaskがインストールされていない場合、スマホ用のMetaMaskアプリへ誘導
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/android/i.test(userAgent)) {
            // Androidの場合、MetaMaskアプリへのリンク
            window.open("https://metamask.app.link/dapp/shoken.com/MeoChain/AvaHome", "_blank");
        } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            // iOSの場合、MetaMaskアプリへのリンク
            window.open("https://metamask.app.link/dapp/shoken.com/MeowChain/AvaHome/index.html", "_blank");
        } else {
            alert("MetaMaskがインストールされていません。MetaMaskをインストールしてください。");
        }
    }
}


//----------------------------------------------------------------------------------------------------------------------
//ラズパイとの通信メソッド
//実家と自宅のエンドポイントを切り替える＆証明書回避のためにmode:以降を要設定
async function sendSignalToRaspberryPi() {
    try {
        await fetch('https://192.168.2.104:50500/trigger', {  // 正しいエンドポイントにリクエスト
            method: 'POST',
            mode: 'no-cors', // SSL検証を回避
            body: JSON.stringify({}),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log("ラズベリーパイに信号を送信");
    } catch (error) {
        console.error("ラズベリーパイへの信号送信エラー:", error);
    }
}


//----------------------------------------------------------------------------------------------------------------------
// 伊右衛門購入の送金処理
async function iemonPurchase() {
    const walletAddress = localStorage.getItem("walletAddress");

    if (!walletAddress) {
        alert("ウォレットアドレスが見つかりません。MetaMaskに接続してください。");
        connectMetaMask();
        return;
    }

    if (!provider || !signer) {
        await connectMetaMask();
    }

    const contract = new ethers.Contract(tokenAddress, tokenABI, signer);

    try {
        const tokenAmount = ethers.utils.parseUnits("150", 5);
        
        const tx = await contract.transfer(recipientAddress, tokenAmount);
        console.log("トランザクション送信中...", tx);

        await tx.wait();
        alert("伊右衛門 の購入が完了しました");
        console.log("伊右衛門の購入が完了", tx);

        // 購入完了後、ラズベリーパイに信号を送信
        sendSignalToRaspberryPi();
        console.log("ラズベリーパイに通信を送信", tx);

    } catch (error) {
        console.error("送金エラー:", error);
        alert("購入をキャンセルしました。");
    }
}


//----------------------------------------------------------------------------------------------------------------------
// 天然水購入の送金処理
async function tennensuiPurchase() {
    const walletAddress = localStorage.getItem("walletAddress"); // localStorageからウォレットアドレスを取得

    if (!walletAddress) {
        alert("ウォレットアドレスが見つかりません。MetaMaskに接続してください。");
        return;
    }

    // MetaMaskに接続されているか確認
    if (!provider || !signer) {
        await connectMetaMask(); // 接続されていない場合は接続
    }

    const contract = new ethers.Contract(tokenAddress, tokenABI, signer); // トークンコントラクトインスタンスを作成

    try {
        const tokenAmount = ethers.utils.parseUnits("120", 5); // 300トークンの支払い
        
        // 送金トランザクションの作成と送信
        const tx = await contract.transfer(recipientAddress, tokenAmount);
        console.log("トランザクション送信中...", tx);

        // トランザクションの完了待ち
        await tx.wait();
        alert("天然水 の購入が完了しました");
        console.log("天然水の購入が完了", tx);

        // 購入完了後、ラズベリーパイに信号を送信
        sendSignalToRaspberryPi();
        console.log("ラズベリーパイに通信を送信", tx);

    } catch (error) {
        console.error("送金エラー:", error);
        alert("購入をキャンセルしました。");
    }
}


//----------------------------------------------------------------------------------------------------------------------
// クラフトBOSS購入の送金処理
async function craftBossPurchase() {
    const walletAddress = localStorage.getItem("walletAddress"); // localStorageからウォレットアドレスを取得

    if (!walletAddress) {
        alert("ウォレットアドレスが見つかりません。MetaMaskに接続してください。");
        return;
    }

    // MetaMaskに接続されているか確認
    if (!provider || !signer) {
        await connectMetaMask(); // 接続されていない場合は接続
    }

    const contract = new ethers.Contract(tokenAddress, tokenABI, signer); // トークンコントラクトインスタンスを作成

    try {
        const tokenAmount = ethers.utils.parseUnits("150", 5); // 500トークンの支払い
        
        // 送金トランザクションの作成と送信
        const tx = await contract.transfer(recipientAddress, tokenAmount);
        console.log("トランザクション送信中...", tx);

        // トランザクションの完了待ち
        await tx.wait();
        alert("クラフトBOSS の購入が完了しました");
        console.log("クラフトBOSSの購入が完了", tx);

        // 購入完了後、ラズベリーパイに信号を送信
        sendSignalToRaspberryPi();
        console.log("ラズベリーパイに通信を送信", tx);

    } catch (error) {
        console.error("送金エラー:", error);
        alert("購入をキャンセルしました。");
    }
}


//----------------------------------------------------------------------------------------------------------------------
// 山崎蒸溜所貯蔵梅酒購入の送金処理
async function yamazakiUmePurchase() {
    const walletAddress = localStorage.getItem("walletAddress"); // localStorageからウォレットアドレスを取得

    if (!walletAddress) {
        alert("ウォレットアドレスが見つかりません。MetaMaskに接続してください。");
        return;
    }

    // MetaMaskに接続されているか確認
    if (!provider || !signer) {
        await connectMetaMask(); // 接続されていない場合は接続
    }

    const contract = new ethers.Contract(tokenAddress, tokenABI, signer); // トークンコントラクトインスタンスを作成

    try {
        const tokenAmount = ethers.utils.parseUnits("1500", 5); // 500トークンの支払い
        
        // 送金トランザクションの作成と送信
        const tx = await contract.transfer(recipientAddress, tokenAmount);
        console.log("トランザクション送信中...", tx);

        // トランザクションの完了待ち
        await tx.wait();
        alert("山﨑蒸留所梅酒 の購入が完了しました");
        console.log("山﨑蒸留所梅酒の購入が完了", tx);

        // 購入完了後、ラズベリーパイに信号を送信
        sendSignalToRaspberryPi();
        console.log("ラズベリーパイに通信を送信", tx);

    } catch (error) {
        console.error("送金エラー:", error);
        alert("購入をキャンセルしました。");
    }
}


//----------------------------------------------------------------------------------------------------------------------
// "購入"ボタンのクリックイベントリスナー
document.getElementById("iemon_purchaseButton").addEventListener("click", iemonPurchase);
document.getElementById("tennensui_purchaseButton").addEventListener("click", tennensuiPurchase);
document.getElementById("craftBoss_purchaseButton").addEventListener("click", craftBossPurchase);
document.getElementById("yamazakiUme_purchaseButton").addEventListener("click", yamazakiUmePurchase);


//----------------------------------------------------------------------------------------------------------------------
//Homeに戻るボタンが押されたとき
document.getElementById("backHome").addEventListener("click", function() {
    // ボタンがクリックされたときにindex.htmlに遷移
    window.location.href = "index.html";
});


//----------------------------------------------------------------------------------------------------------------------
