import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Raycaster, Vector2 } from 'three'; // RaycasterとVector2をインポート

// --- 基本設定 & グローバル変数 ---------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

const clock = new THREE.Clock();
let spheres = []; // 周回する球体のみ格納
let yellowSphereCount = 0; // 黄色の球体の数
let gameStartTime = performance.now(); // ゲーム開始時間
let gameCleared = false; // ゲームクリアフラグ
let animationId = null; // アニメーションフレームID (停止用)

// UI要素への参照
const yellowCountElement = document.getElementById('yellowCount');
const clearMessageElement = document.getElementById('clearMessage');

// Raycasting用
const raycaster = new Raycaster();
const mouse = new Vector2();

// --- ライトの設定 -----------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // 環境光を少し強く
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // 指向性ライトを少し弱く
directionalLight.position.set(10, 15, 10);
directionalLight.target.position.set(0, 0, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
// (省略: shadow camera bounds)
scene.add(directionalLight);
scene.add(directionalLight.target);

// --- 床の設定 ------------------------------------------------------------
const planeGeometry = new THREE.PlaneGeometry(40, 40); // 床を少し広く
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, side: THREE.DoubleSide }); // 床の色変更
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -6; // 床を少し下に
plane.receiveShadow = true;
scene.add(plane);

// --- 中心に光る金色の球体を設置 ------------------------------------------
const centerSphereGeometry = new THREE.SphereGeometry(1, 32, 32); // 半径1
const centerSphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700, // 金色
    emissive: 0xffd700, // 自己発光色
    emissiveIntensity: 0.5, // 自己発光強度
    metalness: 0.8,
    roughness: 0.2
});
const centerSphere = new THREE.Mesh(centerSphereGeometry, centerSphereMaterial);
centerSphere.position.set(0, 0, 0); // 中心に配置
centerSphere.castShadow = false;
centerSphere.receiveShadow = false;
centerSphere.userData.isCenter = true; // クリック対象外識別のためのフラグ
scene.add(centerSphere);

// --- 周回する球体の設定 ----------------------------------------------------
// 球体数を40〜60個のランダムにする
const numSpheres = Math.floor(Math.random() * 21) + 40; // 40 + (0〜20)
const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
const fixedSpeeds = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const yellowColor = 0xffff00; // 黄色のカラーコード

