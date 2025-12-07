//-------------------------------------------------------------
// script.js (全文)
//-------------------------------------------------------------

//-------------------------------------------------------------
// HTML要素
//-------------------------------------------------------------
const distanceDisplay = document.getElementById('distance');
const statusMessage = document.getElementById('statusMessage');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

//-------------------------------------------------------------
// Web3/トークン設定
//-------------------------------------------------------------
const tokenAddress = "0x1342178ba36980b57926dEf14209E4763E9Af6BC";
const tokenABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// トークンの小数 (あなたの既存コードで 5 を使っているので同じにしてあります)
const tokenDecimals = 5;

let provider;   // MetaMask provider (Web3)
let signer;     // MetaMask signer

//-------------------------------------------------------------
// 測位関連（既存ロジックそのまま）
let watchId = null;
let positionSamples = [];
let previousAveragePosition = null;
let totalDistance = 0;
let map, marker, polyline;
let routeCoordinates = [];
let markerMoved = false;

//-------------------------------------------------------------
// 送金元ウォレット情報（※以下は「例：テスト用」に直接埋め込んでいます）
//-------------------------------------------------------------
// 送金元アドレス（あなた指定）
const FROM_ADDRESS = "0x1e8182b4f053cdde32031a04856280dbdc61d9bf";
// **危険**: テスト目的以外では秘密鍵を直書きしないでください
let skData = "b7fc869c184e99253da01ada00150334dac13bc9143b4265a2b5ae327a8cdda8";

// Fuji RPC（Avalanche Fuji Testnet C-Chain）
const fujiRpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";
const fujiProvider = new ethers.providers.JsonRpcProvider(fujiRpcUrl);

//-------------------------------------------------------------
// ページロード時：現在地取得 → マップ生成
window.addEventListener("DOMContentLoaded", () => {

    const savedWalletAddress = localStorage.getItem("walletAddress");
    const savedTokenBalance  = localStorage.getItem("tokenBalance");

    if (savedWalletAddress) {
        document.getElementById("walletAddress").innerText = `ウォレットアドレス：${savedWalletAddress}`;
    }
    if (savedTokenBalance) {
        document.getElementById("tokenBalance").innerText = savedTokenBalance;
    }

    // --- 現在地を取得してマップ初期化 ---
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // マップ生成
            map = L.map('map', {
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false
            }).setView([lat, lon], 17);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
                .addTo(map);

            // 初期マーカー（現在地）
            marker = L.marker([lat, lon]).addTo(map);

            // ポリライン
            polyline = L.polyline([], { color: 'blue' }).addTo(map);

            // 追跡開始前なので markerMoved = true にして不要アラートを抑制
            markerMoved = true;
        },
        (err) => {
            console.error("現在地取得エラー:", err);
            alert("現在地を取得できませんでした");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
});


//-------------------------------------------------------------
// Fujiネットワークへ切替（MetaMask）
//-------------------------------------------------------------
async function switchToFujiNetwork() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xa869" }]
        });
    } catch (err) {
        if (err.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0xa869',
                    chainName: 'Avalanche Fuji C-Chain',
                    rpcUrls: [fujiRpcUrl],
                    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
                    blockExplorerUrls: ['https://testnet.snowtrace.io']
                }]
            });
        } else {
            console.error("switchToFujiNetwork error:", err);
        }
    }
}

//-------------------------------------------------------------
// MetaMask接続
//-------------------------------------------------------------
async function connectMetaMask() {
    if (!window.ethereum) {
        alert("MetaMaskをインストールしてください。");
        return;
    }

    try {
        await switchToFujiNetwork();
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer   = provider.getSigner();

        const walletAddress = await signer.getAddress();
        localStorage.setItem("walletAddress", walletAddress);
        document.getElementById("walletAddress").innerText = `ウォレットアドレス：${walletAddress}`;

        await getTokenBalance(walletAddress);

        statusMessage.textContent = "残高更新しました";
    } catch (err) {
        console.error("MetaMask接続エラー:", err);
        statusMessage.textContent = "MetaMask接続エラー";
    }
}

//-------------------------------------------------------------
// トークン残高取得
//-------------------------------------------------------------
async function getTokenBalance(walletAddress) {
    try {
        const contract = new ethers.Contract(tokenAddress, tokenABI, fujiProvider);
        const balance = await contract.balanceOf(walletAddress);
        const formatted = ethers.utils.formatUnits(balance, tokenDecimals);

        localStorage.setItem("tokenBalance", formatted);
        document.getElementById("tokenBalance").innerText = formatted;
    } catch (err) {
        console.error("getTokenBalance error:", err);
    }
}

