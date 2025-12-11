// 時刻表示のテスト

// 1. サーバーから受け取るデータ（UTC）
const serverData = {
  // 11:00 JSTとして入力されたが、UTCとして保存された場合
  case1_wrong: "2025-12-12T11:00:00Z",  // これは実際はJST 20:00

  // 11:00 JSTとして正しく変換されてUTCで保存された場合
  case2_correct: "2025-12-12T02:00:00Z",  // これはJST 11:00

  // 11:00 JSTとして入力され、+09:00付きで保存された場合
  case3_with_offset: "2025-12-12T11:00:00+09:00"
};

// 2. formatTime関数（修正前）
function formatTimeOld(datetimeStr) {
  const d = new Date(datetimeStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// 3. formatTime関数（修正後）
function formatTimeNew(datetimeStr) {
  const d = new Date(datetimeStr);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo'
  });
}

console.log("=== 時刻表示テスト ===");
console.log("現在のタイムゾーン:", Intl.DateTimeFormat().resolvedOptions().timeZone);

Object.entries(serverData).forEach(([key, value]) => {
  console.log(`\n${key}: ${value}`);
  console.log(`  修正前: ${formatTimeOld(value)}`);
  console.log(`  修正後: ${formatTimeNew(value)}`);
  console.log(`  Date解析: ${new Date(value).toISOString()}`);
});

// 4. 新規作成時のデータ
console.log("\n=== 新規作成時のデータ ===");
const inputTime = "11:00";
const inputDate = "2025-12-12";

const oldFormat = `${inputDate}T${inputTime}:00`;
const newFormat = `${inputDate}T${inputTime}:00+09:00`;

console.log(`入力: ${inputTime}`);
console.log(`修正前の送信: ${oldFormat}`);
console.log(`修正後の送信: ${newFormat}`);
console.log(`修正前がUTCとして解釈: ${new Date(oldFormat).toISOString()}`);
console.log(`修正後がUTCとして解釈: ${new Date(newFormat).toISOString()}`);