for (let i = 0; i < numSpheres; i++) {
    const radius = Math.random() * 0.5 + 0.3; // 0.3 〜 0.8
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const colorIndex = Math.floor(Math.random() * colors.length);
    const sphereColor = colors[colorIndex];
    const material = new THREE.MeshStandardMaterial({
        color: sphereColor,
        roughness: 0.5,
        metalness: 0.1
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;

    // 黄色球体の判定とカウント
    if (sphereColor === yellowColor) {
        yellowSphereCount++;
        sphere.userData.isYellow = true; // 黄色フラグ
    } else {
        sphere.userData.isYellow = false;
    }

    // 軌道設定 (省略せず記述)
    const orbitType = Math.random() < 0.5 ? 'circle' : 'ellipse';
    const initialAngle = Math.random() * Math.PI * 2;
    const speed = fixedSpeeds[Math.floor(Math.random() * fixedSpeeds.length)];
    const elevation = Math.random() * 8 - 4; // Y軸高さ (-4 〜 4)

    let orbitData = {};
    let initialX, initialY, initialZ;
    initialY = elevation;

    if (orbitType === 'ellipse') {
        const radiusX = Math.random() * 10 + 5; // 楕円X半径 (5〜15)
        const radiusZ = Math.random() * 5 + 3; // 楕円Z半径 (3〜8)
        orbitData = { orbitType, radiusX, radiusZ, initialAngle, speed, elevation }; // 短縮記法
        initialX = radiusX * Math.cos(initialAngle);
        initialZ = radiusZ * Math.sin(initialAngle);
    } else { // 'circle'
        const orbitRadius = Math.random() * 12 + 3; // 円半径 (3〜15)
        orbitData = { orbitType, orbitRadius, initialAngle, speed, elevation }; // 短縮記法
        initialX = orbitRadius * Math.cos(initialAngle);
        initialZ = orbitRadius * Math.sin(initialAngle);
    }
    // isYellow フラグも userData にマージ
    sphere.userData = { ...orbitData, isYellow: sphere.userData.isYellow };
    sphere.position.set(initialX, initialY, initialZ);

    scene.add(sphere);
    spheres.push(sphere); // アニメーションとクリック判定用に配列に追加
}

// 初期カウント表示更新関数
function updateYellowCountDisplay() {
    if (yellowCountElement) {
        yellowCountElement.textContent = yellowSphereCount;
    }
}
updateYellowCountDisplay(); // 初期表示

// --- カメラ初期位置 ---------------------------------------------------------
camera.position.set(0, 6, 28); // カメラ位置調整
controls.target.set(0, 0, 0);

// --- クリックイベント処理 ---------------------------------------------------
function onMouseClick(event) {
    if (gameCleared) return; // ゲームクリア後は何もしない

    // マウスクリック位置を正規化デバイス座標に変換 (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Raycasterを設定
    raycaster.setFromCamera(mouse, camera);

    // 交差判定 (周回する球体のみを対象)
    const intersects = raycaster.intersectObjects(spheres);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;

        // 黄色の球体かどうか判定
        if (intersectedObject.userData.isYellow === true) {
            // シーンから削除
            scene.remove(intersectedObject);
            // spheres配列から削除
            spheres = spheres.filter(sphere => sphere !== intersectedObject);

            // カウントを減らして表示更新
            yellowSphereCount--;
            updateYellowCountDisplay();

            // ゲームクリア判定
            if (yellowSphereCount === 0) {
                gameCleared = true; // クリアフラグを立てる
                const elapsedTime = performance.now() - gameStartTime; // 経過時間(ms)
                const clearTimeSeconds = (elapsedTime / 1000).toFixed(2); // 秒に変換(小数点2桁)

                // クリアメッセージ表示
                if (clearMessageElement) {
                    clearMessageElement.textContent = `クリア！ タイム: ${clearTimeSeconds} 秒`;
                    clearMessageElement.style.display = 'block'; // 表示する
                } else {
                    alert(`クリア！ タイム: ${clearTimeSeconds} 秒`); // フォールバック
                }

                // アニメーションを停止する場合（任意）
                // if (animationId) cancelAnimationFrame(animationId);
            }
        }
    }
}
renderer.domElement.addEventListener('click', onMouseClick, false);


// --- アニメーションループ ----------------------------------------------------
function animate() {
    animationId = requestAnimationFrame(animate); // アニメーションIDを取得

    if (gameCleared) { // ゲームクリア後は動きを止める場合（任意）
        // return;
    }

    const elapsedTime = clock.getElapsedTime();

    spheres.forEach(sphere => { // spheres配列をループ（削除されたものは含まれない）
        const data = sphere.userData;
        const currentAngle = data.initialAngle + elapsedTime * data.speed;
        let x, z;
        if (data.orbitType === 'ellipse') {
            x = data.radiusX * Math.cos(currentAngle);
            z = data.radiusZ * Math.sin(currentAngle);
        } else { // 'circle'
            x = data.orbitRadius * Math.cos(currentAngle);
            z = data.orbitRadius * Math.sin(currentAngle);
        }
        const y = data.elevation;
        sphere.position.set(x, y, z);
    });

    controls.update();
    renderer.render(scene, camera);
}

// --- ウィンドウリサイズ対応 -------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- リセットボタンの処理 ---------------------------------------------------
const resetButton = document.getElementById('resetButton');
if (resetButton) {
    resetButton.addEventListener('click', () => {
        location.reload(); // ページを再読み込み
    });
} else {
    console.warn('Reset button element with id "resetButton" not found.');
}

// --- アニメーション開始 -----------------------------------------------------
animate();