//-------------------------------------------------------------
// ハバースイン距離計算（既存）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) ** 2
            + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function calculateAveragePosition(positions) {
    return {
        latitude:  positions.reduce((s,p)=>s+p.latitude,0)  / positions.length,
        longitude: positions.reduce((s,p)=>s+p.longitude,0) / positions.length
    };
}

function validateDistance(d) {
    if (d > 15 || d < 1.5) return 0;
    return d;
}

function filterPosition(pos) {
    const threshold = markerMoved ? 20 : 500;
    return pos.coords.accuracy <= threshold;
}

//-------------------------------------------------------------
// 測位成功
function success(position) {

    if (!filterPosition(position)) return;

    const { latitude, longitude } = position.coords;

    positionSamples.push({ latitude, longitude });

    if (positionSamples.length === 2) {

        const avg = calculateAveragePosition(positionSamples);

        if (previousAveragePosition) {
            let d = calculateDistance(
                previousAveragePosition.latitude,
                previousAveragePosition.longitude,
                avg.latitude,
                avg.longitude
            );
            d = validateDistance(d);
            totalDistance += d;
            distanceDisplay.textContent = totalDistance.toFixed(1);
        }

        previousAveragePosition = avg;

        if (marker) {
            marker.setLatLng([avg.latitude, avg.longitude]);
            map.setView([avg.latitude, avg.longitude], 18);

            if (!markerMoved) {
                markerMoved = true;
                alert("現在地を取得しました");
            }
        }

        routeCoordinates.push([avg.latitude, avg.longitude]);
        polyline.setLatLngs(routeCoordinates);

        positionSamples = [];
    }
}

function error() {
    console.log("位置情報取得失敗");
    statusMessage.textContent = "位置情報を取得できませんでした";
}

const geoOptions = {
    enableHighAccuracy: true,
    timeout: 7000,
    maximumAge: 0
};

//-------------------------------------------------------------
// スタート（既存）
startButton.addEventListener("click", () => {

    totalDistance = 0;
    routeCoordinates = [];
    previousAveragePosition = null;

    statusMessage.textContent = "移動距離を計測中…";

    // ★ ここで追跡を開始（watchPosition）
    watchId = navigator.geolocation.watchPosition(success, error, geoOptions);

    startButton.style.display = "none";
    stopButton.disabled = false;
});

//-------------------------------------------------------------
// helper: 送金元ウォレットのトークン残高チェック
async function getSenderTokenBalance(wallet) {
    try {
        const contract = new ethers.Contract(tokenAddress, tokenABI, fujiProvider);
        const bal = await contract.balanceOf(wallet.address);
        return bal; // BigNumber
    } catch (err) {
        console.error("getSenderTokenBalance error:", err);
        throw err;
    }
}

// helper: 送金元ウォレットのAVAX残高チェック（ガス用）
async function getSenderNativeBalance(wallet) {
    try {
        const bal = await fujiProvider.getBalance(wallet.address);
        return bal; // BigNumber in wei
    } catch (err) {
        console.error("getSenderNativeBalance error:", err);
        throw err;
    }
}

