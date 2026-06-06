# RFQフォーム改修パッチ（メールアドレス確認欄 + 型番プリフィル）

このパッチは **既存サイト本体（GitHub Pages 側の `index.html`）** に適用します。
本リポジトリ（製品ページ生成側）とは別ファイルなので、以下のとおり手作業で差し込んでください。

---

## ① メールアドレス確認欄を追加（HTML）

既存のメールアドレス欄は次の `<div class="grid md:grid-cols-2 gap-8">` ブロック内にあります。

```html
<div class="grid md:grid-cols-2 gap-8">
    <div>
        <label class="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">メールアドレス <span class="text-red-700">*</span></label>
        <input type="email" name="email" id="email" required class="w-full border-b-2 border-slate-200 p-2 focus:border-red-700 focus:outline-none transition bg-slate-50" placeholder="email@example.com">
    </div>
    <div>
        <label class="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">電話番号 <span class="text-red-700">*</span></label>
        <input type="tel" name="電話番号" required class="..." placeholder="03-0000-0000">
    </div>
</div>
```

**変更点1**: メールアドレス欄の `<input>` に `id="email"` を追加（上記のとおり）。

**変更点2**: この `grid` ブロックの **直後** に、確認欄ブロックを丸ごと追加します。

```html
<!-- ▼▼▼ 追加：メールアドレス（確認用） ▼▼▼ -->
<div>
    <label class="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">
        メールアドレス（確認用） <span class="text-red-700">*</span>
    </label>
    <!-- name属性は付けない（送信データに含めないため）。id のみで参照する -->
    <input
        type="email"
        id="email-confirm"
        required
        autocomplete="off"
        onpaste="return false;"
        class="w-full border-b-2 border-slate-200 p-2 focus:border-red-700 focus:outline-none transition bg-slate-50"
        placeholder="確認のためもう一度ご入力ください">
    <p id="email-match-msg" class="text-xs mt-1 hidden"></p>
</div>
<!-- ▲▲▲ 追加ここまで ▲▲▲ -->
```

> `onpaste="return false;"` はコピー＆ペーストによる入力ミス見逃しを防ぐためのものです。不要なら削除可。
> `name` 属性を付けていないため、この欄は Worker への送信データには含まれません（確認用途のみ）。

---

## ② リアルタイム一致チェック + 送信時バリデーション（JavaScript）

既存の `<script>` 内、`document.addEventListener("DOMContentLoaded", () => {` で始まる
**RFQフォーム送信処理ブロックの先頭付近**（`const form = document.getElementById("rfq-form");` の下あたり）に、
以下の「リアルタイム一致チェック」を追加します。

```javascript
// ===== 追加：メールアドレス一致チェック =====
const emailEl = document.getElementById("email");
const emailConfirmEl = document.getElementById("email-confirm");
const emailMsg = document.getElementById("email-match-msg");

function checkEmailMatch() {
    if (!emailEl || !emailConfirmEl || !emailMsg) return true;
    const a = emailEl.value.trim();
    const b = emailConfirmEl.value.trim();

    // 確認欄が空のうちはメッセージを出さない
    if (b === "") {
        emailMsg.classList.add("hidden");
        emailConfirmEl.setCustomValidity("");
        return false;
    }
    if (a === b) {
        emailMsg.textContent = "✓ メールアドレスが一致しました";
        emailMsg.className = "text-xs mt-1 text-green-600 font-bold";
        emailConfirmEl.setCustomValidity("");
        return true;
    } else {
        emailMsg.textContent = "✗ メールアドレスが一致しません";
        emailMsg.className = "text-xs mt-1 text-red-600 font-bold";
        emailConfirmEl.setCustomValidity("メールアドレスが一致しません");
        return false;
    }
}

if (emailEl && emailConfirmEl) {
    emailEl.addEventListener("input", checkEmailMatch);
    emailConfirmEl.addEventListener("input", checkEmailMatch);
}
// ===== 追加ここまで =====
```

次に、既存の **`form.addEventListener("submit", async (e) => {`** の中、
`e.preventDefault();` の **直後**（希望納期チェックより前）に、以下の送信時バリデーションを追加します。

```javascript
// ===== 追加：送信時のメールアドレス一致バリデーション =====
if (!checkEmailMatch()) {
    alert("確認用メールアドレスが一致していません。ご確認ください。");
    if (emailConfirmEl && emailConfirmEl.focus) emailConfirmEl.focus();
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
    }
    return;
}
// ===== 追加ここまで =====
```

> 確認欄に `name` を付けていないため、既存の `fd.forEach` による payload 生成ロジックは変更不要です
> （`email-confirm` は送信されません）。

---

## ③ 製品ページからの型番プリフィル（任意・推奨）

製品ページの「RFQフォームへ進む」ボタンは
`https://www.pivotcore.jp/?model={型番}#rfq` の形式でリンクします。
本体側で `?model=` を読み取り、型番欄へ自動入力すると利便性が上がります。

既存の `<script>` 内、初回表示処理（`DOMContentLoaded` で hash を見ている箇所）の近くに追加してください。

```javascript
// ===== 追加：型番プリフィル（製品ページからの遷移時） =====
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const model = params.get("model");
    if (model) {
        const modelEl = document.querySelector('#rfq-form [name="型番"]');
        if (modelEl && !modelEl.value) {
            modelEl.value = model;
        }
        // RFQセクションを表示
        if (typeof showPage === "function") showPage("rfq", { push: false });
    }
});
// ===== 追加ここまで =====
```

---

## 動作確認チェックリスト

- [ ] 確認欄が空のときはメッセージが出ない
- [ ] 不一致時に赤字「✗ メールアドレスが一致しません」が出る
- [ ] 一致時に緑字「✓ メールアドレスが一致しました」が出る
- [ ] 不一致のまま送信するとアラートが出て送信されない
- [ ] Worker へ送信される payload に `email-confirm` が含まれない
- [ ] `?model=STM32F103C8T6#rfq` でアクセスすると型番欄に自動入力される
