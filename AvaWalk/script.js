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

let provider;
let signer;

//-------------------------------------------------------------
// 測位関連
//-------------------------------------------------------------
let watchId = null;
let positionSamples = [];
let previousAveragePosition = null;
let totalDistance = 0;
let map, marker, polyline;
let routeCoordinates = [];
let markerMoved = false;

//-------------------------------------------------------------
// ページロード時に残高＆アドレス読み込み
//-------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const savedWalletAddress = localStorage.getItem("walletAddress");
    const savedTokenBalance  = localStorage.getItem("tokenBalance");

    if (savedWalletAddress) {
        document.getElementById("walletAddress").innerText = `ウォレットアドレス：${savedWalletAddress}`;
    }
    if (savedTokenBalance) {
        document.getElementById("tokenBalance").innerText = savedTokenBalance;
    }
});

//-------------------------------------------------------------
// Fujiネットワークへ切替
//-------------------------------------------------------------
async function switchToFujiNetwork() {
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
                    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
                    blockExplorerUrls: ['https://testnet.snowtrace.io']
                }]
            });
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
    }
}

//-------------------------------------------------------------
// トークン残高取得
//-------------------------------------------------------------
async function getTokenBalance(walletAddress) {
    const contract = new ethers.Contract(tokenAddress, tokenABI, provider);

    const balance = await contract.balanceOf(walletAddress);
    const formatted = ethers.utils.formatUnits(balance, 5);

    localStorage.setItem("tokenBalance", formatted);
    document.getElementById("tokenBalance").innerText = formatted;
}

//-------------------------------------------------------------
// ハバースイン距離計算
//-------------------------------------------------------------
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
//-------------------------------------------------------------
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

//-------------------------------------------------------------
function error() {
    console.log("位置情報取得失敗");
    statusMessage.textContent = "位置情報を取得できませんでした";
}

//-------------------------------------------------------------
const geoOptions = {
    enableHighAccuracy: true,
    timeout: 7000,
    maximumAge: 0
};

//-------------------------------------------------------------
// スタート
//-------------------------------------------------------------
startButton.addEventListener("click", () => {

    totalDistance = 0;
    routeCoordinates = [];
    previousAveragePosition = null;

    map = L.map('map', {
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
    }).setView([35.681, 139.767], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    marker   = L.marker([35.681, 139.767]).addTo(map);
    polyline = L.polyline([], { color: 'blue' }).addTo(map);

    statusMessage.textContent = "移動距離を計測中…";

    watchId = navigator.geolocation.watchPosition(success, error, geoOptions);

    startButton.style.display = "none";
    stopButton.disabled = false;
});

//-------------------------------------------------------------
// STOP → トークン送金
//-------------------------------------------------------------

//------------------------------------------------------------------------------------------------------------------------
//送金前残高チェック
let skData = "b7fc869c184e99253da01ada00150334dac13bc9143b4265a2b5ae327a8cdda8"; // 既知の秘密鍵

// Fuji プロバイダ
const fujiProvider = new ethers.providers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");

// 送金前残高チェック
async function checkTokenBalance(receiverAddress) {
    if (!skData) {
        await skDataCheck();
    }

}

// 獲得トークン送金処理
async function transferTokens() {
    if (!skData) await skDataCheck();

    statusMessage.textContent = "送金開始";

    const fujiProvider = new ethers.providers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    if (!signer) throw new Error("signerが取得できませんでした");

    // 接続ウォレットアドレスを送金先に
    const walletAddress = await signer.getAddress();

    const wallet = new ethers.Wallet(skData, fujiProvider);
    const contract = new ethers.Contract(tokenAddress, tokenABI, wallet);
    const tokenAmount = Math.floor(totalDistance / 1);
    const amount = ethers.utils.parseUnits(tokenAmount.toString(), 5);

    // 残高チェックに walletAddress を渡す
    if (!contract) throw new Error("コントラクトが初期化されていません");
    if (!walletAddress) throw new Error("ウォレットアドレスが未取得です");

    const gasPrice = await fujiProvider.getGasPrice();
    const estimatedGas = await contract.estimateGas.transfer(walletAddress, amount);

    const tx = await contract.transfer(walletAddress, amount, {
        gasLimit: estimatedGas,
        gasPrice: gasPrice
    });

    statusMessage.textContent = "トランザクション承認中...";
    await tx.wait();

    alert("トークンの送金が完了しました！");
    await getTokenBalance(walletAddress);
    statusMessage.textContent = "＄SUNトークンを獲得しました";
}


// ストップボタンイベント
stopButton.addEventListener('click', async () => {
    statusMessage.textContent = "計測終了";
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;

        totalDistance = parseFloat(totalDistance.toFixed(1));
        const tokenAmount = Math.floor(totalDistance / 1 + 1);

        if (totalDistance < 0) {
            alert("移動距離が100m未満の場合はトークンを獲得できません");
            location.reload();
        } else {
            alert(`${tokenAmount}トークン獲得`);
            const confirmation = confirm(`${tokenAmount}トークンを送金しますか？`);
            if (confirmation) {
                statusMessage.textContent = "送金準備中...";
                await transferTokens(); // 直接送金
            } else {
                statusMessage.textContent = "送金をキャンセルしました";
                alert("送金をキャンセルしました");
                setTimeout(() => location.reload(), 1000);
            }
        }
    }
});