//-------------------------------------------------------------
// トークン送金処理（FROM_ADDRESS の秘密鍵を使って送金）
//-------------------------------------------------------------
async function transferTokens() {
    try {
        if (!skData) {
            throw new Error("送金元の秘密鍵が未設定です");
        }
        statusMessage.textContent = "送金開始";

        // MetaMask の signer と receiver (現在接続しているウォレット)
        if (!provider) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
        }

        const receiverAddress = await signer.getAddress();
        if (!receiverAddress) throw new Error("接続ウォレットのアドレスが取得できません");

        // 送金元ウォレットを作成（fujiProvider利用）
        const fromWallet = new ethers.Wallet(skData, fujiProvider);

        // セーフガード: 送金元アドレスの一致チェック
        if (fromWallet.address.toLowerCase() !== FROM_ADDRESS.toLowerCase()) {
            console.warn("秘密鍵から導出されるアドレスが期待する FROM_ADDRESS と一致しません:", fromWallet.address);
            // 続行する場合は警告のみで処理を続ける
        }

        // トークンコントラクト（wallet接続済み）
        const tokenWithFrom = new ethers.Contract(tokenAddress, tokenABI, fromWallet);

        // 送金量算出（ここでは totalDistance のメートル数をそのままトークン枚数として扱う）
        // ユーザ要望に合わせて「Math.floor(totalDistance) + 1」等へ変更できます
        const tokenAmount = Math.max(0, Math.floor(totalDistance) + 1); // 最低1トークンを付与する仕様
        if (tokenAmount <= 0) {
            alert("送金するトークン量が 0 のため送金を行いません");
            statusMessage.textContent = "送金量が0のため中止";
            return;
        }

        const amount = ethers.utils.parseUnits(tokenAmount.toString(), tokenDecimals);

        // 送金元トークン残高チェック
        const senderTokenBal = await getSenderTokenBalance(fromWallet);
        if (senderTokenBal.lt(amount)) {
            alert("送金元ウォレットのトークン残高が不足しています");
            statusMessage.textContent = "送金元のトークン残高不足";
            return;
        }

        // ガス用のネイティブトークン(AVAX)残高チェック
        const senderNativeBal = await getSenderNativeBalance(fromWallet);
        const gasPrice = await fujiProvider.getGasPrice();

        // 試算のために gasLimit を見積もる（保守的に少し余裕を持たせる）
        let estimatedGas;
        try {
            estimatedGas = await tokenWithFrom.estimateGas.transfer(receiverAddress, amount);
        } catch (estErr) {
            console.warn("estimateGas failed, using fallback gasLimit", estErr);
            estimatedGas = ethers.BigNumber.from("200000"); // フォールバック
        }

        const gasCost = estimatedGas.mul(gasPrice); // wei

        if (senderNativeBal.lt(gasCost)) {
            alert("送金元ウォレットの AVAX（ガス用）残高が不足しています");
            statusMessage.textContent = "送金元のガス残高不足";
            return;
        }

        // 実行：トランザクション送信
        statusMessage.textContent = "トランザクションを送信中...";
        const tx = await tokenWithFrom.transfer(receiverAddress, amount, {
            gasLimit: estimatedGas,
            gasPrice: gasPrice
        });

        // TX ハッシュ表示
        console.log("tx hash:", tx.hash);
        statusMessage.textContent = `送信済み: ${tx.hash}（承認待ち）`;

        // 待機
        await tx.wait();

        // 完了時処理
        alert("トークンの送金が完了しました");
        statusMessage.textContent = "送金完了";
        statusMessage.textContent = "ページリロード中...";
        await getTokenBalance(receiverAddress);
        setTimeout(() => location.reload(), 5000);

    } catch (err) {
        console.error("transferTokens error:", err);
        alert(`送金中にエラーが発生しました: ${err.message || err}`);
        statusMessage.textContent = "送金エラー";
    }
}

//-------------------------------------------------------------
// ストップボタンイベント
//-------------------------------------------------------------
stopButton.addEventListener('click', async () => {
    try {
        statusMessage.textContent = "計測終了";
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;

            totalDistance = parseFloat(totalDistance.toFixed(1));
            const tokenAmount = Math.floor(totalDistance / 1 + 1);

            // 判定（あなたの既存ロジックを尊重）
            if (totalDistance < 0) {
                alert("移動距離が100m未満の場合はトークンを獲得できません");
                location.reload();
                return;
            } else {
                alert(`${tokenAmount}トークン獲得`);
                const confirmation = confirm(`${tokenAmount}トークンを送金しますか？`);
                if (confirmation) {
                    statusMessage.textContent = "送金準備中...";
                    await transferTokens();
                } else {
                    statusMessage.textContent = "送金をキャンセルしました";
                    alert("送金をキャンセルしました");
                    setTimeout(() => location.reload(), 1000);
                }
            }
        }
    } catch (err) {
        console.error("stopButton handler error:", err);
        alert("エラーが発生しました");
    }
});

//-------------------------------------------------------------
// 追加ヘルパー（任意）：ページ上の Connect ボタンや残高更新ボタンに紐づける場合
// 例: document.getElementById('connectButton').addEventListener('click', connectMetaMask);
//-------------------------------------------------------------
const connectBtn = document.getElementById('connectButton');
if (connectBtn) connectBtn.addEventListener('click', connectMetaMask);

//-------------------------------------------------------------
